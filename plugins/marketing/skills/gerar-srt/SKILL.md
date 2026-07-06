---
name: gerar-srt
description: "Gera arquivo de legenda .srt para Reels/vídeos do Eric a partir do vídeo (Whisper local) ou de um print do roteiro do Ray Jam, e corrige os termos técnicos que o ASR erra (Claude, MarkItDown, MCP, GitHub, etc.). Usar quando o Eric pedir 'gera o SRT', 'faz a legenda desse vídeo', 'transcreve esse vídeo', 'cria as legendas', 'legenda do Reels', ou mandar um vídeo/print do Ray Jam pedindo legenda. NÃO é a legenda do post (texto do feed) — é o arquivo de legenda na tela."
argument-hint: "[caminho-do-video.mp4] | [--print] [--duration SEG] [--model small|medium]"
allowed-tools: Read, Write, Edit, Bash
---

# Gerar SRT (legenda na tela)

Produz um `.srt` pronto pra importar no CapCut, com os termos técnicos corrigidos. Dois caminhos
de entrada — **vídeo** (preferível) ou **print do Ray Jam**.

## Qual entrada pedir
**Vídeo é melhor.** Ele dá timestamps reais (sincronizados com a fala) E o texto certo via Whisper.
O print do Ray Jam só tem o texto — sem áudio, o tempo é estimado e provavelmente precisa de ajuste
no editor. Se o Eric perguntar o que é mais fácil, recomendar mandar o **vídeo já editado** (a versão
que vai ao ar, ex: a enxuta sem respiros) — assim o SRT bate certinho.

## Caminho A — a partir do VÍDEO (recomendado)
1. Rodar:
   ```bash
   python scripts/gerar_srt.py "C:/Users/Joao/Downloads/<video>.mp4"
   ```
   (modelo default `small`; usar `--model medium` se a precisão dos termos importar muito.)
   Rodar em **background** se o vídeo for longo / o modelo precisar baixar na 1ª vez.
   **Legendas curtas (padrão):** o script já quebra em trechos de até 4 palavras coladas na fala
   (timestamps por palavra do Whisper), pra não ficar uma frase de 3–4 linhas parada na tela por
   vários segundos. Ajustar com `--words N` (ex: `--words 3` mais curto, `--words 5` mais longo);
   `--words 0` volta ao modo frase-inteira antigo.
2. O script transcreve, aplica as correções automáticas e imprime "REVISAR:" com os termos
   sensíveis ao contexto.
3. **Revisar o .srt** (este é o trabalho do Claude): `Read` o arquivo e usar `Edit` pra corrigir os
   termos sinalizados, conferindo contra o roteiro. Ver `references/correcoes-comuns.md` — em especial
   a distinção **Markdown (formato) vs MarkItDown (ferramenta)**, que o script não decide sozinho.
4. Entregar: caminho do `.srt` + um resumo do que foi corrigido + instrução de importar no CapCut
   (Texto → Legendas → Importar arquivo de legenda).

## Caminho B — a partir do PRINT do Ray Jam (sem vídeo)
1. `Read` na imagem do print e transcrever o texto do roteiro, **um segmento de legenda por linha**,
   num arquivo `segmentos.txt`. Usar o mesmo critério do Caminho A: **~4 palavras por segmento,
   máx. ~25 caracteres** (cortar antes disso se cair num ponto natural de fala, tipo vírgula ou fim
   de oração curta).
2. Perguntar/estimar a **duração total** da fala em segundos.
3. Rodar:
   ```bash
   python scripts/srt_from_text.py segmentos.txt --duration <segundos>
   ```
   Isso distribui o tempo proporcional ao tamanho de cada linha. **É aproximado** — avisar o Eric
   que o sync vai precisar de ajuste fino no CapCut.
4. Aplicar as mesmas correções de termos (já vêm certas porque saíram do roteiro, mas conferir).

## Notas / edge cases
- Rodar Python com path em barra normal (`C:/...`) no Bash do Windows.
- O Whisper lê o mp4 direto (usa ffmpeg interno) — não precisa extrair áudio antes.
- Pré-requisitos: `openai-whisper` instalado e `ffmpeg` no PATH (já estão na máquina do Eric).
- Se o vídeo final tiver B-roll em tela cheia por cima, a legenda precisa ficar acima de tudo —
  importar o SRT numa faixa de texto no topo do CapCut, OU queimar a legenda só no export final.

## Recursos
- **`scripts/gerar_srt.py`** — Whisper + correções automáticas (entrada = vídeo).
- **`scripts/srt_from_text.py`** — SRT com tempo estimado (entrada = texto do print).
- **`references/correcoes-comuns.md`** — lista de erros de ASR do nicho e regras de revisão.
