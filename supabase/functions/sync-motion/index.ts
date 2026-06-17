import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MOTION_BASE = 'https://api.usemotion.com/v1'
const RATE_LIMIT_DELAY_MS = 300

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
}

// ─── Tipos da API Motion ─────────────────────────────────────────────────────

interface MotionWorkspace {
  id: string
  name: string
  teamId: string
  type: string
}

interface MotionAssignee {
  id: string
  name: string
  email: string
}

interface MotionTask {
  id: string
  name: string
  status: { name: string; isDefaultStatus: boolean; isResolvedStatus: boolean }
  workspaceId: string
  assignees: MotionAssignee[]
  duration: number | null       // minutos
  completedTime: string | null
  scheduledEnd: string | null
  lastInteractedTime: string | null
}

interface SyncResult {
  imported: number
  updated: number
  unmappedWorkspaces: string[]
  unknownAssignees: string[]
  errors: string[]
}

// ─── Utils ───────────────────────────────────────────────────────────────────

function toWednesdayStr(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = (day - 3 + 7) % 7
  d.setDate(d.getDate() - diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function motionFetch(path: string, apiKey: string, params: Record<string, string> = {}) {
  const url = new URL(`${MOTION_BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), {
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Motion API ${path} → ${res.status}: ${body}`)
  }
  return res.json()
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Handler principal ───────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
  }

  const url = new URL(req.url)
  const debug = url.searchParams.get('debug') === '1'

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const MOTION_API_KEY = Deno.env.get('MOTION_API_KEY')
  if (!MOTION_API_KEY) {
    return json({ error: 'MOTION_API_KEY não configurada nos secrets do Supabase.' }, 500)
  }

  // Modo debug: devolve tarefas brutas do Motion + pessoas da BD
  if (debug) {
    const { data: people } = await supabase.from('people').select('id, name, email')
    const { workspaces: motionWorkspaces } = await motionFetch('/workspaces', MOTION_API_KEY)

    const taskSamples: unknown[] = []
    for (const mws of motionWorkspaces.slice(0, 3)) {
      try {
        const { tasks } = await motionFetch('/tasks', MOTION_API_KEY, { workspaceId: mws.id })
        const sample = (tasks ?? []).slice(0, 3).map((t: MotionTask) => ({
          id: t.id,
          name: t.name,
          status: t.status,
          duration: t.duration,
          completedTime: t.completedTime,
          assignees: t.assignees,
          workspaceId: t.workspaceId,
        }))
        taskSamples.push({ workspace: mws.name, tasks: sample })
      } catch (e) {
        taskSamples.push({ workspace: mws.name, error: String(e) })
      }
    }

    return json({ debug: true, people, motionWorkspaces, taskSamples })
  }

  const result: SyncResult = {
    imported: 0,
    updated: 0,
    unmappedWorkspaces: [],
    unknownAssignees: [],
    errors: [],
  }

  try {
    // 1. Carregar mapeamentos e pessoas
    const [{ data: mappings }, { data: people }] = await Promise.all([
      supabase.from('motion_mappings').select('*'),
      supabase.from('people').select('id, name, email'),
    ])

    const emailToPerson = new Map(
      (people ?? [])
        .filter((p) => p.email)
        .map((p) => [p.email!.toLowerCase().trim(), p]),
    )

    const wsMap = new Map(
      (mappings ?? [])
        .filter((m) => m.planner_workspace_id)
        .map((m) => [m.motion_workspace_id, m.planner_workspace_id as string]),
    )

    // 2. Listar workspaces do Motion e fazer upsert dos mapeamentos conhecidos
    const { workspaces: motionWorkspaces }: { workspaces: MotionWorkspace[] } =
      await motionFetch('/workspaces', MOTION_API_KEY)

    if (motionWorkspaces.length > 0) {
      await supabase.from('motion_mappings').upsert(
        motionWorkspaces.map((mws) => ({
          motion_workspace_id: mws.id,
          motion_workspace_name: mws.name,
          // Mantém planner_workspace_id existente; se for novo, fica null
          planner_workspace_id:
            mappings?.find((m) => m.motion_workspace_id === mws.id)
              ?.planner_workspace_id ?? null,
        })),
        { onConflict: 'motion_workspace_id', ignoreDuplicates: false },
      )
    }

    // 3. Para cada workspace com mapeamento, importar tarefas concluídas
    for (const mws of motionWorkspaces) {
      const plannerWsId = wsMap.get(mws.id)
      if (!plannerWsId) {
        result.unmappedWorkspaces.push(mws.name)
        continue
      }

      // Tenta primeiro com status=completed para APIs que suportam
      // Se não devolver nada, vai buscar tudo e filtra pelo lado do servidor
      let cursor: string | undefined
      do {
        const params: Record<string, string> = {
          workspaceId: mws.id,
          status: 'completed',        // alguns endpoints do Motion aceitam este filtro
        }
        if (cursor) params.cursor = cursor

        let tasksData: { tasks: MotionTask[]; meta?: { nextCursor?: string } }
        try {
          tasksData = await motionFetch('/tasks', MOTION_API_KEY, params)
        } catch (e) {
          result.errors.push(`Workspace "${mws.name}": ${e instanceof Error ? e.message : String(e)}`)
          break
        }

        // Aceita tarefas que: têm completedTime OU status isResolvedStatus, E têm duração
        const completedTasks = (tasksData.tasks ?? []).filter(
          (t) =>
            (t.completedTime !== null || t.status?.isResolvedStatus) &&
            t.duration !== null &&
            t.duration > 0,
        )

        for (const task of completedTasks) {
          // Data de conclusão: usa completedTime se existir, senão scheduledEnd
          const completedDateStr = task.completedTime ?? task.scheduledEnd
          if (!completedDateStr) continue

          const completedDate = new Date(completedDateStr)
          if (isNaN(completedDate.getTime())) continue

          const week = toWednesdayStr(completedDate)
          const hours = (task.duration ?? 0) / 60

          if (hours <= 0) continue

          // Distribuir pelas pessoas assignadas
          for (const assignee of task.assignees ?? []) {
            const email = assignee.email?.toLowerCase().trim()
            const person = email ? emailToPerson.get(email) : undefined

            if (!person) {
              const unknown = assignee.email || assignee.name
              if (unknown && !result.unknownAssignees.includes(unknown)) {
                result.unknownAssignees.push(unknown)
              }
              continue
            }

            const motionTaskId = `${task.id}__${assignee.id}`

            const { error, data } = await supabase
              .from('entries')
              .upsert(
                {
                  motion_task_id: motionTaskId,
                  week,
                  person_id: person.id,
                  workspace_id: plannerWsId,
                  tipo: 'Real',
                  hours: Math.round(hours * 10) / 10,
                  source: 'motion',
                  note: task.name,
                },
                { onConflict: 'motion_task_id' },
              )
              .select('id, created_at')
              .single()

            if (error) {
              result.errors.push(`Tarefa "${task.name}": ${error.message}`)
            } else if (data) {
              // Se created_at recente, foi inserido; senão foi atualizado
              const age = Date.now() - new Date(data.created_at).getTime()
              if (age < 5000) result.imported++
              else result.updated++
            }
          }
        }

        cursor = tasksData.meta?.nextCursor
        if (cursor) await sleep(RATE_LIMIT_DELAY_MS)
      } while (cursor)
    }
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : String(e))
    return json({ success: false, ...result }, 500)
  }

  return json({ success: true, ...result })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}
