---
name: criar-reel-v2
description: "Produz um Reel do Instagram PRONTO PRA POSTAR de ponta a ponta na voz do Eric (Expert Integrado): entende a pauta, confere os fatos, escreve o roteiro, gera o vídeo do avatar do Eric no HeyGen (Avatar V), gera os B-rolls (GPT Image 2 + Higgsfield), compõe as camadas (Eric recortado sobre B-roll), queima a legenda amarela, gera a thumb e a página de CTA no Notion. VERSAO 2 (motores alternativos: imagens no GPT Image 2 da OpenAI, video no Higgsfield). Usar quando o Eric pedir explicitamente a v2/versao do Higgsfield: 'cria um reel v2', 'reel com higgsfield', 'testa a v2', 'faz um vídeo pro Instagram do [tema]', 'monta o reel do [ferramenta/assunto]', 'produz o vídeo completo', ou colar um link/repo/vídeo pra virar Reel."
argument-hint: "[tema | url | repo | video-gravado.mp4] [--clips N] [--sem-thumb] [--sem-broll] [--manual]"
allowed-tools: Read, Write, Edit, Bash, WebFetch, WebSearch, Glob
---

# Criar Reel v2 (Eric / Expert Integrado) — GPT Image 2 + Higgsfield

Produz um Reel **pronto pra postar** a partir de uma pauta. Dois modos:

- **Automático (default):** a fala é gerada no HeyGen com o avatar do Eric. Entrada = pauta.
- **Manual (`--manual` ou quando o Eric mandar um vídeo gravado):** a fala é o vídeo dele.
  Mesmo fluxo, trocando a etapa 3 pelo recorte com rembg.

Antes de começar, ler `references/voz-eric.md` — toda a parte de texto sai nessa voz.

## Fluxo (9 etapas + gate de custo na 2.5)

### 1. Pauta e fatos
- Pauta pode ser tema, link ou repositório. Se vier URL/repo, usar `WebFetch`/`WebSearch` pra extrair
  o que é, números, instalação, diferencial. **Nunca inventar dado** — conferir versões, estrelas,
  preços, criador. Se a referência (ex: Reel viral copiado) estiver errada, corrigir e avisar.
- Se a pauta for aberta ("acha um tema"), pesquisar o que tá viral, propor conceito com hook, CTA e
  ângulo, e **aguardar aprovação do Eric antes de gastar crédito**.

### 2. Roteiro (voz do Eric)
- Estrutura de `references/voz-eric.md`: Hook (0-3s) → o que é → tradução pro dono de empresa → CTA
  de comentário (palavra curta, única por Reel). Alvo 40-60s (~120-140 palavras).
- Entregar também a **legenda do post** (ângulo diferente do roteiro) + hashtags.
- **Quebrar o roteiro em CENAS de 1-2 frases** (arquivo `cenas.txt`, uma cena por linha). Script
  inteiro de uma vez no HeyGen degrada a qualidade — regra do Eric, ~9-12 cenas por vídeo.
- **Pronúncia no texto das cenas:** escrever "CLAUDI" no lugar de "Claude" e termos em inglês por
  extenso ("last thirty days") — senão o TTS fala errado. A LEGENDA mostra a grafia certa.
- **Plano de B-rolls (default do Eric):** VÁRIOS clipes distintos que cobrem o vídeo inteiro **sem
  loop** — nunca poucos clipes repetindo. Nº ≈ `ceil(duração ÷ duração-do-clipe)` (clipe de 8s →
  ~7 pra um reel de 52s; de 6s → ~9). Cada B-roll = **conceito visual relevante ao tema daquele
  trecho da fala** (não aleatório). Listar conceito de cada um; é o que entra no gate de custo 2.5.

### 2.5. GATE de custo (OBRIGATÓRIO — antes de gastar crédito)
**NÃO invocar HeyGen, Higgsfield nem geração de imagem antes do "sim" do Eric.**
1. **Rodar a simulação:**
   `python scripts/simular_custo.py --cenas-file <reel>/cenas.txt --clips N [--engine avatar_iv|avatar_video] [--modo api|plano] [--imagens api|assinatura] [--cambio 5.10]`
2. **Mostrar só o essencial:** o **custo total estimado** e a pergunta **"esse vídeo vai custar ~R$ X. Prosseguir?"**.
   NÃO precisa detalhar o que cada B-roll vai ser — o Eric quer o custo do vídeo como um todo.
3. **Parar e aguardar o "sim".** Se não, ajustar e re-simular. Alavancas: `--engine avatar_video`
   (~4x mais barato), `--modo plano` (~3x menos crédito), menos clipes, roteiro mais curto.
- **Imagens (1 frame por B-roll + 1 thumb) sempre entram na conta.** O custo depende de COMO são feitas:
  - **API** (o `openai_image.py` da skill usa a API PAGA da OpenAI) → `--imagens api` (~US$0,21/img). Default.
  - **assinatura** (imagem feita na mão no ChatGPT/Gemini e jogada na pasta) → `--imagens assinatura` (grátis).
  - Não dá pra detectar pelo token; é decisão de fluxo. O caminho automático da skill = API/paga.
