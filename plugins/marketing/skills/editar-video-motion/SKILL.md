---
name: editar-video-motion
description: "Edita um vídeo gravado (talking-head do Eric ou de qualquer pessoa) num vídeo final PRONTO com motion graphics por cima — corta os erros/retakes/respiros da gravação, monta o vídeo-base limpo com áudio sincronizado, e mixa gráficos animados (lower-thirds, listas, cards de seção que mascaram os cortes, contadores, PiP no canto, chips, end card de CTA) na identidade da marca. Renderiza em 16:9 (1920x1080), 9:16 (1080x1920) e 1:1 (1080x1080). Usar quando o João/Eric pedir 'edita esse vídeo', 'transforma essa gravação em vídeo com motion', 'bota uns gráficos nesse vídeo', 'faz a versão 9x16 desse vídeo', 'corta os erros desse vídeo e bota motion', ou mandar um vídeo gravado pra virar peça final."
argument-hint: "[video-gravado.mp4] [--formato 16:9|9:16|1:1|todos] [--landing URL] [--identidade dark-azul]"
allowed-tools: Read, Write, Edit, Bash, WebFetch, Glob, Grep
---

# Editar Vídeo com Motion (talking-head + gráficos)

Transforma uma **gravação crua** (alguém falando pra câmera, com erros e retakes) num **vídeo final
editado**: corta os erros, deixa a fala corrida e sincronizada, e mixa **motion graphics** por cima —
ora a pessoa em tela cheia com gráfico em volta, ora corta pra motion full (cobrindo a pessoa), ora a
pessoa num quadradinho (PiP) com o motion tomando a tela. Renderiza em qualquer proporção.

> Validado em 24/06/2026 produzindo o vídeo do ecossistema Expert Integrado (Eric, 8min de gravação
> crua → 3min editado com Mentoria + AI Innovation Lab + CTA). É a generalização daquele fluxo.

**O vídeo gravado é a BASE.** A gente NÃO gera avatar nem TTS aqui — usa a fala real da pessoa.
(Se a pessoa quiser avatar/voz sintética, isso é a `criar-reel`, não esta skill.)

## Quando usar
- "Edita esse vídeo", "bota motion nesse vídeo", "transforma essa gravação em peça final"
- "Corta os erros e deixa só o que presta" + gráficos
- "Faz a versão 9x16 / vertical / stories desse vídeo"
- Mandar um `.mp4` gravado (talking-head) pedindo o vídeo pronto

## Pré-requisitos (checar no início)
- **Node ≥ 22 + FFmpeg + HyperFrames** (`npx hyperframes doctor`). HyperFrames faz a composição vídeo+motion.
- **Chave ElevenLabs** em `C:\MCPs\elevenlabs.env` (ou `~/.config/elevenlabs.env`) — usada pra transcrever (Scribe STT).
- **Fontes**: `assets/fonts/` desta skill tem o Space Grotesk (copiar pro projeto). Embutir via `@font-face` (NÃO é auto-resolvida).

---

## Fluxo (6 fases)

### Fase 0 — Briefing & identidade
Confirmar com o usuário (use `AskUserQuestion` se faltar):
1. **Formato(s)**: 16:9 (institucional/YouTube), 9:16 (Reels/Stories), 1:1 (feed), ou vários.
2. **Identidade visual**: extrair de uma **landing page** (se ele passar URL — abrir com Playwright e pegar cores+conteúdo, igual fiz com as landings da Expert), usar uma marca conhecida, ou o padrão **dark-azul Expert** (`#070F26` bg + `#2C6BFF` accent).
3. **Conteúdo/estrutura**: o que a gravação cobre, qual a ordem narrativa desejada, o CTA.

Se ele passou uma landing, leia `references/identidade.md` pra extrair paleta+conteúdo.

### Fase 1 — Transcrição (timestamps por palavra)
```bash
python scripts/transcribe.py "<video.mp4>" transcript.json
```
Gera `transcript.json` (ElevenLabs Scribe, `words[]` com `start`/`end`/`type`). Também extrai o áudio cru.
⚠️ O Scribe às vezes erra termos técnicos ("MCP", "Claude") e números — **isso é o STT, o áudio real está certo**. Não "corrigir" o vídeo por causa disso.

### Fase 2 — Mapa de cortes (achar os takes bons)
```bash
python scripts/segment_map.py transcript.json segmentos.txt
```
`segmentos.txt` = a transcrição quebrada em frases com `[idx] início-fim (dur) texto`, marcando pausas e eventos de áudio (pigarro etc.).

**Leia o `segmentos.txt` e monte a KEEP-LIST** — os trechos bons, na ordem narrativa final, jogando fora:
- retakes / falsos começos (a pessoa erra e refaz a mesma frase — fica o melhor take)
- comentários pra produção ("deixa eu voltar", "tu se vira aí", "João, acho que...")
- pigarros, silêncios longos, a notificação inicial
- flubs no fim de um take ("agentes de A--", "com trabalho fa--")

**Cortes apertados (regra de ouro):**
- Começa ~0.08–0.12s antes da primeira palavra falada.
- Termina ~0.10–0.15s depois da última palavra — **sem deixar respiro/silêncio sobrando** (esse é o defeito nº1; pega exatamente o `end` da última palavra no transcript).
- **Cuidado com palavra duplicada na emenda**: se o take A termina em "...negócio. Um" e o take B começa em "Um outro...", corte o "Um" sobrando do fim de A. Pegue os `end` das palavras no transcript pra cortar no ponto exato.
- Use `ffmpeg -af silencedetect=noise=-32dB:d=0.28` pra achar respiros se precisar.

