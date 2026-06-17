# Capacity Planner · Neroes

Ferramenta de planeamento e análise de capacidade por semana (quarta→terça), com sincronização automática a partir do Motion.

---

## Requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com) (plano gratuito suficiente)

---

## 1 · Criar o projeto no Supabase

1. Entra em [app.supabase.com](https://app.supabase.com) e clica **New project**.
2. Escolhe um nome (ex. `neroes-capacity`) e uma palavra-passe para a base de dados.
3. Seleciona a região mais próxima (ex. *West EU – Ireland*) e clica **Create new project**.
4. Aguarda ~1 minuto até o projeto estar pronto.

---

## 2 · Correr o schema.sql

1. No painel do teu projeto → **SQL Editor** → **New query**.
2. Copia o conteúdo de `supabase/schema.sql` e cola.
3. Clica **Run** (`Ctrl+Enter`).

Cria todas as tabelas, activa RLS e insere os dados iniciais (pessoas, workspaces, fator 0.85).

### Uso sem autenticação (modo interno simples)

No `schema.sql`, comenta o bloco **OPÇÃO A** e descomenta o bloco **OPÇÃO B**.

---

## 3 · Configurar o .env

1. **Project Settings → API** no painel Supabase.
2. Copia **Project URL** e **anon public** key.
3. Cria `.env` na raiz:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 4 · Instalar e arrancar

```bash
npm install
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173).

---

## 5 · Painel de Administração

Clica no ícone ⚙ no canto superior direito. PIN: **1008**

- **Pessoas** — editar horas semanais e email (necessário para Motion)
- **Workspaces** — CRUD completo com color picker
- **Objetivos** — % objetivo por workspace por semana (override dos padrões)
- **Motion** — mapeamento e sincronização (ver secção abaixo)
- **Definições** — fator de eficiência global

---

## 6 · Integração Motion

### Como funciona

1. O Motion tem workspaces e tarefas com assignees e duração.
2. Quando uma tarefa é marcada como concluída, a Edge Function `sync-motion` lê essa tarefa e cria um registo Real no Capacity Planner (horas = duração / 60, semana = quarta-feira da semana de conclusão).
3. Os registos importados mostram um badge **Motion** e não podem ser apagados manualmente.
4. Nunca duplica: usa `motion_task_id` único para upsert.

### Configuração passo a passo

**a) API Key do Motion**

1. No Motion, vai a **Settings → API**.
2. Cria uma nova API key e copia-a.

**b) Guardar como secret no Supabase**

```bash
# Instala o Supabase CLI se não tiveres
brew install supabase/tap/supabase   # macOS
# ou: npm install -g supabase

supabase login
supabase link --project-ref <ref-do-teu-projeto>

supabase secrets set MOTION_API_KEY=<a-tua-api-key>
```

**c) Deploy da Edge Function**

```bash
supabase functions deploy sync-motion
```

**d) Ativar o cron (sincronização automática)**

No SQL Editor do Supabase:

```sql
-- Ativa a extensão pg_cron (só é necessário uma vez)
create extension if not exists pg_cron;

-- Sincroniza todos os dias às 08:00 UTC
select cron.schedule(
  'sync-motion-daily',
  '0 8 * * *',
  $$
    select net.http_post(
      url := 'https://<ref>.supabase.co/functions/v1/sync-motion',
      headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb
    )
  $$
);
```

Substitui `<ref>` e `<SERVICE_ROLE_KEY>` pelos valores em **Project Settings → API**.

**e) Mapear workspaces**

1. Abre o painel Admin (⚙) → tab **Motion**.
2. Clica **Sincronizar agora** — isto descobre os workspaces do Motion.
3. Para cada workspace Motion, seleciona o workspace correspondente do Capacity Planner.

**f) Adicionar emails às pessoas**

1. Admin → tab **Pessoas** → edita cada pessoa e preenche o email.
2. O email deve ser igual ao usado no Motion.

### Sincronização manual

No painel Admin → tab **Motion** → botão **Sincronizar agora**.

Mostra o resultado: registos importados, workspaces sem mapeamento, assignees sem email configurado.

---

## Stack

| Camada     | Tecnologia                                    |
|------------|-----------------------------------------------|
| Frontend   | React 18 + TypeScript + Vite                  |
| Estilos    | Tailwind CSS                                  |
| Gráficos   | Recharts                                      |
| Base dados | Supabase (PostgreSQL)                         |
| Fetching   | TanStack Query v5                             |
| Sync       | Supabase Edge Function (Deno) + cron diário   |
