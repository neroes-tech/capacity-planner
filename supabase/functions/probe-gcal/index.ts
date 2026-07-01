import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ServiceAccount {
  client_email: string
  private_key: string
  project_id?: string
}

interface GCalEvent {
  id: string
  summary?: string
  description?: string
  location?: string
  start: { dateTime?: string; date?: string; timeZone?: string }
  end: { dateTime?: string; date?: string; timeZone?: string }
  colorId?: string
  status?: string
  eventType?: string
  transparency?: string
  iCalUID?: string
  htmlLink?: string
  organizer?: { email: string; displayName?: string; self?: boolean }
  creator?: { email: string; displayName?: string; self?: boolean }
  attendees?: Array<{ email: string; responseStatus: string; self?: boolean; organizer?: boolean }>
  extendedProperties?: { private?: Record<string, string>; shared?: Record<string, string> }
  recurringEventId?: string
  originalStartTime?: { dateTime?: string; date?: string }
}

// ─── JWT / Auth (Web Crypto RS256, zero deps externos) ───────────────────────

function b64u(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----[^-]+-----/g, '')   // remove header/footer
    .replace(/\s/g, '')                 // remove whitespace e \n reais
  const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8', der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  )
}

async function createSignedJwt(
  clientEmail: string, sub: string, scope: string, key: CryptoKey,
): Promise<string> {
  const enc = (obj: unknown) => b64u(new TextEncoder().encode(JSON.stringify(obj)))
  const now = Math.floor(Date.now() / 1000)
  const header  = enc({ alg: 'RS256', typ: 'JWT' })
  const payload = enc({
    iss: clientEmail, sub, scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  })
  const sigInput = `${header}.${payload}`
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key,
    new TextEncoder().encode(sigInput),
  )
  return `${sigInput}.${b64u(new Uint8Array(sig))}`
}

async function getAccessToken(sa: ServiceAccount, impersonate: string): Promise<string> {
  const key = await importPrivateKey(sa.private_key)
  const jwt = await createSignedJwt(
    sa.client_email, impersonate,
    'https://www.googleapis.com/auth/calendar.readonly',
    key,
  )
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!r.ok) {
    const err = await r.text()
    throw new Error(`Token exchange ${r.status}: ${err}`)
  }
  return (await r.json()).access_token
}

// ─── Semana (mesma fórmula do sync-motion) ────────────────────────────────────

function weekWindow() {
  const now = new Date()
  const diff = (now.getDay() - 3 + 7) % 7   // dias desde a última quarta-feira
  const wed = new Date(now)
  wed.setDate(now.getDate() - diff)
  wed.setHours(0, 0, 0, 0)
  const next = new Date(wed)
  next.setDate(wed.getDate() + 7)
  return {
    label: wed.toISOString().slice(0, 10),
    timeMin: wed.toISOString(),
    timeMax: next.toISOString(),
  }
}

// ─── Summarize + classificação heurística de event vs task-block ──────────────

