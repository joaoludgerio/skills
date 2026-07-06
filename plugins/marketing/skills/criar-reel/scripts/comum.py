#!/usr/bin/env python3
"""Fonte unica de constantes e funcoes compartilhadas do pipeline criar-reel.

Antes deste arquivo, AVATAR_ERIC_2026, VOICE_ELEVEN_ERIC, CHARS_PER_SECOND e
group_scenes() estavam copiados byte a byte em elevenlabs_heygen.py,
heygen_video.py e/ou preflight_voz.py: mudar a voz ou o ritmo de split exigia
lembrar de editar em varios lugares (e um dia alguem ia esquecer um).

Pra mudar avatar, voz ou o ritmo de split de blocos: editar AQUI (ver
SETUP.md), nunca nos scripts individuais.

Uso: os scripts rodam direto ("python elevenlabs_heygen.py ..." ou
"python scripts/elevenlabs_heygen.py ..."), entao sys.path[0] ja e o
diretorio deste arquivo e "from comum import ..." funciona sem nenhum
sys.path.insert.
"""
import shutil
import sys

AVATAR_ERIC_2026 = "bd4f2d9e3ed342a2999b2f585dacc567"

VOICE_ELEVEN_ERIC = "ASKPogZ3ZKeHiPbzqJws"  # Eric Profissional - Abril-25 (PVC professional)
# Escolha do Joao em 25/06/2026. Anterior: "pvrRNrLjbQYSX1OUhj24" (Eric - Maio/2026, clone).

# Voz Eric Profissional no eleven_multilingual_v2: ~17.5 chars/segundo (calibrado em
# 11/06/2026: 707 chars -> 36.5s). Usado so pra AGRUPAR cenas em blocos - nao precisa ser exato.
CHARS_PER_SECOND = 17.5


def group_scenes(scenes, block_seconds):
    """Agrupa cenas consecutivas em blocos de ~block_seconds (corte só em fim de cena)."""
    max_chars = block_seconds * CHARS_PER_SECOND
    blocks, cur = [], []
    for s in scenes:
        cand = " ".join(cur + [s])
        if cur and len(cand) > max_chars:
            blocks.append(" ".join(cur))
            cur = [s]
        else:
            cur.append(s)
    if cur:
        blocks.append(" ".join(cur))
    return blocks


def ensure_tools(*tools):
    """Confere que os binarios externos (ffmpeg, ffprobe...) estao no PATH ANTES de
    gastar credito de API. Descobrir que falta o ffmpeg SO depois de pagar TTS/HeyGen
    e o pior momento possivel: aqui falha rapido e de graca."""
    faltam = [t for t in tools if shutil.which(t) is None]
    if faltam:
        sys.exit(f"ERRO: nao encontrei no PATH: {', '.join(faltam)}. Instale e tente novamente.")
