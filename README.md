# Capacity Planner · Neroes

Ferramenta de planeamento e análise de capacidade por semana (quarta→terça).

---

## Requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com) (plano gratuito suficiente)

---

## 1 · Criar o projeto no Supabase

1. Entra em [app.supabase.com](https://app.supabase.com) e clica **New project**.
2. Escolhe um nome (ex. `neroes-capacity`) e uma palavra-passe forte para a base de dados.
3. Seleciona a região mais próxima (ex. *West EU – Ireland*) e clica **Create new project**.
4. Aguarda ~1 minuto até o projeto estar pronto.

---

## 2 · Correr o schema.sql

1. No painel do teu projeto, vai a **SQL Editor** (menu lateral).
2. Clica **New query**.
3. Abre o ficheiro `supabase/schema.sql` deste repositório, copia todo o conteúdo e cola no editor.
4. Clica **Run** (ou `Ctrl+Enter`).

> O script cria as tabelas, ativa RLS, define políticas de acesso e insere os dados iniciais (pessoas, workspaces e fator de eficiência).

### Usar sem autenticação (modo interno simples)

Por defeito o schema usa RLS com `auth.role() = 'authenticated'`, o que exige login.  
Se a equipa vai usar a app sem autenticação, antes de correr o schema:

1. No ficheiro `supabase/schema.sql`, comenta o bloco **OPÇÃO A** e descomenta o bloco **OPÇÃO B**.
2. Corre o script novamente.

Alternativamente, podes desativar RLS completamente:

```sql
alter table people     disable row level security;
alter table workspaces disable row level security;
alter table settings   disable row level security;
alter table entries    disable row level security;
```

---

## 3 · Configurar o .env

1. Vai a **Project Settings → API** no painel Supabase.
2. Copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
3. Na raiz do projeto, cria um ficheiro `.env`:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> O ficheiro `.env` está no `.gitignore` — nunca o commits.

---

## 4 · Instalar dependências e arrancar a app

```bash
cd capacity-planner
npm install
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) no browser.

---

## 5 · Build para produção

```bash
npm run build
# output em dist/
npm run preview   # testar o build localmente
```

Para deploy, faz upload da pasta `dist/` a qualquer hosting estático (Vercel, Netlify, Cloudflare Pages, etc.).  
Lembra-te de configurar as variáveis de ambiente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no painel do teu provider.

---

## Lógica de semanas

As semanas vão de **quarta-feira a terça-feira**. Qualquer data selecionada é automaticamente convertida para a quarta-feira que inicia essa semana. O campo `week` na base de dados guarda sempre a data da quarta.

## Fator de eficiência

Configurado em `settings.efficiency_factor` (default 0.85). Representa a percentagem das horas contratuais que é efetivamente produtiva (reuniões, overhead, etc.).  
Para alterar, corre no SQL Editor:

```sql
update settings set efficiency_factor = 0.80 where id = 1;
```

---

## Stack

| Camada     | Tecnologia                       |
|------------|----------------------------------|
| Frontend   | React 18 + TypeScript + Vite     |
| Estilos    | Tailwind CSS                     |
| Gráficos   | Recharts                         |
| Base dados | Supabase (PostgreSQL)            |
| Fetching   | TanStack Query (React Query v5)  |
