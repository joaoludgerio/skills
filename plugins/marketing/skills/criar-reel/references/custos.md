# Custos de produção do Reel v3 — taxas reais + o que falta confirmar

Tabela pra estimar o custo de um reel **antes** de gastar crédito (etapa 2.5 do fluxo,
via `scripts/simular_custo.py`). A v3 é mais barata que a v2: a fala sai do **ElevenLabs**
(barato) com o HeyGen só no **lip-sync**, e os B-rolls vêm **primeiro do banco remoto
(grátis)** — o Kling só cobre os gaps.

## O que entra no caixa (regra do Eric)
- **Entra:** HeyGen (lip-sync), ElevenLabs (fala), imagens (se via API), Kling (só gaps).
- **NÃO entra:** Claude (tokens, assinatura). Banco de B-roll (grátis). Imagens feitas na
  assinatura (ChatGPT/Gemini na mão).
- **No gate, o Eric quer só:** o custo total do vídeo + "prosseguir?".

## HeyGen — lip-sync (créditos por segundo de avatar; CSV do Eric 14/06/2026)
| Engine | Modo | créditos/seg | US$/crédito |
|---|---|---|---|
| `avatar_iv` (Avatar V, **default**) | API | 0,062 | ~1,00 |
| `avatar_iv` | plano | 0,022 | ~0,145 |
| `avatar_video` (padrão, ~4x + barato) | API | 0,017 | ~1,00 |
| `avatar_video` | plano | ~0,006 *(extrapolado)* | ~0,145 |
- A v3 manda `audio_asset_id` pro Avatar V (lip-sync) → o HeyGen contabiliza como `avatar_iv`.
- `avatar_video` é a alavanca de custo se a qualidade do lip-sync permitir.
- Plano Creator US$29/200 créditos ≈ 143 min de `avatar_iv` — vira a favor do plano a partir
  de ~8 min de avatar/mês.

## ElevenLabs (fala) — a economia que justifica a v3
- Creator/Pro: **US$ 0,22 / 1.000 caracteres**. Roteiro ~940 chars ≈ US$ 0,21 ≈ R$ 1.
- Substitui o TTS interno do HeyGen (que custava ~US$ 10-11/min cena-a-cena). É o motivo da v3.

## B-roll — banco grátis primeiro, Kling só nos gaps
- **Banco remoto** (~219 clips reutilizáveis, GitHub Release): **R$ 0**. A v3 tenta o banco
  primeiro (etapa 6) → na maioria dos reels o Kling fica perto de zero.
- **Kling** (só pros trechos que o banco não cobre): saldo de **API pré-pago**, separado da
  assinatura do site.
  > ⚠️ **Preço por clipe/segundo do Kling NÃO confirmado.** O `kling-api.md` não traz a tabela
  > e o resource pack varia. Por isso o simulador marca o Kling como **"a confirmar"** em vez
  > de inventar um número (gate honesto > falsa precisão). **Como fechar:** rodar 1 clipe de
  > teste (`kling_i2v.py manifest.json 1`) e ver quanto o console do Kling debitou → registrar
  > a taxa US$/clipe aqui e plugar no simulador.
- **Fallback Higgsfield** (se o Kling falhar/sem saldo): `veo3_1_lite` = US$ 0,05/seg de B-roll
  (~R$ 0,26/s) — referência herdada da v2.

## Imagens (frames + thumb) — só pros gaps do Kling
- Quantidade: **nº de clips do Kling + 1** (1 frame por gap + 1 thumb). Clips do banco NÃO
  geram frame (já são vídeo pronto).
- **API (paga):** `openai_image.py` (gpt-image-2) ≈ **US$ 0,21/imagem**. Caminho default.
- **Assinatura (grátis):** imagem feita na UI do ChatGPT/Gemini e jogada na pasta na mão
  (`--imagens assinatura`).

## Estimativa de duração e câmbio
- Ritmo de fala medido: **~17,8 caracteres/segundo** → `duração_s ≈ chars ÷ 17,8`.
- Câmbio default **R$ 5,10/US$** (jun/2026). Atualizar com `--cambio`.

## Nível de confiança
- HeyGen / ElevenLabs / imagens: **alto** (taxas reais do uso do Eric).
- **Kling: pendente** — fechar com 1 medição real. Até lá, o gate imprime
  "custo conhecido (R$X) + Kling a confirmar" e nunca um total inventado.