function summarizeEvent(e: GCalEvent, calendarId: string) {
  const ext = e.extendedProperties
  const privateKeys = ext?.private ? Object.keys(ext.private) : []
  const sharedKeys  = ext?.shared  ? Object.keys(ext.shared)  : []
  const allExtKeys  = [...privateKeys, ...sharedKeys]

  // Sinais de task-block (a confirmar no Stage 1)
  const hasMotionKey    = allExtKeys.some(k => /motion/i.test(k))
  const isAllDay        = !e.start.dateTime
  const attendeeCount   = e.attendees?.length ?? 0
  const selfOnly        = attendeeCount <= 1 && e.organizer?.email === calendarId
  const isTransparent   = e.transparency === 'transparent'
  const isCancelled     = e.status === 'cancelled'

  let taskBlockReason: string | null = null
  if (hasMotionKey)  taskBlockReason = `motion-key-in-extendedProperties(${allExtKeys.filter(k => /motion/i.test(k)).join(',')})`
  else if (selfOnly) taskBlockReason = `single-attendee-self(attendees=${attendeeCount})`

  return {
    id: e.id,
    iCalUID: e.iCalUID ?? null,
    recurringEventId: e.recurringEventId ?? null,
    summary: e.summary ?? null,
    start: e.start.dateTime ?? e.start.date ?? null,
    end: e.end.dateTime ?? e.end.date ?? null,
    colorId: e.colorId ?? null,
    'organizer.email': e.organizer?.email ?? null,
    'creator.email': e.creator?.email ?? null,
    calendarId,
    attendees: (e.attendees ?? []).map(a => ({ email: a.email, responseStatus: a.responseStatus, self: a.self })),
    status: e.status ?? null,
    eventType: e.eventType ?? null,
    transparency: e.transparency ?? null,
    isAllDay,
    isTransparent,
    isCancelled,
    extPrivateKeys: privateKeys,
    extSharedKeys: sharedKeys,
    extPrivate: ext?.private ?? null,
    extShared: ext?.shared ?? null,
    _taskBlockHint: taskBlockReason,
    _classification: taskBlockReason ? 'TASK_BLOCK' : (isAllDay ? 'ALL_DAY' : 'REAL_EVENT'),
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS })

  // 1. Validar secret
  const saRaw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!saRaw) {
    return json({
      authStatus: 'BLOQUEADO',
      error: 'Secret GOOGLE_SERVICE_ACCOUNT_JSON não encontrado nos secrets do Supabase.',
      nextSteps: [
        '1. Google Cloud Console → IAM & Admin → Service Accounts → criar SA',
        '2. SA → Chaves → Adicionar chave JSON → copiar conteúdo completo',
        '3. Supabase Dashboard → Edge Functions → Secrets → GOOGLE_SERVICE_ACCOUNT_JSON = <JSON completo>',
        '4. Google Workspace Admin → Security → API Controls → Domain-wide delegation → Client ID do SA + scope https://www.googleapis.com/auth/calendar.readonly',
      ],
    }, 500)
  }

  let sa: ServiceAccount
  try {
    sa = JSON.parse(saRaw)
    if (!sa.client_email || !sa.private_key) throw new Error('Faltam client_email ou private_key')
  } catch (e) {
    return json({ authStatus: 'BLOQUEADO', error: `GOOGLE_SERVICE_ACCOUNT_JSON inválido: ${e}` }, 500)
  }

  // 2. Buscar pessoas com email da BD
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const { data: people } = await supabase
    .from('people')
    .select('name, email')
    .not('email', 'is', null)
    .limit(3)

  if (!people?.length) {
    return json({ authStatus: 'BLOQUEADO', error: 'Sem pessoas com email na BD (coluna people.email).' }, 500)
  }

  // 3. Janela da semana atual
  const { label: weekStart, timeMin, timeMax } = weekWindow()

  // 4. Mapa de cores do Google Calendar
  let colorsMap: Record<string, { background: string; foreground: string }> | { error: string } = {}
  try {
    const tok = await getAccessToken(sa, people[0].email)
    const r = await fetch('https://www.googleapis.com/calendar/v3/colors', {
      headers: { Authorization: `Bearer ${tok}` },
    })
    const colorsData = await r.json()
    colorsMap = r.ok ? (colorsData.event ?? {}) : { error: `${r.status}: ${JSON.stringify(colorsData)}` }
  } catch (e) {
    colorsMap = { error: String(e) }
  }

  // 5. Eventos por pessoa
  const results = []
  let anyAuthOk = false

  for (const person of people) {
    if (!person.email) continue

    try {
      const tok = await getAccessToken(sa, person.email)
      anyAuthOk = true

      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(person.email)}/events`,
      )
      url.searchParams.set('timeMin', timeMin)
      url.searchParams.set('timeMax', timeMax)
      url.searchParams.set('singleEvents', 'true')
      url.searchParams.set('orderBy', 'startTime')
      url.searchParams.set('maxResults', '50')
      // Sem filtro de fields: queremos o JSON completo para a sonda

      const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${tok}` } })
      if (!r.ok) {
        results.push({ person: person.email, error: `${r.status}: ${await r.text()}` })
        continue
      }

      const items: GCalEvent[] = (await r.json()).items ?? []
      const summaries = items.map(e => summarizeEvent(e, person.email))

      // Análise específica para a sonda
      const tomatoEvent = summaries.find(s => s.colorId === '11')
      const taskBlocks  = summaries.filter(s => s._classification === 'TASK_BLOCK')
      const realEvents  = summaries.filter(s => s._classification === 'REAL_EVENT')
      const allDay      = summaries.filter(s => s._classification === 'ALL_DAY')

      // Par (task-block, real-event) para comparação de de-dup
      const dedupComparison = taskBlocks.length > 0 && realEvents.length > 0
        ? { taskBlockSample: taskBlocks[0], realEventSample: realEvents[0] }
        : null

      results.push({
        person: person.email,
        totalEvents: items.length,
        breakdown: { realEvents: realEvents.length, taskBlocks: taskBlocks.length, allDay: allDay.length },
        // Teste da cor: evento Tomato (colorId=11)
        TESTE_COR: tomatoEvent
          ? { veredicto: 'SIM — colorId=11 (Tomato) encontrado', evento: tomatoEvent }
          : { veredicto: 'NÃO — nenhum evento com colorId=11 nesta semana', nota: 'Confirmar que o evento foi criado esta semana e o sync Motion→Google correu' },
        // Comparação para de-dup
        TESTE_DEDUP: dedupComparison,
        // Todos os summaries
        summaries,
        // JSON cru dos primeiros 2 eventos (full object)
        rawSample: items.slice(0, 2),
      })
    } catch (e) {
      results.push({ person: person.email, error: String(e) })
    }
  }

  // Resumo final consolidado
  const allTomato = results.flatMap((r: unknown) => {
    const rr = r as { TESTE_COR?: { veredicto?: string; evento?: unknown } }
    return rr.TESTE_COR?.evento ? [rr.TESTE_COR.evento] : []
  })

  return json({
    // A. Auth
    authStatus: anyAuthOk ? 'OK ✓' : 'FALHOU ✗',
    serviceAccount: sa.client_email,
    // B. Semana
    week: { weekStart, timeMin, timeMax },
    // E. Mapa de cores
    colorsMap_eventSection: colorsMap,
    // C + D + F — detalhes por pessoa
    results,
    // Resumo rápido
    RESUMO: {
      autenticacao: anyAuthOk ? 'OK' : 'FALHOU',
      totalPessoas: people.length,
      tomatoEncontrado: allTomato.length > 0,
      colorIdDoTomato: allTomato.length > 0
        ? (allTomato[0] as { colorId?: string }).colorId
        : 'não encontrado',
    },
  })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
