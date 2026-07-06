---
name: cortar-respiros
description: "Tira os respiros e pausas de silêncio de um vídeo automaticamente, deixando a fala numa cadência seguida, com áudio e vídeo em sincronia (usa auto-editor sobre o FFmpeg). Usar quando o Eric pedir 'corta os respiros', 'tira as pausas', 'deixa o vídeo mais corrido', 'versão enxuta', 'cadência seguida', 'jump cut', 'remove os silêncios', ou mandar um vídeo gravado pedindo pra agilizar."
argument-hint: "[caminho-do-video.mp4] [--margin 0.2] [--both] [--threshold N]"
allowed-tools: Read, Bash
---

# Cortar Respiros (versão enxuta)

Remove os trechos de silêncio (respiros, pausas) de um vídeo gravado, gerando um MP4 mais corrido
sem perder a sincronia. Roda o `auto-editor` (que trabalha sobre o FFmpeg) e reporta o antes/depois.

## Pré-requisitos
- `auto-editor` instalado: `pip install auto-editor`.
- `ffmpeg` e `ffprobe` no PATH.
- Conferir antes de rodar o script (se faltar, o erro só aparece na hora da execução).

## Como usar
1. Rodar o script com o caminho do vídeo:
   ```bash
   python scripts/cortar_respiros.py "C:/Users/Joao/Downloads/<video>.mp4"
   ```
   - Default = **enxuto** (margem 0.2s, natural).
   - `--both` gera **duas** versões (enxuto 0.2s e agressivo 0.1s) pro Eric comparar.
   - `--margin 0.1` = mais agressivo · `--margin 0.05` = no talo.
   - `--threshold 6` = sobe o limiar de silêncio (pega respiros mais "altos" que passaram batido).
   Rodar em **background** se o vídeo for longo (encode demora).
2. O script imprime a duração original e a de cada saída, quanto cortou (s e %), e salva como
   `<nome>_enxuto.mp4` / `<nome>_agressivo.mp4` na mesma pasta do original.
3. Entregar os caminhos + a tabela de durações, e **avisar pra assistir e conferir** se nenhum corte
   comeu o começo de uma palavra (risco de cortar colado demais).

## O que é a "margem"
Padding mantido em volta de cada trecho de fala. Maior = mais natural (mantém pausas curtas);
menor = mais corrido. A margem é o que separa "natural" de "robótico/picotado". Default 0.2s costuma
cortar pouco (preserva pausas curtas); 0.1s é o ponto bom pra "cadência seguida".

## Fluxo recomendado
- Rodar `--both` na primeira vez, mostrar as duas durações, deixar o Eric escolher o ponto.
- Esta é a etapa **antes** de gerar a legenda: legendar a versão escolhida (ver skill `gerar-srt`),
  porque os timestamps mudam depois do corte.

## Notas / edge cases
- Rodar Python com path em barra normal (`C:/...`) no Bash do Windows.
- O auto-editor **re-encoda** (gera MP4 novo); overlays/legendas já "chapados" no arquivo vão junto —
  por isso rodar no **clipe de fala cru**, não num vídeo já com B-roll/legenda.
- Se cortar demais e ficar picotado, subir a margem (0.2 → 0.3). Se sobrar respiro, baixar a margem
  ou subir o threshold.
- Pré-requisitos: `auto-editor` (pip install auto-editor) e `ffmpeg`/`ffprobe` no PATH.

## Recursos
- **`scripts/cortar_respiros.py`** — wrapper do auto-editor (margem/threshold, --both, relatório de durações).
