# Meta Ads — config, sequência de publicação e upload de mídia

MCP oficial do Meta Marketing API (servidor `b2aeb035-...`). **Tudo que ele cria nasce PAUSADO** —
nada entra em entrega até o João dar play no Gerenciador.

## IDs conhecidos (verifique frescos no runtime — podem mudar)

| Item | Valor conhecido (memória `project_super-sdr`) | Como confirmar no runtime |
|---|---|---|
| Conta de anúncios | `act_1188676845428776` (CA - Expert Integrado) → no MCP, use **`1188676845428776`** (sem `act_`) | `ads_get_ad_accounts` |
| Página FB | `637371329452268` | `ads_get_ad_account_pages` |
| Conta Instagram | (descobrir) | `ads_get_ig_accounts` → `instagram_user_id` |
| Pixel/Dataset (p/ conversão) | (descobrir) | `ads_get_datasets` |
| App ID | `2266676070529845` (GRAPH API LOVABLE) | — (só p/ upload Graph API) |
| Token Graph API | `.env.meta` (expirou em **09/06/2026**, VENCIDO desde então) | renovar antes de usar upload direto |
| Moeda / mín. diário | BRL / ler `min_daily_budget_cents` | `ads_get_ad_accounts` |

> O **MCP tem auth própria** (não usa o `.env.meta`) — `ads_create_*` funcionam mesmo com o token do
> `.env.meta` vencido. O `.env.meta` só importa pro **upload de mídia via Graph API (Via A)** abaixo.

> ⚠️ **Token vencido, é fato, não hipótese.** O token do `.env.meta` expirou em 09/06/2026; hoje já
> passou disso, então ele está vencido com certeza. Se o plano da campanha exigir upload direto via
> Graph API (Via A), o **passo zero é renovar o token** (Gerenciador de Negócios → token de sistema)
> antes de tentar qualquer coisa; não tente a Via A sem renovar primeiro, vai falhar. Por isso a via
> padrão desta skill é a **Via B (URL pública)** ou a **Via C (promover post existente)** abaixo, que
> não dependem do `.env.meta`. Só use a Via A depois de confirmar com o João que o token foi renovado.

## Passo 0 — descoberta (sempre, no início da Fase 4)

0. Confirme se o MCP de Meta Ads está configurado neste ambiente (veja o gate no `SKILL.md`, Fase 4).
   Se não estiver, pare aqui e não siga os passos abaixo.
1. `ads_get_ad_accounts` → confirme o ID numérico, a moeda e `min_daily_budget_cents`.
2. `ads_get_ad_account_pages` → page_id (e se for lead form, confira `leadgen_tos_accepted=true`).
3. `ads_get_ig_accounts` → `instagram_user_id` (sem ele o criativo NÃO entrega no Instagram).
4. Se objetivo de conversão (cursos R$97): `ads_get_datasets` → `pixel_id` pro `promoted_object`.

## Budget em centavos (BRL)

Tudo em centavos. R$25,00 = `2500`; R$50,00 = `5000`; R$350 lifetime = `35000`. Nunca passe reais.

## Sequência de criação (tudo PAUSADO)

### 1. Campanha — `ads_create_campaign` (CBO, padrão)
- `ad_account_id` (sem `act_`), `campaign_name`, `objective` (ODAX — ver `produtos.md`), `buying_type:"AUCTION"`.
- **CBO:** passe `campaign_daily_budget` OU `campaign_lifetime_budget` (centavos) aqui. Bid strategy
  default `LOWEST_COST_WITHOUT_CAP` (ok pra começar).
- `special_ad_categories`: `"[]"` — os produtos da Expert **não** são habitação/crédito/emprego/política.
- A resposta traz `valid_optimization_goals` e `recommended_optimization_goal` — **use só esses** no conjunto.

### 2. Conjunto — `ads_create_ad_set`
- `campaign_id`, `ad_set_name`, `billing_event` (geralmente `IMPRESSIONS`), `optimization_goal`
  (da lista válida), `targeting`.
- **Não** passe budget no conjunto se a campanha é CBO (é rejeitado). Só em ABO.
- **Targeting broad (default):** `{"geo_locations":{"countries":["BR"]},"age_min":25,"age_max":65}`.
  Advantage+ Audience fica ligado por padrão (idade vira sugestão). Pra travar idade, setar
  `targeting_automation.advantage_audience:0`.
