# Reels Studio

Skill que cria um **reels vertical do zero** dentro do Claude Code: um **avatar** (HeyGen) apresenta falando o roteiro, e o vídeo é coberto por **b-roll** — cenas geradas por IA (imagens OpenAI com movimento de câmera) numa faixa embaixo. Fecha com música de fundo discreta e exporta pronto pra postar. **Você não precisa gravar nada.**

## O que você precisa antes

- **Claude Code** instalado.
- **ffmpeg** e **python3** instalados (Mac: `brew install ffmpeg python3`; Windows: ffmpeg via winget/choco + Python da python.org).
- **Pillow**: `pip install pillow` (só pro gancho opcional).
- **Chaves de API** (você cria e usa as suas — paga só o que usar):
  - **OpenAI** → https://platform.openai.com/api-keys (gera as cenas de b-roll)
  - **HeyGen** → app.heygen.com → Settings → API (gera o avatar)
  - *(Opcional)* ElevenLabs, só se quiser voz clonada no avatar.

## Como instalar

Copie a pasta `reels-studio/` para dentro de `~/.claude/skills/` (Mac/Linux) ou `%USERPROFILE%\.claude\skills\` (Windows):

```
.claude/skills/reels-studio/
├── SKILL.md
├── config/
│   ├── chaves.exemplo.env      # copie pra chaves.env e preencha
│   ├── avatar.exemplo.json     # copie pra avatar.json (avatar HeyGen + voz)
│   └── elenco.exemplo.json     # o agente monta o elenco.json no onboarding
├── scripts/                    # config + etapas do pipeline
├── references/metodo.md
└── README.md
```

## Como usar

Abra o Claude Code e mande:
> "cria um reels sobre os 3 maiores erros ao começar com IA"

Na **primeira vez**, o agente vai:
1. Pedir suas chaves (uma vez só — ele guarda em `config/chaves.env` na sua máquina).
2. Configurar seu **avatar** HeyGen (o ID do avatar + a voz).
3. Montar o **elenco** das suas cenas de b-roll (personagens, ambiente, cores).
4. *(Opcional)* Ajudar a montar seu card de **CTA** fixo pro final.

Depois é só pedir reels que ele monta sozinho: escreve o roteiro, gera o avatar falando, cria as cenas de b-roll, dá movimento, monta avatar + b-roll, e finaliza com música.

## Custo

- **Imagens** (gpt-image-2): ~US$ 0,16 cada → reels de ~6 cenas ≈ **US$ 1**.
- **Avatar** (HeyGen): consome créditos do seu plano (varia por plano/segundos).
- **Movimento, montagem, música, export**: ffmpeg, **custo zero**.

Mais barato que pipelines que animam o b-roll com modelo de vídeo por IA — aqui o movimento é feito com ffmpeg.

## Privacidade

Suas chaves ficam só na sua máquina (`config/chaves.env`, não versionado). A montagem do vídeo é feita localmente com ffmpeg; só a geração do avatar e das imagens passa pelas APIs que você configurou.
