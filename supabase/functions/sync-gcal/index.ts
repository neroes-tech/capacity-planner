import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
}

const GCAL_BASE    = 'https://www.googleapis.com/calendar/v3'
const NEROES_DOMAIN = 'neroes.tech'
const DELAY_MS      = 120   // ~8 req/s por utilizador, seguro dentro do quota Google

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SA { client_email: string; private_key: string }

interface GCalEvent {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string }
  end:   { dateTime?: string; date?: string }
  colorId?: string
  status?: string
  eventType?: string
  transparency?: string
  organizer?: { email: string }
  attendees?: Array<{ email: string; responseStatus: string; self?: boolean }>
  extendedProperties?: { private?: Record<string, string>; shared?: Record<string, string> }
  recurringEventId?: string
}

interface SyncResult {
  imported: number
  updated: number
  skippedMotionBlocks: number
  skippedCancelled: number
  skippedAllDay: number
  skippedTransparent: number
  skippedPersonal: number
  unmappedRecurring: Array<{ recurring_event_id: string; summary: string | null; sampleStart: string }>
  unclassifiedOneOffs: Array<{ event_id: string; summary: string | null; start: string; colorId: string | null }>
  externalAttendeesIgnored: number
  unknownAttendees: string[]
  errors: string[]
}

// ─── JWT / Auth (Web Crypto RS256, zero deps externos) ────────────────────────

function b64u(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const der  = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8', der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  )
}

