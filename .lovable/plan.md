

## Integrar Nylas para Acesso ao Gmail

### Resumo
Substituir o fluxo OAuth custom do Google pelo Nylas API v3 para pesquisar emails e descarregar faturas. O Nylas ja tem as credenciais Google configuradas (como mostrado no screenshot), pelo que so precisamos da API Key e do Grant ID para aceder ao email dos utilizadores.

### Vantagens
- Elimina o problema do erro 403 do Google OAuth
- Nao e preciso gerir tokens OAuth manualmente (o Nylas trata disso)
- API mais simples e direta para pesquisar emails e descarregar anexos

### O que muda

**1. Segredos necessarios**
- `NYLAS_API_KEY` -- a API key da tua conta Nylas
- `NYLAS_GRANT_ID` -- o Grant ID do utilizador/conta Google ligada no Nylas

**2. Edge function: `scan-gmail-invoices`** (reescrita)
- Usa a Nylas Messages API em vez da Gmail API direta
- Endpoints:
  - `GET https://api.us.nylas.com/v3/grants/{grant_id}/messages?q=...&has_attachments=true` para pesquisar emails
  - `GET https://api.us.nylas.com/v3/grants/{grant_id}/messages/{id}?select=attachments` para obter detalhes
  - `GET https://api.us.nylas.com/v3/grants/{grant_id}/attachments/{id}/download?message_id=...` para descarregar anexos
- Autenticacao: header `Authorization: Bearer {NYLAS_API_KEY}`
- A logica de matching com faturas e upload para storage mantém-se igual

**3. Edge function: `gmail-auth-callback`** (removida ou simplificada)
- Ja nao e necessaria -- a autenticacao e gerida pelo Nylas dashboard
- Sera removida ou convertida num endpoint simples que verifica se o Nylas esta configurado

**4. Componente `GmailConnectionCard`** (simplificado)
- Remove todo o fluxo OAuth (redirect para Google, callback com code)
- Mostra apenas o estado da ligacao (configurado/nao configurado) baseado na existencia dos segredos
- Pode opcionalmente guardar o grant_id na tabela `email_connections` para suporte futuro de multiplos utilizadores

**5. Componente `ScanGmailDialog`** 
- Sem alteracoes significativas -- continua a chamar a edge function `scan-gmail-invoices`

### Secção Tecnica

```text
Antes (OAuth custom):
  Browser --> Google OAuth --> callback --> gmail-auth-callback (troca code por tokens)
  scan-gmail-invoices --> refresh token --> Gmail API

Depois (Nylas):
  scan-gmail-invoices --> Nylas API (com API Key + Grant ID)
  (sem fluxo OAuth no browser)
```

**Nylas API calls no edge function:**
```
GET /v3/grants/{grant_id}/messages
  ?q=from:supplier@email.com has:attachment
  &limit=10
  Headers: Authorization: Bearer {NYLAS_API_KEY}

GET /v3/grants/{grant_id}/attachments/{att_id}/download
  ?message_id={msg_id}
  Headers: Authorization: Bearer {NYLAS_API_KEY}
```

**Parsing AI:** mantém-se com Lovable AI (modelo suportado) em vez do Anthropic direto, eliminando a dependencia do `ANTHROPIC_API_KEY`.

### Passos de implementacao
1. Pedir os segredos `NYLAS_API_KEY` e `NYLAS_GRANT_ID`
2. Reescrever `scan-gmail-invoices` para usar Nylas API
3. Simplificar `GmailConnectionCard` (remover OAuth flow)
4. Remover/simplificar `gmail-auth-callback`
5. Testar o fluxo completo

