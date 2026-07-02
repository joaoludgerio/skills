# Kling API (oficial) — referência de uso

Geração de B-roll por **image-to-video** na API oficial do Kling (Kuaishou). O script
`scripts/kling_i2v.py` cuida da assinatura JWT, do envio, do polling e do download.

## Credenciais
- Ficam em `C:\MCPs\kling.env`. Dois modos, o script aceita os dois (chave única tem prioridade):
  - **Atual (novo modelo Kling):** `KLING_API_KEY=...` — chave única bearer, usada direto sem JWT.
  - **Legado (JWT):** par `KLING_ACCESS_KEY=...` + `KLING_SECRET_KEY=...` — só usado se
    `KLING_API_KEY` não estiver definida.
- **IMPORTANTE:** o saldo de **API é separado da assinatura do site**. É pré-pago (resource pack)
  no console de desenvolvedor do Kling. Se o submit/poll retornar `code 1102 "Account balance not enough"`,
  o saldo de API acabou, avisar o Eric pra comprar um pacote. (Nenhum crédito é gasto num submit recusado.)

## Detalhes técnicos (já implementados no script)
- Host: `https://api.klingai.com` (cai pro `https://api-singapore.klingai.com` se as chaves forem de outra região).
- Auth: com `KLING_API_KEY`, `Authorization: Bearer <chave>` direto. Sem ela, JWT HS256 legado:
  header `{alg:HS256,typ:JWT}`, payload `{iss:ACCESS_KEY, exp:+1800s, nbf:-5s}`, `Authorization: Bearer <jwt>`.
- Endpoint: `POST /v1/videos/image2video` · corpo: `model_name, image(base64), prompt, negative_prompt, cfg_scale, mode, duration`.
- Polling: `GET /v1/videos/image2video/{task_id}` → checar `code` da resposta primeiro (token pode
  expirar no meio do poll); depois `data.task_status` (`submitted`→`processing`→`succeed`) → vídeo em
  `data.task_result.videos[0].url`. `code 1102` = sem saldo; mensagem de "risk control"/moderação =
  imagem barrada (ajustar a imagem, ex: vestir figuras nuas).
- A imagem vai em **base64 puro** (sem prefixo `data:`). O script faz o encode dos frames locais, não precisa subir em lugar nenhum.
- Cada clipe `std` 5s leva ~2 min. Rodar em **background** (são vários em sequência).

## Modelos
- Default `kling-v1-6` (bom custo/qualidade, amplamente disponível). Trocar no manifesto via `"model"`.
- `mode`: `std` (mais barato/rápido) ou `pro` (mais caro/melhor). `duration`: `"5"` ou `"10"`.

## Manifesto (o que o script lê)
```json
{
  "frames_dir": "C:/Users/Joao/Downloads/<reel>/frames",
  "output_dir": "C:/Users/Joao/Downloads/<reel>",
  "model": "kling-v1-6", "mode": "std", "duration": "5",
  "clips": [
    {"n": 1, "frame": "frame-01.png", "prompt": "descrição do MOVIMENTO a partir do frame ..."}
  ]
}
```
O `prompt` de cada clipe descreve o **movimento** (a imagem já é o quadro inicial): o que se move,
para onde, e o movimento de câmera (ex: "slow push-in", "slow orbit", "side tracking").

## Rodar
```bash
python scripts/kling_i2v.py <manifest.json>        # todos
python scripts/kling_i2v.py <manifest.json> 1 2 3  # só alguns (re-disparo de falhas)
```
Saída: `clip-01.mp4 ... clip-NN.mp4` em `output_dir`. Conferir integridade com ffprobe ao final.
