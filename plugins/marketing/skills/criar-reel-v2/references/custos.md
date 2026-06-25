# Custos de produção do Reel — taxas reais e simulação

Tabela de taxas pra estimar o custo de um reel **antes** de gastar crédito (etapa 2.5 do fluxo,
via `scripts/simular_custo.py`). Fonte primária: **CSV de uso real do HeyGen do Eric (14/06/2026)**
+ extrato Higgsfield (`hf account transactions`) + preços públicos ElevenLabs/OpenAI.

## Regra de o que entra no custo (definida pelo Eric)
- **Entra no caixa:** HeyGen (avatar), Higgsfield (B-roll), ElevenLabs (áudio), **imagens (se via API)**.
- **NÃO entra:** Claude (tokens) — assinatura que o Eric paga pra outras coisas. E imagens **se** forem
  geradas na assinatura (ChatGPT/Gemini na mão), aí são grátis.
- **O que o Eric quer no gate:** só o **custo total do vídeo** + "prosseguir?" — não o detalhe por clipe.

## Arquitetura: B-roll = imagem → Higgsfield anima (image-to-video)
Cada B-roll nasce de 1 imagem (frame) que o Higgsfield anima — dá mais controle que text-to-video.
Logo **todo vídeo gera N+1 imagens** (N frames de B-roll + 1 thumb), e o custo de imagem é intrínseco.

## HeyGen — créditos por segundo de avatar (medido no CSV do Eric)

| Engine | Modo | créditos/seg | ~créditos/min | US$/crédito |
|---|---|---|---|---|
| `avatar_iv` (premium) | **API** | **0,062** | ~3,7 | ~1,00 (API ≈ US$1/crédito) |
| `avatar_iv` (premium) | **plano** | **0,022** | ~1,4 | ~0,145 (Creator $29/200cr) |
| `avatar_video` (padrão) | **API** | **0,017** | ~1,0 | ~1,00 |
| `avatar_video` (padrão) | **plano** | ~0,006 *(extrapolado)* | ~0,4 | ~0,145 |

Achados-chave:
- **API ≈ US$ 1/crédito** (o "$" do dashboard = a coluna "Credits Used" do CSV, 1:1).
- **O MESMO avatar gasta ~3x menos crédito pelo plano do que pela API** (0,022 vs 0,062 cr/s).
- **`avatar_video` (padrão) gasta ~4x menos que `avatar_iv` (premium) na API** — alavanca de custo.
- O script da skill usa engine `avatar_v`, que o HeyGen contabiliza como `avatar_iv`.
- ⚠️ A taxa "20 créditos/min" de blogs estava **errada**; o real é 1,4–3,7 cr/min.

## Break-even API vs plano (HeyGen)
- Plano Creator: **US$ 29/mês = 200 créditos ≈ 143 min** de `avatar_iv`.
- API `avatar_iv`: ~US$ 3,7/min.
- **Vira a favor do plano a partir de ~8 min de avatar/mês** (~9 reels de ~52s). Acima disso, cada
  reel extra custa centavos até esgotar os 200 créditos.

## Higgsfield (B-roll)
- `veo3_1_lite` = **1 crédito por SEGUNDO** (confirmado: 4s=4cr, 6s=6cr, 8s=8cr). NÃO é por clipe.
- Pack ≈ US$ 5 / 100 créditos = **US$ 0,05/crédito → US$ 0,05/segundo** de B-roll (~R$ 0,26/s).
- **Escala pelo TOTAL de segundos de B-roll gerados**, não pelo nº de clipes. Cobrir o vídeo sem
  loop = ~duração do vídeo em créditos (52s → ~52 cr ≈ US$ 2,60 ≈ R$ 13). Loop gera menos footage = barato.
- Como a IMAGEM custa por unidade, usar clipes de **8s** (máximo do veo3_1_lite) cobre com menos
  clipes → menos imagens, mesmo total de segundos de Higgsfield.
- Sai da cota do plano starter — conta como custo de vídeo.

