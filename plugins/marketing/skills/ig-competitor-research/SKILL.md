---
name: ig-competitor-research
description: "Pesquisa automatizada de conteudo viral no Instagram. Scrapeia os concorrentes de um nicho via Apify, rankeia os posts de maior performance da semana (outlier score), transcreve os Reels com Whisper local, analisa o visual de cada post e gera um relatorio HTML com hook + formato + transcricao + por que viralizou. Use quando o Eric pedir 'pesquisa de concorrentes no Instagram', 'o que ta viralizando no nicho X', 'IG competitor research', 'research de conteudo', 'analisa os perfis [@...]', ou quando precisar de ideias de conteudo baseadas no que ja funciona."
argument-hint: "[@handle1 @handle2 ...] [--dias N] [--top-total N] [--no-transcribe]"
allowed-tools: Bash, Read, Write, Edit
---

# IG Competitor Research

Engenharia reversa da skill do Jason Cooperson (vídeo "I Built a Claude Skill that Predicts VIRAL Posts!"),
adaptada pro ambiente do Eric (Windows + Claude Code + ator Apify que ele já usa).

Descobre o que está performando no nicho e devolve um relatório acionável: tópicos, formatos e hooks
prontos pra copiar/adaptar.

## Pré-requisitos (já instalados no PC do Eric)
- `APIFY_TOKEN` no ambiente (ator `apify~instagram-profile-scraper`)
- `ffmpeg` no PATH · `openai-whisper` (import whisper) · Python 3

Se algum faltar em outra máquina: `pip install -U openai-whisper` e instalar ffmpeg.

## Entradas
- **Handles**: passados como argumento (`@handle1 @handle2`) OU lidos de `competitors.txt` na raiz da skill
  (1 handle por linha, `#` é comentário). Sem handles e sem arquivo → pedir os @ ao Eric.
- `--file CAMINHO`: usa outro arquivo de handles no lugar de `competitors.txt`. Aceita caminho absoluto
  (ex: `--file C:\caminho\meus_handles.txt`) ou relativo à pasta onde o comando é rodado.
- `--outdir CAMINHO`: muda a pasta base onde o `output/<timestamp>/` é criado (default: `output/` dentro
  da própria skill). Também aceita caminho absoluto.
- Flags opcionais: `--dias N` (janela, default 7), `--top-total N` (picks, default 15),
  `--top-per-handle N` (default 3), `--whisper-model tiny|base|small|medium` (default small),
  `--no-transcribe` (pula vídeo+Whisper, só metadados+capa — muito mais rápido).

## Fluxo (4 passos)

### Passo 1 — Coleta + ranking + transcrição (script determinístico)
Resolva o caminho da skill instalada (funciona de qualquer pasta, independente de onde o comando é
chamado):
```bash
SKILLS_DIR=$(ls -d "$HOME/.claude/plugins/cache/expertintegrado/marketing"/*/skills | sort -V | tail -1)
PYTHONUTF8=1 python "$SKILLS_DIR/ig-competitor-research/scripts/research.py" <@handles...> [flags]
```
O script: scrapeia via Apify (1 chamada batch) → filtra a janela → calcula engajamento e **outlier score**
(engajamento ÷ mediana do próprio perfil) → top N por handle → reordena global → baixa a capa de cada pick
e, pros Reels, baixa o mp4, extrai áudio e transcreve com Whisper. Sai um `output/<timestamp>/` com
`research_data.json` (transcrição + métricas + `frame_path`) e a pasta `frames/`.

Guarde o `RUN_DIR=...` que o script imprime na última linha.

### Passo 2 — Análise visual (este é o trabalho do Claude)
Pra **cada post** no `research_data.json`:
1. `Read` o `frame_path` (a capa/thumbnail) — analise o visual: formato (talking head, B-roll, carrossel,
   listicle, split-screen, screen-share...), texto na tela, elementos que prendem o olhar.
2. Leia o `transcript` e a `caption`.
3. Produza 4 campos, **em português**:
   - `hook` — a primeira frase/promessa que segura o espectador (reescreva limpa, não copie ruído do ASR)
   - `format` — rótulo curto do formato (ex: "Talking head + B-roll", "Carrossel listicle", "Screen-share tutorial")
   - `why_it_worked` — 1-2 frases sobre o mecanismo psicológico (curiosidade, stakes, contraste, autoridade, prova social...)
   - `visual_notes` — o que a imagem mostra e por que funciona visualmente

Os nomes das chaves têm que ser **exatamente** estes (o merge do Passo 3 usa `shortcode` pra casar cada
análise com o post certo; qualquer nome diferente fica de fora do relatório):
```json
{
  "shortcode": "Cxxxxxxxxxx",
  "hook": "A primeira frase que prende o espectador",
  "format": "Talking head + B-roll",
  "why_it_worked": "1-2 frases sobre o mecanismo psicológico",
  "visual_notes": "O que a imagem mostra e por que funciona visualmente"
}
```

Faça essa análise post a post, dentro do contexto principal, na ordem em que os posts aparecem no
`research_data.json` (o allowed-tools desta skill não inclui o Task tool, então não dá pra paralelizar
com subagentes; pra volumes grandes (>8 posts), isso só significa mais chamadas de `Read` em sequência,
não é um problema de custo relevante).

### Passo 3 — Gerar o relatório
Escreva `<RUN_DIR>/analysis.json` — um array de objetos `{shortcode, hook, format, why_it_worked, visual_notes}`
(um por post analisado). Depois:
```bash
SKILLS_DIR=$(ls -d "$HOME/.claude/plugins/cache/expertintegrado/marketing"/*/skills | sort -V | tail -1)
python "$SKILLS_DIR/ig-competitor-research/scripts/build_report.py" "<RUN_DIR>"
```
O script faz o merge do `analysis.json` por `shortcode`, gera `report.html` (dark-theme, imagens embutidas,
transcrição copiável) e abre no navegador.

### Passo 4 — Entregar
Responda ao Eric com: caminho do `report.html`, os 3 tópicos/formatos que mais aparecem e que ele deveria
testar, e ofereça brainstorm de pautas baseado no relatório (jogar o HTML de volta no chat já "treina" o
contexto no top content do nicho).

## Custo
- Apify: ~US$ 0,10–0,15 por run (cabe no free tier de US$ 5/mês). Whisper roda local = grátis.
- Único custo real é a assinatura do Claude.

## Notas / edge cases
- Sempre rodar Python com `PYTHONUTF8=1` (captions têm emoji → cp1252 quebra no Windows).
- Perfil privado / inexistente → o Apify retorna sem `latestPosts`; o script ignora e segue com os demais.
- Janela sem posts → aumentar `--dias`.
- URLs de vídeo do Instagram expiram rápido: rodar a transcrição na mesma sessão do scrape (o script já faz).
  Se mesmo assim algum vídeo falhar por URL expirada no meio do Passo 1, não repita o run inteiro: rode o
  Passo 1 de novo só com o(s) handle(s) que falharam (ex: `python "$SKILLS_DIR/ig-competitor-research/scripts/research.py" @handle_que_falhou ...`,
  com o mesmo `SKILLS_DIR` resolvido no Passo 1 e as mesmas flags), gerando um novo `RUN_DIR`, e una os
  posts desse run com o run original antes do Passo 2.
- Reels longos: o script transcreve só os primeiros `--max-audio-seconds` (default 120s) — hook e conteúdo
  principal vivem no início.
- Atendendo agência (vários clientes): rodar uma conversa por cliente, cada uma com seus handles.