async function getAccessToken(sa: SA, impersonate: string): Promise<string> {
  const key  = await importPrivateKey(sa.private_key)
  const enc  = (o: unknown) => b64u(new TextEncoder().encode(JSON.stringify(o)))
  const now  = Math.floor(Date.now() / 1000)
  const h    = enc({ alg: 'RS256', typ: 'JWT' })
  const p    = enc({
    iss: sa.client_email, sub: impersonate,
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  })
  const sig  = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${h}.${p}`))
  const jwt  = `${h}.${p}.${b64u(new Uint8Array(sig))}`

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  if (!r.ok) throw new Error(`Token ${r.status}: ${await r.text()}`)
  return (await r.json()).access_token
}

// ─── Semana (mesma fórmula do sync-motion) ────────────────────────────────────

function weekWindow(weekParam?: string | null) {
  let wed: Date
  if (weekParam) {
    const d    = new Date(weekParam + 'T00:00:00Z')
    const diff = (d.getUTCDay() - 3 + 7) % 7
    wed        = new Date(d)
    wed.setUTCDate(d.getUTCDate() - diff)
    wed.setUTCHours(0, 0, 0, 0)
  } else {
    const now  = new Date()
    const diff = (now.getDay() - 3 + 7) % 7
    wed        = new Date(now)
    wed.setDate(now.getDate() - diff)
    wed.setHours(0, 0, 0, 0)
  }
  const next = new Date(wed)
  next.setDate(wed.getDate() + 7)
  return { label: wed.toISOString().slice(0, 10), timeMin: wed.toISOString(), timeMax: next.toISOString() }
}

function toWednesdayStr(date: Date): string {
  const d    = new Date(date)
  d.setHours(0, 0, 0, 0)
  const diff = (d.getDay() - 3 + 7) % 7
  d.setDate(d.getDate() - diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function durationHours(start: string, end: string): number {
  return Math.round(((new Date(end).getTime() - new Date(start).getTime()) / 3_600_000) * 10) / 10
}

// Normaliza recurringEventId: remove sufixo _R20240101T000000[Z] que alguns clientes Google adicionam
function normalizeRecurringId(id: string): string {
  return id.replace(/_R\d{8}T\d{6}Z?$/, '')
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ─── Fetch de eventos paginado ────────────────────────────────────────────────

async function fetchEvents(
  token: string, calendarId: string, timeMin: string, timeMax: string,
): Promise<GCalEvent[]> {
  const events: GCalEvent[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(`${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events`)
    url.searchParams.set('timeMin',       timeMin)
    url.searchParams.set('timeMax',       timeMax)
    url.searchParams.set('singleEvents',  'true')
    url.searchParams.set('orderBy',       'startTime')
    url.searchParams.set('maxResults',    '250')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
    if (!r.ok) throw new Error(`GCal ${r.status}: ${await r.text()}`)
    const data = await r.json()
    events.push(...(data.items ?? []))
    pageToken = data.nextPageToken
    if (pageToken) await sleep(DELAY_MS)
  } while (pageToken)

  return events
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS })

  const url  = new URL(req.url)
  // Aceita parâmetros tanto por query string (curl/debug) como por JSON body (frontend)
  let bodyParams: Record<string, unknown> = {}
  try {
    if (req.headers.get('content-type')?.includes('application/json')) {
      bodyParams = await req.json()
    }
  } catch { /* body vazio ou não-JSON */ }

  const dryRun        = bodyParams.dryRun      === true  || url.searchParams.get('dryRun')        === '1'
  const debug         = bodyParams.debug       === true  || url.searchParams.get('debug')         === '1'
  const weekParam     = (bodyParams.week as string | undefined) ?? url.searchParams.get('week')
  const includeFuture = bodyParams.includeFuture !== false && url.searchParams.get('includeFuture') !== '0'

  // Validar SA
  const saRaw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!saRaw) return json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON não configurado.' }, 500)

  let sa: SA
  try {
    sa = JSON.parse(saRaw)
    if (!sa.client_email || !sa.private_key) throw new Error('client_email/private_key em falta')
  } catch (e) {
    return json({ error: `GOOGLE_SERVICE_ACCOUNT_JSON inválido: ${e}` }, 500)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Carregar dados de referência em paralelo
  const [
    { data: people },
    { data: recurringMappingsRows },
    { data: workspaceColorsRows },
    { data: eventOverridesRows },
  ] = await Promise.all([
    supabase.from('people').select('id, name, email').not('email', 'is', null),
    supabase.from('recurring_mappings').select('*'),
    supabase.from('workspace_colors').select('*'),
    supabase.from('event_overrides').select('*'),
  ])

  if (!people?.length) return json({ error: 'Sem pessoas com email na BD.' }, 500)

  // Mapas de lookup
  const emailToPerson  = new Map((people ?? []).map(p => [p.email!.toLowerCase().trim(), p]))
  const recurringMap   = new Map((recurringMappingsRows ?? []).map(m => [m.recurring_event_id, m]))
  const colorMap       = new Map((workspaceColorsRows ?? []).map(c => [c.color_id, c]))
  const overrideMap    = new Map((eventOverridesRows ?? []).map(o => [o.event_id, o]))

  const { label: weekLabel, timeMin, timeMax } = weekWindow(weekParam)
  const now = new Date()

  // ── STAGE 1: Recolher eventos de todos os calendários ────────────────────────
  const personEvents: Array<{ email: string; events: GCalEvent[]; error?: string }> = []

  for (const person of people ?? []) {
    if (!person.email) continue
    try {
      const token  = await getAccessToken(sa, person.email)
      const events = await fetchEvents(token, person.email, timeMin, timeMax)
      personEvents.push({ email: person.email, events })
    } catch (e) {
      personEvents.push({ email: person.email, events: [], error: String(e) })
    }
    await sleep(DELAY_MS)  // rate limit entre utilizadores
  }

  // ── STAGE 2: Deduplicar por event.id, retendo colorId não-nulo ──────────────
  const eventMap = new Map<string, GCalEvent>()
  for (const { events } of personEvents) {
    for (const ev of events) {
      if (!eventMap.has(ev.id)) {
        eventMap.set(ev.id, ev)
      } else {
        // Retém colorId do organizador (único a receber cor)
        const existing = eventMap.get(ev.id)!
        if (!existing.colorId && ev.colorId) {
          eventMap.set(ev.id, { ...existing, colorId: ev.colorId })
        }
      }
    }
  }

  const result: SyncResult = {
    imported: 0, updated: 0,
    skippedMotionBlocks: 0, skippedCancelled: 0, skippedAllDay: 0,
    skippedTransparent: 0, skippedPersonal: 0,
    unmappedRecurring: [], unclassifiedOneOffs: [],
    externalAttendeesIgnored: 0, unknownAttendees: [], errors: [],
  }

  // Erros de fetch por pessoa
  for (const { email, error } of personEvents) {
    if (error) result.errors.push(`${email}: ${error}`)
  }

  // Novos recurring events descobertos (para upsert no final)
  const newRecurringToUpsert: Array<{ recurring_event_id: string; summary: string | null }> = []

  // ── STAGE 3: Processar cada evento único ─────────────────────────────────────
  for (const ev of eventMap.values()) {

    // Filtros de exclusão
    if (ev.status === 'cancelled')          { result.skippedCancelled++;    continue }
    if (!ev.start.dateTime)                 { result.skippedAllDay++;       continue }
    if (ev.transparency === 'transparent')  { result.skippedTransparent++;  continue }

    // De-dup: blocos de task do Motion (têm extendedProperties.shared.motionTaskId)
    if (ev.extendedProperties?.shared?.motionTaskId) { result.skippedMotionBlocks++; continue }

    // ── Cascade de atribuição de workspace ──────────────────────────────────

    let workspaceId: string | null = null

    // 1. Override explícito por event.id
    const override = overrideMap.get(ev.id)
    if (override?.planner_workspace_id) {
      workspaceId = override.planner_workspace_id
    }

    // 2. Recurring mapping
    if (!workspaceId && ev.recurringEventId) {
      const normId  = normalizeRecurringId(ev.recurringEventId)
      const mapping = recurringMap.get(normId)

      if (mapping) {
        if (mapping.is_personal) { result.skippedPersonal++; continue }
        workspaceId = mapping.planner_workspace_id  // pode ser null (mapeado mas sem workspace)
      } else {
        // Evento recorrente ainda não mapeado → regista para upsert e coloca em unmapped
        const alreadyListed = result.unmappedRecurring.some(u => u.recurring_event_id === normId)
        if (!alreadyListed) {
          result.unmappedRecurring.push({
            recurring_event_id: normId,
            summary: ev.summary ?? null,
            sampleStart: ev.start.dateTime!,
          })
          if (!recurringMap.has(normId)) {
            newRecurringToUpsert.push({ recurring_event_id: normId, summary: ev.summary ?? null })
          }
        }
      }
      if (!workspaceId) continue  // recorrente sem workspace definido → skip
    }

    // 3. Cor para one-offs (só eventos sem recurringEventId)
    if (!workspaceId && !ev.recurringEventId && ev.colorId) {
      const colorMapping = colorMap.get(ev.colorId)
      if (colorMapping?.planner_workspace_id) {
        workspaceId = colorMapping.planner_workspace_id
      }
    }

    // 4. Sem workspace → one-off por classificar
    if (!workspaceId) {
      if (!ev.recurringEventId) {
        result.unclassifiedOneOffs.push({
          event_id: ev.id,
          summary:  ev.summary ?? null,
          start:    ev.start.dateTime!,
          colorId:  ev.colorId ?? null,
        })
      }
      continue
    }

    // ── Participantes internos ────────────────────────────────────────────────

    const startDt = ev.start.dateTime!
    const endDt   = ev.end.dateTime!
    const hours   = durationHours(startDt, endDt)
    if (hours <= 0) continue

    const week = toWednesdayStr(new Date(startDt))
    const tipo: 'Real' | 'Planeado' =
      includeFuture && new Date(endDt) > now ? 'Planeado' : 'Real'

    // Attendees internos: @neroes.tech, não declinou, existe em people
    let internalEmails: string[] = (ev.attendees ?? [])
      .filter(a =>
        a.email.toLowerCase().endsWith(`@${NEROES_DOMAIN}`) &&
        a.responseStatus !== 'declined',
      )
      .map(a => a.email.toLowerCase().trim())
      .filter(e => emailToPerson.has(e))

    // Externos ignorados
    result.externalAttendeesIgnored += (ev.attendees ?? [])
      .filter(a => !a.email.toLowerCase().endsWith(`@${NEROES_DOMAIN}`)).length

    // Internos com email não reconhecido
    for (const a of ev.attendees ?? []) {
      if (
        a.email.toLowerCase().endsWith(`@${NEROES_DOMAIN}`) &&
        a.responseStatus !== 'declined' &&
        !emailToPerson.has(a.email.toLowerCase().trim())
      ) {
        if (!result.unknownAttendees.includes(a.email)) {
          result.unknownAttendees.push(a.email)
        }
      }
    }

    // Fallback: sem attendees → usa organizador (evento solo ou reunião com só externos)
    if (internalEmails.length === 0 && ev.organizer?.email.toLowerCase().endsWith(`@${NEROES_DOMAIN}`)) {
      const orgEmail = ev.organizer.email.toLowerCase().trim()
      if (emailToPerson.has(orgEmail)) internalEmails = [orgEmail]
    }

    if (internalEmails.length === 0) continue

    // ── Upsert de entries ────────────────────────────────────────────────────

    for (const attendeeEmail of internalEmails) {
      const person      = emailToPerson.get(attendeeEmail)!
      const externalId  = `gcal_${ev.id}__${attendeeEmail}`

      if (dryRun) { result.imported++; continue }

      const { data, error } = await supabase
        .from('entries')
        .upsert({
          motion_task_id: externalId,
          week,
          person_id:    person.id,
          workspace_id: workspaceId,
          tipo,
          hours,
          source: 'gcal',
          note:   ev.summary ?? null,
        }, { onConflict: 'motion_task_id' })
        .select('id, created_at')
        .single()

      if (error) {
        result.errors.push(`"${ev.summary ?? ev.id}": ${error.message}`)
      } else if (data) {
        const age = Date.now() - new Date(data.created_at).getTime()
        if (age < 5000) result.imported++
        else result.updated++
      }
    }
  }

  // ── STAGE 4: Upsert de novos recurring_mappings (ignora conflitos para não sobrescrever admin) ──
  if (!dryRun && newRecurringToUpsert.length > 0) {
    await supabase
      .from('recurring_mappings')
      .upsert(
        newRecurringToUpsert.map(r => ({
          recurring_event_id:   r.recurring_event_id,
          summary:              r.summary,
          planner_workspace_id: null,
          is_personal:          false,
        })),
        { onConflict: 'recurring_event_id', ignoreDuplicates: true },
      )
  }

  const response = {
    success: result.errors.length === 0,
    dryRun,
    week: weekLabel,
    ...result,
    ...(dryRun && { note: 'Modo dry-run: nenhum dado foi escrito na BD.' }),
  }

  if (debug) {
    return json({
      ...response,
      _debug: {
        totalPeople:            people?.length ?? 0,
        totalEventsBeforeDedup: personEvents.reduce((s, p) => s + p.events.length, 0),
        totalEventsAfterDedup:  eventMap.size,
        personBreakdown:        personEvents.map(p => ({ email: p.email, count: p.events.length, error: p.error })),
        weekWindow:             { timeMin, timeMax },
      },
    })
  }

  return json(response)
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
