# Bug crítico: chats duplicados (número + @lid) por mensagens enviadas de dispositivo linked

**Status:** investigado em 06/05/2026 — causa raiz identificada, correção pendente
**Componente:** `mcps/whatsapp-agent` + Edge Function `receive-message` no Supabase `gmpurkzxtvzqlvkqwjkp`
**Severidade:** alta — invalida análises de funil porque mensagens enviadas pelo Eric ficam separadas das mensagens recebidas dos contatos

---

## 1. Sintoma observado

Ao ler chats via `mcp__whatsapp-agent__read`, mensagens enviadas pelo Eric NÃO apareciam no chat do número do contato. O modelo respondeu várias vezes em sessão "o lead está esperando primeiro retorno" quando na verdade o Eric já tinha respondido — só que a resposta estava em outro chat duplicado, com `chat_id` no formato `<lid>@lid`.

Caso reproduzível: Simão Gomes (chat_name idêntico em 2 chats):
- `5511993395057` — recebe as mensagens dele (Pedro/Simão), mas só tem mensagens enviadas pelo Eric quando vieram via MCP `send`.
- `140484286627918@lid` — só mensagens `direction=sent` do Eric, enviadas do celular/WhatsApp Web (dispositivo linked). Nunca tem mensagens recebidas.

## 2. Diagnóstico — causa raiz

Comparando `raw_payload` das mensagens enviadas pelo Eric:

### 🟢 Mensagem enviada via MCP/script (chat número)

```json
{
  "chat_id": "5511993395057",
  "content": "...",
  "agent_name": "claude-code-local",
  "delay_typing": 13,
  "message_type": "text"
}
```

Vem do `send-message` Edge Function chamado pelo MCP — `chat_id` já está normalizado.

### 🔴 Mensagem enviada do celular (chat @lid)

Webhook `receive-message` recebe callback do Z-API:

```json
{
  "type": "ReceivedCallback",
  "phone": "140484286627918@lid",
  "chatLid": "140484286627918@lid",
  "chatName": "Simão Gomes",
  "fromMe": true,
  "connectedPhone": "5511996647492",
  "instanceId": "3F1FD2FAC1A801F1ED9506ABA24BC57F",
  "messageId": "3EB0BC4D60E451A3D4B2DA",
  "isGroup": false,
  "broadcast": false,
  "forwarded": false,
  "senderName": "Eric Luciano",
  "text": { "message": "..." }
}
```

Quando `fromMe=true` e a mensagem foi enviada de um dispositivo linked (WhatsApp Web/Business no celular), o Z-API entrega `phone` no formato **LID** (Linked Identifier — protocolo Multi-Device do WhatsApp). LID **não é o número do destinatário** — é um identificador interno opaco.

O webhook `receive-message` está usando `payload.phone` direto como `chat_id`, sem detectar o caso `fromMe=true && phone.endsWith('@lid')`. Resultado: cria um chat NOVO com `chat_id=<lid>@lid` em vez de atrelar a mensagem ao chat já existente do destinatário real.

## 3. Volume do estrago

Query rodada em 06/05/2026 contra `gmpurkzxtvzqlvkqwjkp.public.chats`:

- **6.146** chats não-grupo no total
- **125** chats com `chat_id` contendo `@lid`
- **81 pares duplicados** (mesmo `chat_name` aparece em chat_id numérico AND em chat_id `@lid`)

Exemplos de leads afetados (lista parcial): Alan Matheus, Allan Rodrigues (Suno), André Albergaria, Bryan Blandy, Bruno Vasconcelos, Caio Torres, Eduardo Pacheco, Juliana Cruz, Simão Gomes, Uirá.

## 4. Plano de correção

### Etapa 1 — Hotfix no webhook `receive-message`

Local: Edge Function `receive-message` no Supabase `gmpurkzxtvzqlvkqwjkp` (entrypoint `supabase/functions/receive-message/index.ts` no repo de origem).

**Mudança:** quando o payload chega com `fromMe=true && phone` terminando em `@lid`, NÃO usar `phone` como `chat_id`. Em vez disso:

1. **Tentativa A — resolver pelo `chatName`**: buscar `chats` onde `chat_name = payload.chatName AND chat_id ~ '^\d+$'`. Se achar match único, usar esse `chat_id`.
2. **Tentativa B — resolver via Z-API**: chamar `GET https://api.z-api.io/instances/{instanceId}/token/{token}/contacts/{lid}` para resolver LID → número.
3. **Tentativa C — cache de LID em tabela**: tabela nova `lid_mapping (lid TEXT PRIMARY KEY, phone TEXT, chat_name TEXT, resolved_at TIMESTAMPTZ)`. Se já tem mapping, usa direto. Se não, cai em A/B e popula.