Detalhes e exemplos: `references/cortes.md`.

### Fase 3 — Vídeo-base limpo + MP3
```bash
# KEEP-LIST como JSON: [["intro",505.95,515.13],["hook",82.42,96.20], ...]
python scripts/cut_base.py "<video.mp4>" pieces.json --out base.mp4 --target 1920x1080 --fps 30
python scripts/cut_base.py "<video.mp4>" pieces.json --out narracao-limpa.mp3 --audio   # versão só áudio
```
- `base.mp4` = a pessoa falando, erros removidos, **áudio sincronizado** (lip-sync preservado, mesmo corte).
- Imprime os **offsets da timeline limpa** por trecho — guarde, é o que sincroniza os overlays.
- ⚠️ **Caminho do vídeo no Python (Windows)**: passe `C:/Users/...` (NÃO `/c/Users/...` — o Python nativo não entende). O script normaliza, mas prefira `C:/`.

### Fase 4 — Plano de motion (sincronizar com a fala)
Pegue os timestamps das palavras-chave já na **timeline limpa**:
```bash
python scripts/word_times.py transcript.json pieces.json   # imprime palavras por trecho em tempo-limpo
```
Mapeie cada batida da narração a um **componente** (biblioteca em `references/componentes.md`):
- **lower-third** (nome/cargo na intro)
- **lista lateral** (dores, ou benefícios/checklist — entram um a um na fala)
- **card de seção / sting full** — cobre a pessoa e **mascara o corte** entre takes (use nas trocas de assunto)
- **contador (count-up)** pra números ("300+ aulas", "30 dias")
- **PiP** — encolhe a pessoa pro canto enquanto um motion full toma a tela (pilares, diagrama)
- **chips de área/lista** que acendem na sequência
- **card de feature** (título + 3 mini-cards)
- **end card** de CTA no fim
- **brand mark** fixo + **section tag** (top-left) por seção

**Regras de transição** (em `references/composicao.md`):
- Todo corte entre takes deve ser mascarado por um card de seção OU um *punch-in* (zoom rápido 1.05→1) OU acontecer sob o fade de um card.
- **Handoff "cobre antes de revelar"**: ao sair de um PiP pra um card, suba o card PRIMEIRO (cobrindo o PiP), só DEPOIS resete o vídeo pra tela cheia (escondido sob o card). Nunca mostre a pessoa em tela cheia "piscando" 1s antes do próximo slide.
- Quando o card cobre o corte, estenda o card até DEPOIS do corte (revela direto no próximo take, sem mostrar 2x a pessoa).

### Fase 5 — Compor no HyperFrames
```bash
npx hyperframes init projeto --video base.mp4 --non-interactive
cp <skill>/assets/fonts/*.woff2 projeto/assets/fonts/
```
Autore `index.html` (modelo e biblioteca em `references/composicao.md` + `references/componentes.md`):
- `#stage` envolve o `<video>` (base, mutado) → animável pra PiP. `<audio>` separado do MESMO `base.mp4` (lip-sync).
- Overlays como divs em z-index acima do vídeo, controlados por UMA timeline GSAP (não `data-start` — controle por opacity/transform).
- Identidade unificada + **grain estático + decorativos estáticos** (NUNCA degradê animado — ver gotcha do flicker).
- `data-width`/`data-height` = a proporção alvo. Pra 9:16 e 1:1, reposicione os overlays (ver `references/proporcoes.md`).

### Fase 6 — Render + verificar + entregar
```bash
cd projeto && npx hyperframes lint
npx hyperframes render --quality high --fps 30 --output renders/final-16x9.mp4   # fps = o do vídeo-base (30)
```
- **Verifique por frames** (`ffmpeg -ss T -i ... -vframes 1`): um por seção + os pontos de transição. Corrija e re-renderize.
- Pra **flicker/respiro suspeito**: extraia frames consecutivos e compare hash/`signalstats` (ver gotchas).
- Copie pro `Downloads`. Arquivo grande (>200MB)? Ofereça versão comprimida:
  `ffmpeg -i final.mp4 -c:v libx264 -crf 26 -preset slow -c:a aac -b:a 128k final-leve.mp4`
- Pra **vários formatos**: refaça a Fase 5/6 com `data-width/height` e posições do formato (o `base.mp4` é o mesmo; só a composição muda).

---

## Referências (ler sob demanda)
- `references/cortes.md` — achar takes bons, cortes apertados, tirar respiros e palavras duplicadas.
- `references/componentes.md` — **biblioteca de componentes** de motion (CSS+HTML+GSAP copia-e-cola).
- `references/composicao.md` — montar a composição (vídeo+overlays), camadas z-index, handoffs, mascarar cortes, re-timing.
- `references/proporcoes.md` — adaptar pra 9:16 / 1:1 (reenquadrar o talking-head + reposicionar overlays).
- `references/gotchas.md` — armadilhas: flicker de banding (grain!), caminho Windows no Python, fontes, fps, etc.
- `references/identidade.md` — extrair paleta+conteúdo de uma landing page (Playwright).

## Regras
- Sempre `npx hyperframes lint` antes de renderizar; corrija erros.
- Decorativos (glow/grid) SEMPRE estáticos + camada de grain. Degradê animado sobre fundo escuro = flicker no H.264.
- `fps` do render = fps do vídeo-base (geralmente 30). 60fps só pra peças 100% motion (sem vídeo).
- Nunca deixe respiro/silêncio sobrando nas emendas. Nunca deixe a pessoa "piscar" em tela cheia entre slides.
- Mantenha a identidade coesa: UMA paleta, UMA fonte display (Space Grotesk), contraste de peso 300↔700.
