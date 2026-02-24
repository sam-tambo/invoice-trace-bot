

# Bulk Email, Inbox & Auto-Detection de Faturas

## Resumo

Implementar um sistema completo de comunicacao com fornecedores: envio de emails em massa para pedir faturas em falta, caixa de entrada para monitorizar respostas, e detecao automatica de faturas anexadas nas respostas dos fornecedores.

## Arquitectura

```text
+------------------+       +-------------------+       +------------------+
|  Invoices Page   |       |  send-bulk-email  |       |    Resend API    |
|  "Pedir Todas"   +------>+  Edge Function    +------>+  (envio real)    |
+------------------+       +-------------------+       +--------+---------+
                                                                |
                                                       reply-to: inbox@domain
                                                                |
+------------------+       +-------------------+       +--------v---------+
|  Inbox Page      |<------+  receive-email    |<------+  Resend Webhook  |
|  /inbox          |       |  Edge Function    |       |  (inbound email) |
+------------------+       +--------+----------+       +------------------+
                                    |
                           +--------v----------+
                           | Claude AI parses  |
                           | attachments for   |
                           | invoice detection |
                           +-------------------+
```

## O que vamos construir

### 1. Base de dados -- tabela `inbox_messages`
Nova tabela para guardar todas as mensagens recebidas e enviadas:
- `id`, `company_id`, `invoice_id` (nullable), `supplier_nif`, `direction` (inbound/outbound)
- `from_email`, `to_email`, `subject`, `body_text`, `body_html`
- `has_attachments`, `attachments_parsed`, `matched_invoice_id`
- `status` (new, read, processed), `created_at`
- RLS policies scoped por `is_company_member(company_id)`

### 2. Edge Function: `send-bulk-email`
- Recebe `company_id` e opcionalmente uma lista de `invoice_ids` (se vazio, envia para todas as faturas "missing")
- Para cada fatura, busca o supplier email e aplica o template padrao
- Envia via Resend API com `reply-to` configurado para o endere email de inbound
- Actualiza status das faturas para "contacted" e regista nos `outreach_logs`
- Guarda cada email enviado na `inbox_messages` com direction=outbound

### 3. Edge Function: `receive-email`  
- Webhook publico que o Resend chama quando chega um email de resposta
- Faz parse do payload (from, subject, body, attachments)
- Identifica o fornecedor pelo email remetente (lookup na tabela `suppliers`)
- Se tem anexos PDF/imagem, usa Claude para extrair dados da fatura
- Se detecta fatura, actualiza o invoice status para "received" e guarda o ficheiro no storage bucket
- Guarda tudo na `inbox_messages`

### 4. Pagina `/inbox` -- Caixa de Entrada
- Lista de mensagens recebidas agrupadas por fornecedor
- Cada mensagem mostra: remetente, assunto, preview do corpo, anexos, estado
- Badge de "Nova" para mensagens nao lidas
- Ao clicar, abre o detalhe com corpo completo e opcao de ver/descarregar anexos
- Indicador visual quando uma fatura foi automaticamente detectada

### 5. Botao "Pedir Todas" na pagina de Faturas
- Novo botao na pagina `/invoices` que dispara o envio em massa
- Mostra preview: quantas faturas "missing" existem, quantos fornecedores com email
- Confirmacao antes de enviar
- Progress feedback durante o envio

### 6. Navegacao
- Adicionar "Caixa de Entrada" ao sidebar com icone de inbox e badge de contagem de nao lidas

## Pre-requisito: API Key do Resend
Vamos precisar da tua Resend API key configurada como secret. Tambem precisamos de saber qual o dominio verificado no Resend para configurar o `from` e o `reply-to` dos emails.

## Detalhes Tecnicos

### Migracao SQL
```sql
CREATE TABLE public.inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  invoice_id uuid REFERENCES invoices(id),
  supplier_nif text,
  direction text NOT NULL DEFAULT 'inbound',  -- inbound | outbound
  from_email text,
  to_email text,
  subject text,
  body_text text,
  body_html text,
  has_attachments boolean DEFAULT false,
  attachments_parsed boolean DEFAULT false,
  matched_invoice_id uuid REFERENCES invoices(id),
  status text NOT NULL DEFAULT 'new',  -- new | read | processed
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view inbox" ON public.inbox_messages
  FOR SELECT USING (is_company_member(company_id));
CREATE POLICY "Members can insert inbox" ON public.inbox_messages
  FOR INSERT WITH CHECK (is_company_member(company_id));
CREATE POLICY "Members can update inbox" ON public.inbox_messages
  FOR UPDATE USING (is_company_member(company_id));
```

### Edge Functions config (config.toml)
```toml
[functions.send-bulk-email]
verify_jwt = false

[functions.receive-email]
verify_jwt = false
```

### Ficheiros a criar/modificar
- `supabase/functions/send-bulk-email/index.ts` -- envio em massa via Resend
- `supabase/functions/receive-email/index.ts` -- webhook para emails recebidos
- `src/pages/Inbox.tsx` -- pagina da caixa de entrada
- `src/pages/Invoices.tsx` -- adicionar botao "Pedir Todas em Falta"
- `src/components/AppLayout.tsx` -- adicionar link "Caixa de Entrada" ao sidebar
- `src/App.tsx` -- adicionar rota `/inbox`
- `src/components/BulkEmailDialog.tsx` -- dialog de confirmacao do envio em massa
- `src/components/InboxMessageDetail.tsx` -- detalhe de uma mensagem recebida

### Fluxo do envio em massa
1. Utilizador clica "Pedir Todas" na pagina de faturas
2. Frontend busca todas as faturas com status "missing" que tenham supplier com email
3. Mostra dialog de confirmacao com contagem
4. Chama edge function `send-bulk-email`
5. Edge function itera cada fatura, aplica template, envia via Resend
6. Actualiza statuses e regista logs
7. Frontend atualiza a lista

### Fluxo de recepcao de email
1. Fornecedor responde ao email
2. Resend chama webhook `receive-email`
3. Edge function faz parse, identifica fornecedor
4. Se tem anexo PDF, envia para Claude para extrair dados
5. Se detecta fatura valida, actualiza status do invoice para "received"
6. Guarda ficheiro no bucket `invoice-files`
7. Cria registo na `inbox_messages`