### Menu de modelos de B-roll (Higgsfield) — custo × qualidade (pesquisa jun/2026)
Custo = créditos/segundo × US$0,05. "B-roll 52s" = cobrir o reel sem loop.

| Modelo (`hf`) | cr/s | B-roll 52s | Qualidade i2v | Quando usar |
|---|---|---|---|---|
| `veo3_1_lite` **(default)** | 1,0 | ~R$13 | Boa, fidelidade à imagem ALTA, motion limpo, 1080p | Fundo dark/âmbar atrás do avatar — melhor custo×qualidade |
| `seedance1_5` | 1,2 | ~R$16 | Muito boa, melhor preservação da imagem do tier barato, 1080p | Testar como upgrade quase de graça |
| `wan2_7` | 1,5 | ~R$20 | Boa, forte em poeira/partícula, 1080p | Alternativa |
| `kling3_0` | 2,0 | ~R$26 | Topo em movimento/física, **Motion Brush**, até 4K | Travar o render e mover só 1 região (god rays/poeira) |
| `veo3_1` (cheio, basic) | 2,75 | ~R$36 | Topo, +40-60% consistência, 4K+áudio no Standard | Só "hero shot" em tela cheia |
| `seedance_2_0` | 4,5 | ~R$60 | #1 da arena i2v mas "mexe demais" + censura rosto | Evitar pro fundo |

Veredito pro caso do Eric (fundo render 3D escuro, god rays, 9:16, atrás do avatar): a **família Veo é #1**
pra esse look (motion blur film-like, god rays, drift de câmera limpo). Como é fundo a 1080p, o
`veo3_1_lite` já é o ponto ótimo. Subir pra Kling/Veo-cheio só compra 4K/física que o fundo não usa.

## ElevenLabs (áudio, integrado no HeyGen)
- Creator: **US$ 0,22 / 1.000 caracteres** (overage US$ 0,30/1k).
- Roteiro de ~940 caracteres ≈ US$ 0,21 ≈ R$ 1. Custo ínfimo (cobra por caractere).
- Pode estar embutido no HeyGen dependendo da integração — confirmar no dashboard ElevenLabs.

## Imagens (frames de B-roll + thumb) — API paga vs assinatura grátis
- Quantidade: **nº de clipes + 1** (1 frame por B-roll + 1 thumb).
- **API (paga):** o `openai_image.py` da skill chama `api.openai.com` (gpt-image-2) com a sk-proj key
  → **~US$ 0,21/imagem alta qualidade**. ESTE é o caminho automático da skill. Conta no caixa.
- **Assinatura (grátis):** imagem gerada na **interface** do ChatGPT/Gemini (Nano Banana) e jogada na
  pasta na mão. Não dá pra automatizar via script. Custo R$ 0.
- ⚠️ **Não dá pra saber pelo token** se é assinatura ou API — é decisão de fluxo. Por padrão, como a
  skill usa `openai_image.py`, é **API/paga**. Flag `--imagens assinatura` quando as imagens vierem da UI.
- Gemini Nano Banana via API: idem (pagaria por imagem); ajustar `--img-usd` se trocar de engine.

## Estimativa de duração (antes de gerar)
- Ritmo de fala medido: **~17,8 caracteres de roteiro por segundo** (938 chars → 52,8s).
- `duração_estimada_s ≈ total_de_caracteres ÷ 17,8`.

## Câmbio
- Default **R$ 5,10/US$** (jun/2026, faixa 5,08–5,19). Atualizar com `--cambio`.

## Nível de confiança (atualizado com o CSV do Eric)
- Custo real medido por reel: **10/10**.
- Taxas de consumo de crédito (api vs plano): **9/10** (dados reais do Eric).
- Conversão pra R$: **7/10** — US$ 1/crédito na API é inferência do "$" do dashboard; preço do
  plano ($29/200) é de blog. Confirmar o plano real da conta `asafesilva` pra fechar 10/10.
