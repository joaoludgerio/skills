# criar-reel-v2 — Reel pronto pra postar (GPT Image 2 + Higgsfield)

Versão 2 da skill [criar-reel](https://github.com/joaoludgerio/criar-reel-skill) de [Claude Code](https://claude.com/claude-code): produz um **Reel do Instagram completo** a partir de uma ideia — roteiro → avatar falante (HeyGen) → B-rolls → edição em camadas → legenda queimada → thumb. O que muda da v1: as **imagens saem no GPT Image 2 (OpenAI)** e os **B-rolls no Higgsfield** (que dá acesso a Kling 3.0, Seedance, Veo e mais 30 modelos numa conta só).

## v1 vs v2

| Etapa | v1 | v2 (esta) |
|---|---|---|
| Frames + thumb | Nano Banana (Gemini, via MCP) | **GPT Image 2** (`scripts/openai_image.py`) |
| B-rolls | Kling API direta | **Higgsfield CLI** (`scripts/higgsfield_i2v.py`) |
| Avatar, composição, legenda | iguais | iguais |

## Instalação

```bash
# 1. Clone na pasta de skills do Claude Code
git clone https://github.com/joaoludgerio/criar-reel-v2-skill.git ~/.claude/skills/criar-reel-v2
# (Windows: C:\Users\SEU_USUARIO\.claude\skills\criar-reel-v2)

# 2. Dependências Python (3.10+)
pip install requests openai-whisper rembg sherpa-onnx numpy

# 3. ffmpeg no PATH (https://ffmpeg.org)

# 4. Higgsfield CLI (B-rolls)
npm install -g @higgsfield/cli
hf auth login        # abre o navegador uma vez, sessão fica salva
# (geração de vídeo exige plano Basic+ do Higgsfield)

# 5. Credenciais
cd ~/.claude/skills/criar-reel-v2
cp credentials.env.example credentials.env
# preencha com as SUAS chaves (HeyGen + OpenAI)
```

> **Dica Windows:** se o `npm install` do CLI falhar no tar, baixe o binário direto dos
> [releases](https://github.com/higgsfield-ai/cli/releases) e coloque o `hf.exe` no PATH
> (ou aponte a variável de ambiente `HF_CLI` pro caminho dele).

## Pré-requisitos de conta

| Serviço | Pra quê | Observação |
|---|---|---|
| HeyGen | avatar falante | crie seu avatar + voz clonada; crédito de **API é separado** da assinatura |
| OpenAI | frames/thumb (gpt-image-2) | billing ativo em platform.openai.com |
| Higgsfield | B-rolls | plano Basic+ pra gerar; `hf model list --video` mostra os modelos |

## Checkpoint de voz (opcional, recomendado)

O HeyGen às vezes gera cenas com a voz errada. Pra ativar a detecção automática:

```bash
mkdir assets
curl -L -o assets/speaker-embed.onnx "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx"
ffmpeg -ss 10 -t 20 -i seu-video.mp4 -ar 16000 -ac 1 -vn assets/voice-ref.wav
```

## Uso

No Claude Code:

```
cria um reel v2 sobre [tema ou link ou repo]
```

Saída: pasta com `video-final.mp4`, `thumb.png`, `legenda-post.md`, frames e clipes.

## Personalize antes do primeiro uso

- `references/voz-eric.md` → **reescreva com o tom de voz da sua marca**
- `references/visual-broll-thumb.md` → paleta e estilo visual
- `credentials.env` → suas chaves e os IDs do seu avatar/voz
- No `manifest.json` dos B-rolls, escolha o modelo do Higgsfield (`"model": "kling3_0"`, `seedance_2_0`, `wan2_7`...)

## Licença

MIT. Se isso te ajudar, segue o [@ericluciano](https://instagram.com/ericluciano) 🤝
