# Briefing: Fix Edge Function `process-webhook` (Z-API → Supabase)

## Contexto

Webhook Z-API entrega mensagens WhatsApp na Edge Function `process-webhook` do projeto Supabase `gmpurkzxtvzqlvkqwjkp`. Quando uma msg vem de **dispositivo vinculado** (Eric digitando no celular enquanto a sessão WhatsApp Web está ativa), o Z-API entrega a msg com `phone` no formato `<digits>@lid` (Linked Identifier interno do WhatsApp Multi-Device) **em vez do número real**.

Resultado: cada contato vira 2 chats — um numérico (msgs recebidas) + um @lid (msgs enviadas pelo Eric via celular). Já corrigi 35 duplicatas históricas via migração e adicionei UNION via tabela `lid_mapping` no MCP read. Falta o **fix preventivo** na Edge Function pra novos webhooks não criarem mais @lid.

## Tabela `lid_mapping` (já existe e está populada com 108 entries)

```sql
lid          text PRIMARY KEY  -- "123456789012345@lid"
phone        text NOT NULL     -- "5511999999999"
chat_name    text
resolved_via text CHECK (resolved_via IN ('manual','chat_name','zapi'))
resolved_at  timestamptz DEFAULT now()
```

## O que a Edge Function precisa fazer (pseudocódigo)

```ts
async function resolveChatId(payload): Promise<string> {
  const { phone, fromMe, chatName, isGroup } = payload;

  if (isGroup) return phone;            // grupos são `<id>-group`, manter
  if (!phone.endsWith('@lid')) return phone;  // já é número, ok

  // 1. Cache em lid_mapping
  const cached = await supabase
    .from('lid_mapping')
    .select('phone')
    .eq('lid', phone)
    .maybeSingle();
  if (cached.data?.phone) return cached.data.phone;

  // 2. Heurística por chat_name (geralmente é o phone como string ou um nome)
  if (chatName && /^\d{10,15}$/.test(chatName)) {
    await supabase.from('lid_mapping').upsert({
      lid: phone, phone: chatName, chat_name: chatName, resolved_via: 'chat_name'
    });
    return chatName;
  }

  // 3. Fallback Z-API: GET /chats/{lid}
  const zapi = await fetchZapiCreds();  // SELECT * FROM zapi_instance WHERE is_active
  const r = await fetch(
    `https://api.z-api.io/instances/${zapi.instance_id}/token/${zapi.token}/chats/${encodeURIComponent(phone)}`,
    { headers: { 'Client-Token': zapi.client_token } }
  );
  const data = await r.json();
  if (data?.phone && /^\d+$/.test(data.phone)) {
    await supabase.from('lid_mapping').upsert({
      lid: phone, phone: data.phone, chat_name: data.name || chatName, resolved_via: 'zapi'
    });
    return data.phone;
  }

  // 4. Último recurso: deixa @lid (não duplica chat — entra órfão e MCP read pega via UNION)
  return phone;
}
```

**Onde plugar**: antes do INSERT em `chats` e do INSERT em `messages`. Substituir o `chat_id` derivado de `payload.phone` pelo retorno de `resolveChatId(payload)`.

## Credenciais Z-API (fonte de verdade: tabela `zapi_instance`)

```sql
SELECT instance_id, token, client_token FROM zapi_instance WHERE is_active = true;
```

Hoje (06/05/2026):
- instance_id: `3F1FD2FAC1A801F1ED9506ABA24BC57F`
- token: `1F80DD47AE40B88186F0D417` (rotaciona — sempre puxar do banco)
- client_token: `F79467fe9aea242c8b35d59569cd12fc9S`

URL pattern: `https://api.z-api.io/instances/{instance_id}/token/{token}/{endpoint}`

Endpoint que resolve LID: `GET /chats/{lid}` → retorna `{ phone, name, lid, isGroup, ... }`. Header obrigatório: `Client-Token: <client_token>`.

**Endpoints que NÃO funcionam pra LID**:
- `/contacts/{lid}` → "Phone not exists"
- `/lid-to-phone/{lid}` → 404
- `/phone-exists/{lid}` → idem

## Plano detalhado completo

Está em `/workspace/expert-mcps/mcps/whatsapp-agent/FIX-PLAN-LID-DUPLICATION.md` (260 linhas). Cobre:
- Etapa 1: criação tabela `lid_mapping` (✅ feito)
- Etapa 2: migração SQL CTE pra mergear duplicatas existentes (✅ feito, 73 merges)
- Etapa 3: resolução via Z-API dos órfãos (✅ feito hoje, 35/52)
- Etapa 4: hardening MCP read via UNION (✅ feito hoje, em `index.js`)
- **Etapa 5: este fix da Edge Function (⏳ pendente — é o que precisa fazer)**

## Checklist de validação após deploy

1. Enviar msg pelo celular (linked device) pra um contato
2. Verificar em `chats` que NÃO criou novo @lid (`SELECT chat_id FROM chats WHERE chat_id LIKE '%@lid' ORDER BY created_at DESC LIMIT 5`)
3. Verificar que a msg foi pra `chat_id` numérico (`SELECT chat_id FROM messages ORDER BY created_at DESC LIMIT 5`)
4. Verificar nova entry em `lid_mapping` com `resolved_via='chat_name'` ou `'zapi'`

## Importante

- Service role key do Supabase ESTÁ disponível na Edge Function via env (`SUPABASE_SERVICE_ROLE_KEY`)
- Z-API client_token tem que ir no header `Client-Token`, NÃO no body
- Não fazer chamada Z-API síncrona pra TODA msg — usar cache `lid_mapping` primeiro
- Em `resolved_via`, usar **só** os 3 valores aceitos: `manual` | `chat_name` | `zapi` (CHECK constraint)
