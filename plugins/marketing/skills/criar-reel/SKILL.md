---
name: criar-reel
description: "Produz um Reel do Instagram PRONTO PRA POSTAR de ponta a ponta na voz do Eric (Expert Integrado): entende a pauta, confere os fatos, escreve o roteiro, gera a FALA no ElevenLabs (voz Eric Profissional) em blocos de até 20s e faz só o LIP-SYNC no HeyGen (Avatar V, audio_asset_id) — fala a US$4/min em vez de US$10-11. B-rolls com GPT Image 2 (imagens) + Kling direto (vídeo, Higgsfield como fallback), composição, legenda amarela, thumb e página de CTA. Versão padrão de produção (validada 11/06/2026). Usar quando o Eric pedir 'cria um reel', 'reel com elevenlabs', 'reel barato', ou qualquer pedido de reel."
argument-hint: "[tema | url | repo | video-gravado.mp4] [--clips N] [--sem-thumb] [--sem-broll] [--manual] [--block-seconds N]"
allowed-tools: Read, Write, Edit, Bash, WebFetch, WebSearch, Glob
---

# Criar Reel (Eric / Expert Integrado) — ElevenLabs + HeyGen lip-sync

> **STATUS: validado em 11/06/2026** (teste reel-quanto-custa-a-hora, blocos OK, voz OK,
> emenda OK). A diferença pra v2 é SÓ a etapa 3a (fala). Objetivo: derrubar o custo do
> HeyGen (TTS interno cena-a-cena ≈ US$10-11/min) gerando o áudio no ElevenLabs
> (conta Pro, 1,5M chars/mês) e usando o HeyGen apenas pro lip-sync em blocos de até 20s.

Produz um Reel **pronto pra postar** a partir de uma pauta. Dois modos:

- **Automático (default):** a fala é gerada no HeyGen com o avatar do Eric. Entrada = pauta.
- **Manual (`--manual` ou quando o Eric mandar um vídeo gravado):** a fala é o vídeo dele.
  Mesmo fluxo, trocando a etapa 3 pelo recorte com rembg.

Antes de começar, ler `references/voz-eric.md` — toda a parte de texto sai nessa voz.

## Fluxo (10 etapas — gate de orçamento na 2.5)

### 1. Pauta e fatos
- Pauta pode ser tema, link ou repositório. Se vier URL/repo, usar `WebFetch`/`WebSearch` pra extrair
  o que é, números, instalação, diferencial. **Nunca inventar dado** — conferir versões, estrelas,
  preços, criador. Se a referência (ex: Reel viral copiado) estiver errada, corrigir e avisar.
- Se a pauta for aberta ("acha um tema"), pesquisar o que tá viral, propor conceito com hook, CTA e
  ângulo, e **aguardar aprovação do Eric antes de gastar crédito**.

### 2. Roteiro (voz do Eric)
- Ler **`references/estrutura-viral.md`** (padrão dos vídeos que estouraram) e seguir o template
  "Insider de IA": hook = dor já sentida → diagnóstico com número ("ninguém te conta") → batismo
  ("isso tem nome: X") → solução nomeada com artefato → CTA. Alvo 40-60s (~120-140 palavras).
- A textura da fala vem de `references/voz-eric.md` (tom, blacklist, frases inteiras).
- Entregar também a **legenda do post** (ângulo diferente do roteiro) + hashtags.
- **Quebrar o roteiro em CENAS de 1-2 frases** (arquivo `cenas.txt`, uma cena por linha). Script
  inteiro de uma vez no HeyGen degrada a qualidade — regra do Eric, ~9-12 cenas por vídeo.
- **Pronúncia no texto das cenas:** escrever "CLAUDI" no lugar de "Claude" e termos em inglês por
  extenso ("last thirty days") — senão o TTS fala errado. A LEGENDA mostra a grafia certa.

### 2.5 Gate de orçamento (rodar ANTES de gastar crédito)
- Estimar o custo e **mostrar pro Eric/João antes de disparar HeyGen/ElevenLabs/Kling**:
  `python scripts/simular_custo.py --cenas-file <reel>/cenas.txt --clips <N> --clips-kling <M>`
  (`--clips` = ceil(duração ÷ 5); `--clips-kling` = B-rolls que vão pro Kling depois de checar o
  banco na etapa 6 — se ainda não souber, rode com `--clips-kling 0` e refaça após a etapa 6).
- Imprime o **custo conhecido** (HeyGen lip-sync + ElevenLabs + imagens) e o Kling como
  **"a confirmar"** (a taxa do Kling ainda não está fechada — ver `references/custos.md`).
  **Nunca inventar um valor pro Kling.**
