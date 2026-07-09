---
name: clipar-video
description: "Transforma um vídeo longo (podcast, gravação, palestra) em clipes virais curtos prontos pra postar — igual ao Opus Clip. Transcreve com a API Whisper da OpenAI, usa Claude para identificar os melhores momentos com hooks fortes, corta com FFmpeg, reencadra pra 9:16 e queima a legenda no vídeo. Usar quando o João pedir 'clipa esse vídeo', 'gera clipes desse podcast', 'faz os cortes virais', 'cria shorts desse vídeo', 'quero 5 clipes de 60 segundos'."
argument-hint: "[video.mp4] [--auto] [--duracao 30|60|90] [--clips N] [--formato 9:16|16:9] [--estilo-legenda padrao|eric] [--sem-legenda] [--sem-glossario]"
allowed-tools: Read, Write, Edit, Bash, Glob
---

# Clipar Vídeo (estilo Opus Clip)

Transforma um vídeo longo num pacote de clipes curtos virais. O coração é a análise inteligente
da transcrição: Claude lê o conteúdo completo e escolhe os trechos com **melhor potencial viral**
(hook forte, narrativa completa, auto-contido).

## Quando usar

- "Clipa esse podcast", "gera clipes desse vídeo", "faz os cortes virais"
- "Quero 5 clipes de 60 segundos desse vídeo"
- "Extrai os melhores momentos dessa gravação"
- Mandar um `.mp4` longo pedindo clipes para Reels / TikTok / Shorts

## Modo automático (esteira do funil de conteúdo)

Quando o pedido vier com **"--auto"**, "modo automático", "roda a esteira", ou vier de rotina/pipeline
(sem humano pra responder pergunta): **NÃO usar AskUserQuestion e NÃO parar no checkpoint**. Fluxo:

1. Rodar tudo de uma vez com defaults (60s, 5 clipes, 9:16, legenda queimada estilo eric):
   ```bash
   python "C:/Users/Joao/.claude/skills/clipar-video/scripts/clipar_video.py" \
     --video "<caminho>" --fase tudo --estilo-legenda eric
   ```
   O script aplica sozinho o glossário de ASR no SRT (Claude, ChatGPT, GitHub, MCP...) e, no final,
   salva um **`manifest.md`** na pasta de saída: tabela com arquivo, trecho, duração, score e hook de
   cada clipe + termos de SRT sinalizados pra conferir (ex.: "cloud" que pode ser "Claude"). O manifest
   substitui o checkpoint humano: quem publica revisa por ele, não assistindo tudo.
2. Depois do corte, gerar **`clip-NN-legenda-post.md`** pra cada clipe na mesma pasta (regras: sem
   asterisco/markdown, máximo 5 hashtags, CTA orgânico "comenta X", nunca travessão, não replicar a
   fala do clipe). Usar o hook do manifest como matéria-prima, não como texto final.
3. Se algum SRT tiver termo sinalizado no manifest, abrir o .srt, decidir pelo contexto e corrigir
   com Edit ANTES de dar o pacote como pronto (o vídeo com legenda queimada precisa ser re-cortado
   se o SRT mudar: apagar o .mp4 final daquele clipe e rodar de novo só a fase cortar).
4. **Batch** (acervo inteiro): repetir o comando por arquivo da pasta, sequencial, informando o custo
   estimado total antes (US$0.006/min de áudio + ~US$0.03 de análise por vídeo).

Destino padrão dos pacotes prontos da esteira: mover/copiar a pasta pra
`Downloads/funil-cortes/<AAAA-MM-DD>-<slug>/` quando o pacote for aprovado pra fila de publicação.

## Fluxo

### 1. Briefing (perguntar se não veio nos args)

Usar `AskUserQuestion` para coletar:

1. **Caminho do vídeo** — se não veio como arg
2. **Duração dos clipes** — 30s, 60s ou 90s (ou custom)
3. **Quantos clipes** — padrão: 5
4. **Formato** — 9:16 (Reels/TikTok, default) ou 16:9 (YouTube Shorts horizontal)
5. **Queimar legenda** — sim (default) ou não (só SRT)