- Regra de caixa: HeyGen + Higgsfield + ElevenLabs + imagens(se API) contam. Claude (tokens) é coberto.
- Taxas reais e nível de confiança: `references/custos.md`.

### 3a. Vídeo do avatar (modo automático — HeyGen)
- **Pré-requisito: OK do Eric na etapa 2.5.** Só rodar daqui pra frente depois da aprovação.
- `python scripts/heygen_video.py --scenes-file cenas.txt --out-dir <reel>/heygen` (background).
- O script usa SEMPRE: Avatar V, o avatar e a voz do credentials.env, fundo verde
  `#00FF00` com `remove_background: true`, 1080x1920. Gera 1 vídeo por cena e concatena.
- Erro `MOVIO_PAYMENT_INSUFFICIENT_CREDIT` = crédito de API acabou (separado da assinatura — avisar).
- **Checkpoint de voz (automático no script):** o HeyGen às vezes troca a voz por uma feminina
  genérica. Cada cena baixada é verificada com embedding de locutor (`verificar_voz.py`) e
  regenerada sozinha se sim < 0.5. Se o script abortar com "voz errada após 3 tentativas", avisar.
- Conferir 1 frame do resultado (`Read`): fundo tem que estar verde chapado.

### 3b. Recorte (modo manual — vídeo gravado sem fundo verde)
- `python scripts/rembg_video.py <video> <reel> [--crop W:H:X:Y]` (background, ~5 min). Detectar a
  área útil antes (vídeo pode vir encaixotado em 16:9). Modelo default `isnet-general-use`
  (NÃO usar u2net_human_seg — abre buraco no microfone/objetos).

### 4. SRT (legenda da tela)
- Rodar o `gerar_srt.py` da skill `gerar-srt` no vídeo da fala (modelo `medium`).
- **Revisar o .srt**: corrigir termos ("Cláudio"→"Claude", "Haja"→"Aja", a palavra do CTA). A duração
  real do vídeo define o nº de B-rolls: `ceil(duração ÷ 5)`.

### 5. Frames-base dos B-rolls (GPT Image 2 / OpenAI)
- Ler `references/visual-broll-thumb.md` (mesmo estilo dark+âmbar, 9:16, SEM texto, figuras
  SEMPRE vestidas).
- **REGRA 1 — relevância (a mais importante):** cada frame TEM que representar o que está sendo
  **falado naquele trecho** do roteiro. Nada de imagem aleatória. Mapear cena→conceito: o frame-NN
  ilustra exatamente o assunto da fala que toca por cima dele (ex: fala "atende no WhatsApp" →
  frame com balões de conversa; fala "manifesto ambiental" → frame com documentos/selo).
- **REGRA 2 — tamanho do vídeo (9:16):** gerar retrato `--size 1024x1792` (default). O frame e o
  clipe final têm que ser 9:16 cheios, sem barra preta. (Garantir o 9:16 no vídeo = etapa 6.)
- `python scripts/openai_image.py --prompt "..." --out <reel>/frames/frame-NN.png --quality high`
  (modelo gpt-image-2, retrato; chave em credentials.env). A thumb (etapa 8) também sai daqui.

### 6. B-rolls (Higgsfield)
- Gerar os B-rolls do plano (quantidade já travada no gate de custo 2.5). Cada clipe = a imagem
  da etapa 5 animada pelo Higgsfield (image-to-video) — esse é o caminho padrão (mais controle).
- **OBRIGATÓRIO — forçar 9:16 vertical no manifesto.** O `veo3_1_lite` tem `aspect_ratio` default
  `16:9` → sai DEITADO com barra preta se não passar o flag (foi o bug do clip-02). Sempre:
  `"hf_flags": ["--aspect_ratio", "9:16"]` (nota: underscore, não hífen). Confirmar que o modelo
  escolhido aceita 9:16 com `hf model get <model>` antes do lote.
- **Ritmo dos cortes (regra do Eric):** vários clipes distintos cobrindo o vídeo SEM loop, cada um
  relevante ao tema daquele momento — MAS o corte do B-roll **não** casa exato com o corte da fala
  (cortar igual à fala fica mecânico/ruim). Os cortes seguem o ritmo do próprio B-roll (~6-8s por
  clipe), naturalmente defasados da fala. O `compose_reel.py` já concatena os clipes em ordem e
  corta pela duração do clipe (não pelo SRT), então basta ter clipes suficientes pra cobrir sem
  loop. Mais clipes = mais crédito Higgsfield (o gate 2.5 mostra).
- Escrever `<reel>/manifest.json` no MESMO formato da v1, com `"model"` = modelo de vídeo do
  Higgsfield (listar com `hf model list --video`), `"hf_flags": ["--aspect_ratio","9:16"]`.