- **Só seguir pras etapas 3+ (que gastam crédito) após o "prosseguir? (s/n)" ser aprovado.**
  Esta é a trava que a v2 tinha e a v3 não tinha — herdada e adaptada pra economia da v3.

### 3a. Vídeo do avatar (modo automático — ElevenLabs + HeyGen lip-sync)
- **PRÉ-VOO DE VOZ primeiro (obrigatório, custa centavos):** o eleven_multilingual_v2 troca o
  timbre da voz pra CERTOS textos, de forma determinística (seed e voice_settings não salvam;
  medido em produção em 02/07/2026). Rodar:
  `python scripts/preflight_voz.py <reel>/cenas.txt --block-seconds 12`
  Bloco reprovado = REESCREVER a frase (mesmo sentido, ritmo/estrutura diferentes) e re-rodar o
  pré-voo até tudo passar. Só então disparar o run de produção abaixo.
- `python scripts/elevenlabs_heygen.py --scenes-file cenas.txt --out-dir <reel>/heygen --block-seconds 12`
  (background). Blocos de 12s reduzem muito a chance do defeito de timbre (validado em produção);
  o default de ~20s fica pra quando o Eric pedir explicitamente.
- O que o script faz (diferença central pra v2):
  1. Agrupa as cenas do `cenas.txt` em **blocos de até ~20s** (decisão do Eric/João em
     11/06/2026 após teste com 30s; `--block-seconds` muda).
  2. Gera o áudio de cada bloco no **ElevenLabs** (voz `Eric Profissional - Abril-25`,
     modelo `eleven_multilingual_v2`, chave em `C:\MCPs\elevenlabs.env`).
  3. **Checkpoint de voz no ÁUDIO** (janelas de 10s com embedding de locutor — pega o defeito
     do ElevenLabs de trocar a voz no MEIO) ANTES de gastar crédito do HeyGen. Regenera com
     seed diferente se falhar (máx 3x).
  4. Sobe o .mp3 no HeyGen (`upload.heygen.com/v1/asset`) e gera o lip-sync via
     `POST /v3/videos` com `audio_asset_id` (Avatar V, Eric 2026, fundo verde `#00FF00`,
     `remove_background: true`, 9:16). Validado em 11/06/2026 — o v3 aceita o campo direto.
  5. Baixa, re-verifica a voz no vídeo e concatena.
- `--so-audio` = para após a validação dos áudios (zero gasto HeyGen) — usar pra testar tamanho
  de bloco. `--blocks 2 3` = reprocessa só os blocos listados.

> **PROIBIDO usar `--no-voice-check` pra contornar uma reprovação real do checkpoint de voz.**
> Essa flag existe SÓ pra rodar em máquina sem modelo/referência de voz configurados
> (`speaker-embed.onnx` / `eric-voice-ref.wav` ausentes). Se a voz reprovar 3x: parar e avisar,
> nunca insistir com bypass.

- Erro `MOVIO_PAYMENT_INSUFFICIENT_CREDIT` = crédito de API acabou (separado da assinatura — avisar).
- Conferir 1 frame do resultado (`Read`): fundo tem que estar verde chapado.
- **Pronúncia:** o ElevenLabs pronuncia melhor que o TTS do HeyGen, mas manter a regra do
  "CLAUDI" e dos termos por extenso no cenas.txt até o Eric validar o contrário.
- Fallback: se o lip-sync degradar ou a API recusar áudio, voltar pro fluxo da v2
  (`scripts/heygen_video.py`, cena a cena com TTS interno — caro, mas comprovado).

### 3b. Recorte (modo manual — vídeo gravado sem fundo verde)
- `python scripts/rembg_video.py <video> <reel> [--crop W:H:X:Y]` (background, ~5 min). Detectar a
  área útil antes (vídeo pode vir encaixotado em 16:9). Modelo default `isnet-general-use`
  (NÃO usar u2net_human_seg — abre buraco no microfone/objetos).

### 4. SRT (legenda da tela)
- Rodar o `gerar_srt.py` da skill `gerar-srt` no vídeo da fala (modelo `medium`).
- **Revisar o .srt**: corrigir termos ("Cláudio"→"Claude", "Haja"→"Aja", a palavra do CTA). A duração
  real do vídeo define o nº de B-rolls: `ceil(duração ÷ 5)`.

