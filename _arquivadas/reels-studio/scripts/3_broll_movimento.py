"""Etapa 3 - Da movimento ao b-roll (Ken Burns) sem IA de video.

Pega cada imagem aprovada (_16x9.jpg) e gera um take com movimento de camera
suave (zoom/pan) via ffmpeg. E o jeito barato e confiavel de animar: nada de
modelo de video, nenhum custo extra, e a imagem aprovada nunca se deforma.

O tipo de movimento alterna a cada cena (zoom in, zoom out, pan dir, pan esq)
pra dar ritmo ao reels.

Uso:
    python 3_broll_movimento.py /pasta_imagens /pasta_takes [dur_seg]

Depende so de ffmpeg.
"""
import os
import sys
import glob
import subprocess

sys.path.insert(0, os.path.dirname(__file__))
import config as C

PASTA_IMG = sys.argv[1]
PASTA_TAKES = sys.argv[2] if len(sys.argv) > 2 else os.path.join(C.OUTPUT_DIR, "takes")
DUR = float(sys.argv[3]) if len(sys.argv) > 3 else 5.0
os.makedirs(PASTA_TAKES, exist_ok=True)

W, H = 1536, 864
FPS = 30
FRAMES = int(DUR * FPS)
ZMAX = 1.18  # zoom maximo (18%) - sutil, sem parecer videogame


def filtro(mov):
    """Monta o filtro zoompan pro tipo de movimento. Upscale 2x antes reduz tremor."""
    base = f"scale={W*2}:{H*2}:flags=lanczos,"
    cx = "iw/2-(iw/zoom/2)"
    cy = "ih/2-(ih/zoom/2)"
    if mov == "zoom_in":
        z = f"min(zoom+{(ZMAX-1)/FRAMES:.6f},{ZMAX})"
        x, y = cx, cy
    elif mov == "zoom_out":
        # comeca ampliado e abre (zoom decrescente)
        z = f"max({ZMAX}-on*{(ZMAX-1)/FRAMES:.6f},1.0)"
        x, y = cx, cy
    elif mov == "pan_dir":
        z = f"{ZMAX}"
        x = f"(iw-iw/zoom)*on/{FRAMES}"
        y = cy
    else:  # pan_esq
        z = f"{ZMAX}"
        x = f"(iw-iw/zoom)*(1-on/{FRAMES})"
        y = cy
    return (f"{base}zoompan=z='{z}':x='{x}':y='{y}':d={FRAMES}:s={W}x{H}:fps={FPS},"
            f"format=yuv420p")


MOVS = ["zoom_in", "pan_dir", "zoom_out", "pan_esq"]
imagens = sorted(glob.glob(os.path.join(PASTA_IMG, "*_16x9.jpg")))
if not imagens:
    raise SystemExit(f"Nenhuma imagem *_16x9.jpg em {PASTA_IMG}")

for i, img in enumerate(imagens):
    nome = os.path.basename(img).replace("_16x9.jpg", "")
    out = os.path.join(PASTA_TAKES, f"{nome}.mp4")
    mov = MOVS[i % len(MOVS)]
    cmd = ["ffmpeg", "-y", "-loop", "1", "-i", img, "-t", f"{DUR}",
           "-vf", filtro(mov), "-r", str(FPS),
           "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", out]
    r = subprocess.run(cmd, stderr=subprocess.PIPE)
    print(f"{'OK' if r.returncode == 0 else 'FALHOU'} {nome} ({mov})"
          + ("" if r.returncode == 0 else "\n" + r.stderr.decode()[-800:]), flush=True)

print("TAKES PRONTOS ->", PASTA_TAKES)