Se as 3 tentativas falharem, fallback: salvar com `chat_id=<lid>@lid` mas marcar `metadata.lid_unresolved=true` para reprocessamento posterior.

**Pseudocódigo:**

```ts
async function resolveChatId(payload: ZAPIReceivePayload): Promise<string> {
  const { phone, fromMe, chatName, isGroup } = payload;

  // Casos triviais — passa direto
  if (isGroup) return phone; // grupos seguem com -group/@g.us
  if (!fromMe) return phone; // msg recebida usa phone do remetente normal
  if (!phone.endsWith('@lid')) return phone; // sent de número normal: ok

  // Caso problema: fromMe=true && phone é LID
  // 1. Cache
  const { data: cached } = await supabase
    .from('lid_mapping')
    .select('phone')
    .eq('lid', phone)
    .maybeSingle();
  if (cached?.phone) return cached.phone;

  // 2. Resolver pelo chat_name existente
  if (chatName) {
    const { data: existing } = await supabase
      .from('chats')
      .select('chat_id')
      .eq('chat_name', chatName)
      .not('chat_id', 'like', '%@lid')
      .not('chat_id', 'like', '%-group')
      .order('last_message_at', { ascending: false })
      .limit(1);
    if (existing?.[0]?.chat_id && /^\d+$/.test(existing[0].chat_id)) {
      const resolved = existing[0].chat_id;
      await supabase.from('lid_mapping').upsert({ lid: phone, phone: resolved, chat_name: chatName });
      return resolved;
    }
  }

  // 3. Resolver via Z-API
  try {
    const r = await fetch(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/contacts/${encodeURIComponent(phone)}`,
      { headers: { 'Client-Token': ZAPI_CLIENT_TOKEN } }
    );
    if (r.ok) {
      const j = await r.json();
      const resolved = j.phone || j.contact?.phone;
      if (resolved && /^\d+$/.test(resolved)) {
        await supabase.from('lid_mapping').upsert({ lid: phone, phone: resolved, chat_name: chatName });
        return resolved;
      }
    }
  } catch (_) {}

  // 4. Fallback — registra unresolved pra retry
  return phone; // mantém @lid mas pipeline downstream marca como pendente
}
```

### Etapa 2 — Migração: mesclar pares duplicados

Script SQL que pra cada par `(chat_numero, chat_lid)` com mesmo `chat_name`:

1. UPDATE `messages` SET `chat_id = <numero>`, `sender_phone = CASE WHEN sender_phone LIKE '%@lid' THEN <numero> ELSE sender_phone END WHERE chat_id = <lid>@lid`.
2. Atualizar `chats.<numero>.last_message_at = MAX(...)` e `total_messages` se houver coluna.
3. DELETE FROM chats WHERE chat_id = <lid>@lid.
4. INSERT INTO lid_mapping (lid, phone, chat_name) VALUES (<lid>, <numero>, <name>).

**SQL agregado (rodar no Supabase SQL editor):**

```sql
-- Cria tabela lid_mapping
CREATE TABLE IF NOT EXISTS lid_mapping (
  lid TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  chat_name TEXT,
  resolved_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lid_mapping_phone ON lid_mapping(phone);

-- Identifica pares duplicados (CTE)
WITH pairs AS (
  SELECT
    n.chat_id AS phone_chat_id,
    l.chat_id AS lid_chat_id,
    n.chat_name
  FROM chats n
  JOIN chats l USING (chat_name)
  WHERE n.is_group = false
    AND l.is_group = false
    AND n.chat_id ~ '^\d+$'
    AND l.chat_id LIKE '%@lid'
)
-- Move mensagens
, moved AS (
  UPDATE messages m
  SET chat_id = p.phone_chat_id,
      sender_phone = CASE
        WHEN m.sender_phone = p.lid_chat_id THEN p.phone_chat_id
        ELSE m.sender_phone
      END
  FROM pairs p
  WHERE m.chat_id = p.lid_chat_id
  RETURNING m.id, p.lid_chat_id
)
-- Popula mapping
, mapped AS (
  INSERT INTO lid_mapping (lid, phone, chat_name)
  SELECT lid_chat_id, phone_chat_id, chat_name FROM pairs
  ON CONFLICT (lid) DO UPDATE SET phone = EXCLUDED.phone
  RETURNING lid
)
-- Deleta chats órfãos
DELETE FROM chats c
USING pairs p
WHERE c.chat_id = p.lid_chat_id;

-- Atualiza last_message_at dos chats número
UPDATE chats c
SET last_message_at = (SELECT MAX(message_ts) FROM messages WHERE chat_id = c.chat_id)
WHERE c.chat_id IN (SELECT phone_chat_id FROM pairs);
```

**⚠️ Rodar primeiro num backup ou em transaction com SELECT pra validar.**

### Etapa 3 — Tratamento de chats `@lid` órfãos (sem par numérico)

Dos 125 chats `@lid`, ~81 têm par. Os outros ~44 são chats `@lid` SEM equivalente numérico — provavelmente conversas iniciadas pelo Eric com contatos que ele só tem como LID (nunca recebeu nada do número real).

Pra esses, opções:
- **A. Tentar resolver via Z-API contacts endpoint** → se conseguir, criar chat novo com número e mover mensagens.
- **B. Manter como está** mas marcar `metadata.is_lid_only=true` pra que `read`/`search` no MCP avisem do estado.
- **C. Deixar pra próxima mensagem recebida**: na primeira msg recebida do contato real, o webhook cria o chat numérico, e aí roda merge automático.

Recomendado: A com fallback C.

### Etapa 4 — Hardening do MCP `read`

Mesmo com migração + hotfix, casos novos podem aparecer (corrida entre webhook e read). Adicionar no `mcp__whatsapp-agent__read`:

- Antes de retornar mensagens, fazer query auxiliar: `SELECT chat_id FROM lid_mapping WHERE phone = $resolved_chat_id` → se tiver LIDs mapeados, fazer UNION ALL das mensagens dos chats LID associados, ordenando por `message_ts`.
- Resolver `to`/`chat` no `read` agora também procura em `lid_mapping`.

## 5. Testes de regressão

1. Enviar msg do celular pro Simão (já tem chat) → conferir que entra no chat número, não cria @lid.
2. Enviar msg do celular pra contato novo (sem chat prévio) → conferir que webhook resolve via Z-API ou cria com número, não @lid.
3. Receber msg do Simão → conferir que vai pro chat número.
4. Rodar `read` no MCP pra contatos da lista de duplicados → conferir thread única ordenada.
5. Rodar query `SELECT chat_id, count(*) FROM chats WHERE chat_name = 'Simão Gomes' GROUP BY 1` → deve retornar 1 linha.

## 6. Investigação prévia já feita (06/05/2026)

- Confirmado que MCP `whatsapp-agent` aponta pro Supabase `gmpurkzxtvzqlvkqwjkp` (config em `~/.claude.json`).
- Confirmado que MCP `index.js` (`/workspace/expert-mcps/mcps/whatsapp-agent/index.js`) já tem heurística de boost preferindo `chat_id` numérico sobre `@lid` no resolver (linhas 172, 312) — mas isso só ajuda quando AMBOS chats existem; não evita criação dos duplicados.
- Edge Function `receive-message` mora no projeto `gmpurkzxtvzqlvkqwjkp` (confirmar repo de origem; aparentemente `SuperSDR_Back` baseado nos paths do Supabase, mas pode ser um repo separado do whatsapp-agent — verificar).

## 7. Bloqueios atuais

- Sem acesso MCP ao projeto Supabase `gmpurkzxtvzqlvkqwjkp` (esta sessão tem acesso só a `togcwbwyzkatqqaizvrd` e `rzddcznusfilufymwgav`).
- Repo de origem da Edge Function `receive-message` precisa ser confirmado — o entrypoint listado nos metadados aponta pra `SuperSDR_Back`, mas isso é o projeto SDR, não o whatsapp-agent. Provavelmente os dois projetos compartilham a mesma codebase de Edge Functions, ou o whatsapp-agent tem repo próprio que não está clonado neste workspace.

## 8. Próximos passos (pra próxima sessão)

1. Localizar repo da Edge Function `receive-message` do projeto `gmpurkzxtvzqlvkqwjkp`.
2. Aplicar fix da Etapa 1 num branch.
3. Validar com 2-3 envios manuais antes de mergear.
4. Rodar migração da Etapa 2 em transaction com `BEGIN/ROLLBACK` primeiro pra revisar diff.
5. Aplicar Etapa 3 e 4.
6. Testes de regressão da Seção 5.

---

**Quem investigou:** Claude Code (sessão Eric, VPS Hostinger, 06/05/2026 ~16:50 BRT)
**Evidência primária:** payloads `raw_payload` salvos em `messages` IDs:
- `c95065ba-d2ba-4907-b0a3-254f83532867` (sent via MCP, chat número)
- `be4d9bfb-7e06-46b0-9ff7-97b8eee27b3d` (sent via celular, chat @lid)