### 5. Frames-base dos B-rolls (GPT Image 2 / OpenAI)
- **Só gerar frame pros trechos que NÃO vierem do banco** (ver etapa 6 — banco primeiro).
- Ler `references/visual-broll-thumb.md` (mesmo estilo dark+âmbar, 9:16, SEM texto, figuras
  SEMPRE vestidas). 1 frame por clipe (dos gaps), mapeado ao trecho da fala.
- `python scripts/openai_image.py --prompt "..." --out <reel>/frames/frame-NN.png`
  (modelo gpt-image-2, retrato; chave em C:\MCPs\openai.env). A thumb (etapa 8) também sai daqui.

### 6. B-rolls — BANCO REMOTO PRIMEIRO, Kling só pro que faltar
- **ANTES de gerar qualquer coisa, consultar o banco de B-rolls** (catálogo público de ~219 clips
  reutilizáveis, hospedado em GitHub Release — funciona em qualquer máquina, baixa só o que precisa):
  1. Listar o catálogo: `python scripts/broll_bank.py --list` (ou `--cat servidor`, `--hd`).
  2. Listar os N trechos da fala que precisam de B-roll (= duração ÷ 5).
  3. Casar cada trecho com uma **categoria** (`robo, servidor, cerebro, video, documento, energia,
     rede, relogio, estrela, lupa, moeda, cristal, pessoas`) e escolher 1 `id` por trecho — alternando,
     sem repetir seguido, preferindo `hd`. Em dúvida, baixar a thumb pra conferir:
     `python scripts/broll_bank.py --thumb <id1> <id2> ...` (vai pra `_bankthumbs/`, conferir com Read).
  4. Baixar os escolhidos NA ORDEM da fala direto pra pasta do reel:
     `python scripts/broll_bank.py --get <id1> <id2> ... --out <reel>` → vira `clip-01.mp4 ... clip-NN.mp4`
     (com cache local em `~/.cache/broll-bank/` — não re-baixa). Ver `references/banco-broll.md`.
  5. **Só gerar no Kling os trechos que o banco NÃO cobre** (visual muito específico) — e só pra esses
     fazer o frame (etapa 5). Numerar os clips do Kling preenchendo os buracos da sequência.
     Isso zera/derruba o custo do Kling na maioria dos reels (pedido do João).
  6. Clips novos gerados ENTRAM no banco depois (subir no Release + adicionar no `bank.json`).
- Pros gaps (Kling): escrever `<reel>/manifest.json` no formato da v1 (ver `references/kling-api.md`).
- Validar 1 clipe antes do lote: `python scripts/kling_i2v.py manifest.json 1` (background).
- Lote: `python scripts/kling_i2v.py manifest.json 2 3 ...`. Conferir com ffprobe; re-disparar
  só os que falharem (`... manifest.json 7 8 9`). Chave em `C:\MCPs\kling.env`.
- Lembrete de moderação: o Kling barra frames com figura nua — figuras SEMPRE vestidas.
- Fallback (se o Kling falhar/sem saldo): `python scripts/higgsfield_i2v.py manifest.json ...`
  com `"model"` do Higgsfield no manifest (`C:/MCPs/hf.exe model list --video`; requer
  `hf.exe auth login` 1x; saldo: `C:/MCPs/hf.exe account`).

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

### 9. Página do CTA (Biblioteca — biblioteca.ericluciano.com.br)
- Criar via MCP `biblioteca` (tool `biblioteca_criar_conteudo`): o material prometido no CTA
  (guia de instalação, prompts prontos etc.) em Markdown, na voz do Eric, com crédito ao criador
  da ferramenta. Campos: titulo, descricao_curta (1 linha de card), categoria (`guia` pra
  tutoriais/instalação, `prompt` pra prompts prontos), capa_valor (emoji que casa com o tema),
  corpo_markdown, publicado=true.
- A tool devolve a **URL pública** (`https://biblioteca.ericluciano.com.br/c/<slug>`) — colocar
  no chat e no `legenda-post.md`. O lead se cadastra com nome+telefone pra acessar.
- **Capa com imagem (não emoji) — OBRIGATÓRIA, o conteúdo só tá pronto com ela:**
  1. Gerar com `openai_image.py --size 1536x1024` (paisagem 3:2): cena que traduz o tema +
     estilo dark+âmbar de `references/visual-broll-thumb.md` + **headline branca CAIXA ALTA
     de 2-4 palavras que provoca o clique** (ex: "70% MENOS TOKEN") + **pill âmbar** com o
     nome da ferramenta/tema. Conferir com `Read` antes de subir.
  2. Converter pra WebP (PNG do GPT Image 2 tem ~2,4MB; WebP fica ~150KB):
     `ffmpeg -y -v error -i capa.png -q:v 80 capa.webp`
  3. Subir com `biblioteca_upload_capa` (devolve signed URL de 100 anos — o bucket é privado,
     política do Lovable Cloud) e usar `capa_tipo: "imagem"` + `capa_valor` = URL no
     criar/atualizar conteúdo.
  - Se o upload falhar, usar capa emoji como fallback e avisar.