Exemplo de pergunta ideal:
```
- Duração: 30s / 60s / 90s?
- Quantos clipes? (padrão: 5)
- Formato: 9:16 vertical (Reels/TikTok) ou 16:9?
- Quer a legenda queimada no vídeo ou só o .srt?
```

### 2. Transcrição com Whisper (API OpenAI)

```bash
python "C:/Users/Joao/.claude/skills/clipar-video/scripts/clipar_video.py" \
  --video "<caminho>" \
  --duracao <segundos> \
  --clips <N> \
  --formato 9:16 \
  --fase transcricao
```

O script extrai o áudio em mp3 mono 16kHz, divide em chunks de 20 minutos e transcreve cada um
na **API da OpenAI** (`whisper-1`, com timestamps por palavra e por segmento). Salva
`transcript.json` na pasta de saída. Custo: ~US$0.006/min de áudio (US$0.36 por hora de vídeo).
Chave em `C:/MCPs/openai.env` (`OPENAI_API_KEY=`).

**IMPORTANTE:** o script imprime a linha `📂 Pasta de saída: <caminho>` no início da execução.
**Copie esse caminho exato** e passe com `--out-dir` em TODAS as fases seguintes (análise e corte).
Sem isso, cada fase cria uma pasta nova com timestamp diferente e não encontra os arquivos da
fase anterior (a transcrição paga seria refeita ou a fase seguinte aborta). Exemplo: se a fase 1
imprimiu `📂 Pasta de saída: C:/Users/Joao/Downloads/clipes-podcast-tools-eric-20260630-141205`,
todas as chamadas seguintes devem incluir `--out-dir "C:/Users/Joao/Downloads/clipes-podcast-tools-eric-20260630-141205"`.

(Se por algum motivo o `--out-dir` for esquecido, o script tenta um fallback automático: procura
a pasta `clipes-<nome-do-video>-*` mais recente em Downloads e avisa qual usou. Mesmo assim,
sempre prefira passar `--out-dir` explicitamente.)

### 3. Análise Claude — identificar melhores momentos

```bash
python "C:/Users/Joao/.claude/skills/clipar-video/scripts/clipar_video.py" \
  --video "<caminho>" \
  --duracao <segundos> \
  --clips <N> \
  --formato 9:16 \
  --fase analise \
  --out-dir "<pasta impressa na fase 1>"
```

O script:
1. Lê `transcript.json` e monta o texto completo com timestamps
2. Chama Claude API (`claude-sonnet-5`) passando a transcrição + critérios de seleção
3. Claude retorna JSON com N clipes: `{start, end, titulo, hook, score}`
4. Script salva `clips_selecionados.json` e imprime o menu de clipes encontrados

**Critérios que Claude usa pra pontuar:**
- Hook forte nos primeiros 3s (frase que prende atenção)
- Narrativa auto-contida (faz sentido sem contexto)
- Momento de insight ou revelação ("eu nunca soube que...")
- Número, dado, afirmação surpreendente
- Mudança emocional clara (curiosidade → solução → aha)

### 4. Checkpoint — mostrar clipes ao João

Imprimir tabela:
```
CLIPES ENCONTRADOS
==================
#  | Início | Fim   | Duração | Score | Hook
1  | 4:32   | 5:28  | 56s     | 9.2   | "A maioria das empresas perde 40% do tempo em..."
2  | 12:15  | 13:10 | 55s     | 8.7   | "Tem um nome pra isso que ninguém te conta..."
3  | 23:44  | 24:40 | 56s     | 8.4   | "Eu testei com 50 clientes e o resultado foi..."
...
```

Perguntar: "Quer cortar todos, excluir algum, ou ajustar os tempos?"
Se OK, seguir pra etapa 5. Se quiser editar: aceitar `remover 2,4` ou `ajustar 3 inicio=23:50`.

### 5. Corte + legenda + reencadre

```bash
python "C:/Users/Joao/.claude/skills/clipar-video/scripts/clipar_video.py" \
  --video "<caminho>" \
  --duracao <segundos> \
  --clips <N> \
  --formato 9:16 \
  --fase cortar \
  --out-dir "<pasta impressa na fase 1>"
```

