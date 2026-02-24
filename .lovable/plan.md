

## Pesquisa Automatica de Faturas no Gmail + Monitorizacao em Tempo Real

### Resumo
Duas funcionalidades complementares: (1) melhorar o scan existente para pesquisar faturas em falta no Gmail, e (2) criar um webhook Nylas para processar automaticamente emails novos quando chegam ao inbox.

### Problemas a Corrigir Primeiro

1. **URL do AI Gateway errada** -- `scan-gmail-invoices` usa `api.lovable.dev` em vez de `ai.gateway.lovable.dev`
2. **config.toml incompleto** -- faltam entradas para `scan-gmail-invoices`, `gmail-auth-callback` e o novo webhook

### Funcionalidade 1: Melhorar o Scan Existente

O `scan-gmail-invoices` ja faz a pesquisa, mas precisa de:
- Corrigir o URL do AI para `https://ai.gateway.lovable.dev/v1/chat/completions`
- Pesquisar por invoice_number directamente no corpo dos emails (nao so em anexos)
- Melhorar a query de pesquisa para incluir termos como "fatura", "invoice" alem do nome do fornecedor

### Funcionalidade 2: Webhook Nylas para Novos Emails

Nova edge function `nylas-webhook` que:
- Recebe notificacoes `message.created` do Nylas
- Para cada email novo com anexos, descarrega e analisa com AI
- Tenta fazer match com faturas em falta (por invoice_number ou amount)
- Se encontrar match, actualiza o status para "received" e guarda o ficheiro
- Se nao encontrar match, guarda na `inbox_messages` para revisao manual

```text
Fluxo:
  Email chega ao Gmail
    -> Nylas detecta novo email
    -> POST webhook para /nylas-webhook
    -> Edge function processa:
       1. Identifica supplier pelo from_email
       2. Descarrega anexos PDF/imagem
       3. Analisa com Lovable AI (Gemini)
       4. Match com faturas missing/contacted
       5. Actualiza status + guarda ficheiro
       6. Regista em inbox_messages
```

### Alteracoes Tecnicas

**1. Corrigir `scan-gmail-invoices/index.ts`**
- Alterar URL de `https://api.lovable.dev/v1/chat/completions` para `https://ai.gateway.lovable.dev/v1/chat/completions`

**2. Criar `supabase/functions/nylas-webhook/index.ts`**
- Endpoint POST que recebe eventos do Nylas
- Valida o webhook (Nylas challenge verification)
- Para eventos `message.created`:
  - Busca o grant_id da `email_connections` pela conta notificada
  - Descarrega a mensagem completa via Nylas API
  - Se tem anexos PDF/imagem, analisa com Lovable AI
  - Faz match com faturas em falta
  - Guarda em `inbox_messages` e `attachments`

**3. Actualizar `supabase/config.toml`**
- Adicionar entradas para todas as funcoes que faltam:
  - `scan-gmail-invoices` com `verify_jwt = false`
  - `gmail-auth-callback` com `verify_jwt = false`
  - `nylas-webhook` com `verify_jwt = false`

**4. Actualizar `receive-email/index.ts`**
- Migrar de Anthropic API para Lovable AI Gateway (consistencia)

### Configuracao do Webhook no Nylas Dashboard

Apos implementacao, o utilizador precisa de configurar no Nylas dashboard:
- **Webhook URL**: `https://uxttxsscvirkgvnltvfd.supabase.co/functions/v1/nylas-webhook`
- **Trigger**: `message.created`

### Passos de Implementacao
1. Corrigir URL do AI em `scan-gmail-invoices`
2. Adicionar funcoes em falta ao `config.toml`
3. Criar edge function `nylas-webhook`
4. Migrar `receive-email` para Lovable AI
5. Deploy e testar