- **Interesse/cargo:** NUNCA invente ID. Se for segmentar (ex: verticais do Super SDR), busque o ID
  real antes (tool de targeting search do MCP) e só então monte `flexible_spec`.
- **promoted_object:** obrigatório quando otimização é `OFFSITE_CONVERSIONS`/`VALUE`/`LEAD_GENERATION`/
  `QUALITY_LEAD`. Ex conversão: `{"pixel_id":"...","custom_event_type":"PURCHASE"}`. Ex lead form/WhatsApp:
  `{"page_id":"637371329452268"}`.
- **destino:** `CONVERSATIONS`→`destination_type:"WHATSAPP"` (exige page_id no promoted_object);
  conversão web→`WEBSITE`; lead form→form nativo.
- **Lifetime budget (ABO):** exige `end_time`.

### 3. Criativo — `ads_create_creative`
- `ad_account_id`, `page_id`, e **`instagram_user_id`** (pra entregar no IG).
- `link_url` (destino), `message` (texto principal), `headline`, `description`, `call_to_action_type`.
- **Imagem:** `image_hash` (preferido, do upload) OU `image_url` (URL pública). Um só, nunca os dois.
- **Vídeo:** `video_id` (do upload) + `image_hash`/`image_url` como **thumbnail** (capa).
- `name`: nome do criativo na biblioteca (use o naming abaixo).

### 4. Anúncio — `ads_create_ad`
- `ad_set_id`, `ad_name`, `creative` (`{"creative_id":"<id do passo 3>"}`).

### 5. Validação
- `ads_get_ad_preview` por anúncio (confira render, texto, CTA, destino).
- Opcional: `ads_get_opportunity_score` na conta.

## Upload de mídia (o MCP NÃO sobe mídia)

`ads_create_creative` precisa de `image_hash`/`video_id` (ou URL pública). Duas vias:

### Via A — Graph API com o token do `.env.meta` (dark post; exige token renovado)
O token do `.env.meta` está vencido desde 09/06/2026. Só use esta via depois de o João confirmar que
renovou o token; do contrário, use a Via B ou a Via C abaixo. Use Bash + o token. **Imagem** (retorna
`hash`):
```bash
curl -s -F "filename=@criativos/peca.png" \
  -F "access_token=$META_TOKEN" \
  "https://graph.facebook.com/v21.0/act_1188676845428776/adimages"
```
**Vídeo** (retorna `id` = `video_id`):
```bash
curl -s -F "source=@criativos/video.mp4" \
  -F "access_token=$META_TOKEN" \
  "https://graph.facebook.com/v21.0/act_1188676845428776/advideos"
```
Carregue `META_TOKEN` do `.env.meta`. Vídeo demora a processar — aguarde ficar `ready` antes de criar
o criativo. **O token está vencido**: peça ao João pra renovar (Gerenciador de Negócios → token de
sistema) antes de prosseguir, esse é o passo zero desta via.

### Via B — imagem por URL pública (via padrão pra imagem, não depende de token)
Se a imagem já estiver hospedada (Cloudinary, biblioteca etc.), passe `image_url` direto no
`ads_create_creative` e pule o upload da imagem. (Vídeo não tem essa via — precisa de `video_id`.)

### Via C — promover post existente (alternativa pra vídeo)
Se preferir não fazer dark post: publique o vídeo como post no IG/FB e use `object_story_id`
(`"pageID_postID"`) no criativo, ou `ads_boost_ig_post`. Isso deixa o post **orgânico** também.

## Naming (siga o histórico Super SDR)

- Campanha: `[PRODUTO] Objetivo - Descrição` — ex: `[SUPER SDR] Leads - Qualificação Comercial IA`
- Conjunto: público/segmento — ex: `Broad BR 25-65`, `Vertical Advocacia`
- Anúncio/criativo: ângulo + formato — ex: `Custo Reunião Estático 1080x1350`

## Checklist final antes de entregar o relatório
- [ ] Campanha, conjunto(s), criativo(s) e anúncio(s) criados e **PAUSADOS**
- [ ] `instagram_user_id` no criativo (senão não entrega no IG)
- [ ] `promoted_object` presente quando a otimização exige
- [ ] Budget em centavos, ≥ mínimo da conta
- [ ] Preview conferido em cada anúncio
- [ ] `relatorio.md` com IDs + links do Gerenciador por nível
