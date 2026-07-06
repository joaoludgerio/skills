# Método — referência técnica do pipeline

Detalha o `SKILL.md`. A ideia central: o **avatar apresenta** e o **b-roll cobre**. O b-roll nasce de **imagem** (nítida e controlável) e ganha **movimento por ffmpeg** (Ken Burns) — sem modelo de vídeo, sem custo extra de animação.

## Por que cada passo
- **Avatar (HeyGen):** gera o apresentador falando o roteiro. A pessoa não grava. Vertical 720×1280 por padrão. A voz pode ser a nativa do HeyGen (mais simples) ou clonada via ElevenLabs (opcional).
- **gpt-image-2 (1536×1024) → corte 16:9 (`crop=1536:864:0:80`):** a imagem nasce em 3:2; o corte tira só topo/base. Por isso o prompt manda manter o conteúdo no centro 70% (área segura) — nada importante nas bordas de cima/baixo, que somem no corte.
- **Movimento (Ken Burns, ffmpeg `zoompan`):** dá zoom/pan suave a cada imagem (alterna zoom-in, pan, zoom-out a cada cena). Upscale 2× antes do `zoompan` reduz o tremor típico de zoom lento. Zoom máximo discreto (~18%) pra não parecer videogame. A imagem aprovada nunca se deforma — diferente de animar com IA de vídeo.
- **B-roll no rodapé:** faixa 16:9 (1080×608) embaixo, com uma borda fina no topo separando. O avatar fica inteiro em cima.
  - Modo `sobrepor` (padrão pro avatar HeyGen, que não tem legenda embaixo): avatar 1080×1920 inteiro, b-roll sobreposto no rodapé.
  - Modo `cortar` (se a fonte já tiver legenda embaixo): corta o "teto morto" acima da cabeça e empilha (`vstack`).
- **Gancho (cold open, opcional):** copia a frase mais forte pro comecinho, só o avatar, com efeito + faixa de texto, e transição `fadeblack` pro corpo. Prende nos primeiros segundos.
- **CTA no final (opcional):** um card fixo (cenas + oferta), colado com transição `xfade=fade:0.7` (sem corte seco).
- **Música de fundo:** SEMPRE discreta — `loudnorm=I=-34` (achata o crescendo pra não ir subindo) + `volume=0.38`, mixada com `amix normalize=0` (mantém a fala cheia e a música baixa). Nunca por cima da voz.

## Parâmetros de API (referência)
- **HeyGen** (avatar): `POST api.heygen.com/v2/video/generate` com `character.type:"avatar"` (+ `avatar_id`) e `voice` (`type:"text"` pra voz nativa, ou `type:"audio"` + `audio_url` + `input_text` pra áudio pré-gerado). Faça poll em `GET v1/video_status.get?video_id=` até `completed`; baixe o `video_url`. Pra hospedar áudio do ElevenLabs sem servidor próprio: `POST upload.heygen.com/v1/asset` (só usa a HEYGEN_API_KEY).
- **gpt-image-2** (imagens): `POST api.openai.com/v1/images/generations`, `size` 1536×1024 (ou 1024×1536 vertical pro CTA), `quality` high. Resposta em `data[0].b64_json`. Alternativas mais baratas: `gpt-image-1.5` ou `gpt-image-1-mini`.

## Ordem dos scripts
1. (o agente escreve o roteiro) → `1_avatar_heygen.py "roteiro"` → `avatar.mp4`. *(usa API HeyGen)*
2. (o agente escreve `cenas.json`) → `2_broll_imagens.py cenas.json pasta_img` → **aprovar as imagens**. *(usa API OpenAI)*
3. `3_broll_movimento.py pasta_img pasta_takes [dur_seg]` → takes com movimento. *(só ffmpeg)*
4. `4_montar.py avatar.mp4 pasta_takes montado.mp4 sobrepor` → avatar + b-roll. *(só ffmpeg)*
5. (opcional) `gancho.py avatar.mp4 ini fim efeito "FRASE" montado.mp4 com_gancho.mp4` *(só ffmpeg)*
6. `5_finalizar.py montado.mp4 final.mp4 [config/cta.mp4] [musica.mp3] [--4k]` *(só ffmpeg)*

## Gotchas
- **HeyGen `type:"audio"`** exige `input_text` junto, senão falha com "word time metadata is missing".
- `xfade`/`acrossfade` exigem timebase igual: `settb=AVTB` dos dois lados (já está nos scripts).
- `zoompan` em zoom lento pode tremer → os scripts já fazem upscale 2× antes pra suavizar.
- No Windows, garanta a variável `TEMP` setada (os scripts usam ela pra arquivos temporários, ex. a faixa do gancho).
- O número de cenas do b-roll ≈ duração do avatar ÷ duração por take (~5s). O `4_montar.py` distribui os takes igualmente ao longo do vídeo.