Se a pessoa estiver na lateral do frame (podcast com 2 pessoas, ver Edge Cases), adicione
`--crop-side esquerda` ou `--crop-side direita` nesse comando para forçar o lado do crop em vez
da detecção automática de rosto.

Para cada clipe selecionado, o script:
1. Corta o trecho com FFmpeg (re-encode com seek preciso: sem desync de keyframe)
2. Gera SRT word-by-word a partir do `transcript.json` (trechos de ≤4 palavras), já passando o
   glossário de correções de ASR (desligável com `--sem-glossario`); termos ambíguos (cloud/Claude,
   fable, opus...) são sinalizados no console e no `manifest.md` pra decisão por contexto
3. Queima a legenda no vídeo (FFmpeg `subtitles` filter). Estilos via `--estilo-legenda`:
   `padrao` (branca + outline preto) ou `eric` (amarela oficial dos Reels do perfil, negrito,
   contorno preto; usar sempre que o destino for o perfil do Eric)
4. Reencadra para 9:16: se o original for 16:9, centraliza a pessoa (crop inteligente via análise de
   face com OpenCV, ou crop central simples como fallback)
5. Exporta: `clip-01-<hook-slug>.mp4`, `clip-01-<hook-slug>.srt`

**Pasta de saída:** `Downloads/clipes-<nome-do-video>-<timestamp>/`

### 6. Entrega

Imprimir resumo:
```
CLIPES PRONTOS
==============
📁 C:/Users/Joao/Downloads/clipes-podcast-tools-eric-20260630/
  ✅ clip-01-maioria-das-empresas.mp4  (56s | 9:16 | legenda queimada)
  ✅ clip-02-tem-um-nome-pra-isso.mp4  (55s | 9:16 | legenda queimada)
  ✅ clip-03-eu-testei-com-50.mp4      (56s | 9:16 | legenda queimada)
  ✅ clip-04-...
  ✅ clip-05-...

Custo estimado: transcrição ~US$0.006/min de vídeo + ~US$0.03 da chamada Claude
```

Perguntar se quer gerar a **legenda do post** pra algum dos clipes (CTA orgânico, estilo feed).
Regras da legenda de post: sem asterisco/markdown, máximo 5 hashtags, CTA orgânico = "comenta X"
(nunca "link aqui embaixo"), nunca usar travessão, não replicar o roteiro do clipe.

## Edge Cases

- **Vídeo 16:9 com pessoa não centralizada:** a detecção de rosto (`--crop-side auto`, default)
  resolve a maioria. Se a pessoa estiver na lateral (podcast com 2 pessoas) e a detecção errar o
  lado, avisar e perguntar se quer forçar `--crop-side esquerda` ou `--crop-side direita` na fase 5.
- **Clipe muito cheio de silêncio:** o score Claude já penaliza; se mesmo assim rolar, o
  `cortar-respiros` pode compactar antes.
- **Vídeo muito longo (>2h):** mais chunks na API = mais tempo e custo; informar estimativa antes de rodar.
- **Clipes muito curtos (<10s) e sobrepostos:** o script descarta os curtos e, em sobreposição,
  mantém o de maior score.
- **Sem API keys:** o script precisa de `OPENAI_API_KEY` (transcrição) e `ANTHROPIC_API_KEY`
  (análise); sem elas ele aborta com mensagem clara. Não há fallback local.
- **Rodar de novo com parâmetros diferentes:** a análise é re-feita automaticamente se `--clips`
  ou `--duracao` mudarem (cache em `analise_params.json`).

## Arquivos de saída por clipe

```
clip-01-hook-slug.mp4       ← vídeo final (legenda queimada + reencadrado)
clip-01-hook-slug.srt       ← legenda separada (para quem quiser no CapCut)
```

## Recursos

- **`scripts/clipar_video.py`** — pipeline completo (transcrição → análise → corte)
- Dependências: `openai` (API Whisper), `ffmpeg`, `anthropic`, `opencv-python` (opcional, face crop)