- Requer `C:\MCPs\biblioteca.env` com BIBLIOTECA_ADMIN_EMAIL/PASSWORD (login da aba /admin).
- Fallback (MCP fora do ar): criar via Notion MCP na raiz do workspace, como era antes.

## Saídas (TUDO dentro da pasta do reel — nada solto em Downloads)
- `<reel>/video-final-*.mp4` — pronto pra postar (composto + legendado).
- `<reel>/legenda-post.md` — legenda do post + hashtags + palavra do CTA + link da página da Biblioteca.
- `<reel>/thumb-<tema>-reels.png` — a thumb.
- Página na Biblioteca (https://biblioteca.ericluciano.com.br/c/<slug>; link no chat e no legenda-post.md).
- `<reel>/` = `C:\Users\Joao\Downloads\<reel>\` com cenas, frames, clipes, manifest, SRT/ASS.

## Flags
- `--clips N` força N clipes · `--sem-thumb` / `--sem-broll` pulam etapas · `--manual` modo gravado.

## Skills relacionadas
- `cortar-respiros` — só pro modo manual (avatar do HeyGen não respira).
- `gerar-srt` — usada na etapa 4 (e isolada quando o Eric já editou um vídeo por fora).

## Notas / edge cases
- Python no Bash do Windows: paths com barra normal (`C:/...`).
- **compose_reel.py: SEMPRE passar caminhos ABSOLUTOS** (--brolls-dir, --avatar, --srt, --out).
  Com caminho relativo a lista de concat vai pro %TEMP% e o ffmpeg não acha os clip-NN.mp4.
- Vídeo gravado manualmente no HeyGen (UI) costuma vir 1920x1080 com o 9:16 encaixotado no
  centro e SEM fundo verde → modo manual: `--crop 608:1080:656:0` no rembg_video.py.
- Crédito de API: HeyGen e Kling têm crédito separado da assinatura dos sites. Submit recusado não gasta.
- Saldo do Kling acabou no meio: re-disparar só os que faltam (`... manifest.json 7 8 9`).
- Cena do HeyGen com pronúncia errada: regenerar SÓ a cena (`--text "..."`), substituir o scene-NN.mp4,
  re-concatenar e rodar o Whisper de novo (timestamps mudam).
- Vídeo gravado mais longo que os B-rolls: gerar clipes extras (o compose loopa, mas repetir B-roll é feio).

## Recursos
- **`scripts/elevenlabs_heygen.py`** — O CORAÇÃO DA V3: TTS ElevenLabs em blocos + checkpoint
  de voz em janelas + upload de asset + lip-sync HeyGen v3 (`audio_asset_id`) + concat.
- **`scripts/heygen_video.py`** — fluxo antigo da v2 (TTS interno cena-a-cena) — só fallback.
- **`scripts/verificar_voz.py`** — verificação de locutor (sherpa-onnx; ref em C:/MCPs/eric-voice-ref.wav).
- **`scripts/openai_image.py`** — frames/thumb via GPT Image 2 (OpenAI).
- **`scripts/kling_i2v.py`** — runner do Kling (TITULAR dos B-rolls na v3).
- **`scripts/broll_bank.py`** — banco de B-rolls remoto: `--list`/`--thumb`/`--get`; consultar na etapa 6 ANTES do Kling.
- **`scripts/higgsfield_i2v.py`** — runner do Higgsfield (fallback).
- **`scripts/rembg_video.py`** — recorte por IA pra vídeo sem fundo verde (isnet-general-use).
- **`scripts/compose_reel.py`** — composição (chromakey/alpha + B-roll + legenda .ass estilizada).
- **`references/voz-eric.md`** — tom, blacklist e estrutura de roteiro.
- **`references/kling-api.md`** — API do Kling, manifesto, troubleshooting.
- **`references/banco-broll.md`** — banco de B-rolls reutilizáveis, REMOTO (GitHub Release, acesso
  via `scripts/broll_bank.py`, cache local em `~/.cache/broll-bank`); consultar na etapa 6 ANTES de gerar Kling.
- **`references/visual-broll-thumb.md`** — estilo dos frames e da thumb.