- Validar 1 clipe antes do lote: `python scripts/higgsfield_i2v.py manifest.json 1` (background).
  Conferir com `ffprobe` que saiu **1080x1920 (9:16)** antes de disparar o lote.
- Lote: `python scripts/higgsfield_i2v.py manifest.json 2 3 ...`. Conferir com ffprobe; re-disparar
  só os que falharem. Requer `hf auth login` feito uma vez (sessão fica salva).
- Saldo/custos: `hf account` · custo estimado: `hf generate cost <model> --prompt ...`.

### 7. Composição final
- `python scripts/compose_reel.py --avatar <fala> --brolls-dir <reel> --srt <corrigido>.srt --out final.mp4`
  - Modo automático (fundo verde): só isso — o chromakey é default.
  - Modo manual (rembg): adicionar `--fg-seq <reel>/fg-out --fg-fps 25`.
- Layout: B-roll em tela cheia no fundo o tempo todo + Eric recortado embaixo no centro (~69% da
  altura) + legenda amarela bold no terço superior (acima da cabeça). O script converte o SRT em
  .ass com estilo explícito (NÃO usar force_style do ffmpeg — posiciona errado).
- **Conferir 3 frames** do resultado (início/meio/fim) com `Read` antes de entregar.

### 8. Thumb
- Seção "Thumb" de `references/visual-broll-thumb.md`: fotográfico realista, headline branca caixa
  alta no topo (3-4 palavras) + selo/pill âmbar com a palavra do CTA. Salvar **DENTRO da pasta do
  reel**: `<reel>/thumb-<tema>-reels.png` e conferir com `Read`.

### 9. Página do CTA (Notion)
- Criar via Notion MCP como página na RAIZ do workspace (padrão das outras: Fable 5, comandos,
  radar). Conteúdo: o material prometido no CTA (guia de instalação, prompts prontos etc.), na voz
  do Eric, com crédito ao criador da ferramenta. Se a busca retornar conteúdo da Dust2/Counter-Strike,
  o conector tá no workspace errado — avisar o usuário.

## Saídas (TUDO dentro da pasta do reel — nada solto em Downloads)
- `<reel>/video-final-*.mp4` — pronto pra postar (composto + legendado).
- `<reel>/legenda-post.md` — legenda do post + hashtags + palavra do CTA + link da página do Notion.
- `<reel>/thumb-<tema>-reels.png` — a thumb.
- Página no Notion (link no chat e no legenda-post.md).
- `<reel>/` = `<pasta-de-saida>/<reel>/` com cenas, frames, clipes, manifest, SRT/ASS.

## Flags
- `--clips N` força N clipes · `--sem-thumb` / `--sem-broll` pulam etapas · `--manual` modo gravado.

## Skills relacionadas
- `cortar-respiros` — só pro modo manual (avatar do HeyGen não respira).
- `gerar-srt` — usada na etapa 4 (e isolada quando o Eric já editou um vídeo por fora).

## Notas / edge cases
- Python no Bash do Windows: paths com barra normal (`C:/...`).
- Crédito de API: HeyGen e Kling têm crédito separado da assinatura dos sites. Submit recusado não gasta.
- Saldo do Kling acabou no meio: re-disparar só os que faltam (`... manifest.json 7 8 9`).
- Cena do HeyGen com pronúncia errada: regenerar SÓ a cena (`--text "..."`), substituir o scene-NN.mp4,
  re-concatenar e rodar o Whisper de novo (timestamps mudam).
- Vídeo gravado mais longo que os B-rolls: gerar clipes extras (o compose loopa, mas repetir B-roll é feio).

## Recursos
- **`scripts/heygen_video.py`** — HeyGen API v3 multi-cena (Avatar V, fundo verde, checkpoint de voz, concat).
- **`scripts/verificar_voz.py`** — verificação de locutor (sherpa-onnx; ref em assets/voice-ref.wav).
- **`scripts/openai_image.py`** — frames/thumb via GPT Image 2 (OpenAI).
- **`scripts/higgsfield_i2v.py`** — runner do Higgsfield (mesmo manifesto da v1 → MP4s).
- **`scripts/kling_i2v.py`** — runner do Kling (mantido como fallback).
- **`scripts/rembg_video.py`** — recorte por IA pra vídeo sem fundo verde (isnet-general-use).
- **`scripts/compose_reel.py`** — composição (chromakey/alpha + B-roll + legenda .ass estilizada).
- **`scripts/simular_custo.py`** — simulação de custo R$/US$ (etapa 2.5, antes de gastar crédito).
- **`references/custos.md`** — taxas reais (HeyGen/Higgsfield/ElevenLabs), break-even API×plano, confiança.
- **`references/voz-eric.md`** — tom, blacklist e estrutura de roteiro.
- **`references/kling-api.md`** — API do Kling, manifesto, troubleshooting.
- **`references/visual-broll-thumb.md`** — estilo dos frames e da thumb.
