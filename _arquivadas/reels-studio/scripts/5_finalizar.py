"""Etapa 5 - Acabamento final: CTA + musica de fundo + export.

Anexa um card de CTA no fim (opcional, com transicao suave em vez de corte
seco), mistura uma musica de fundo bem discreta (nunca por cima da fala) e
exporta. Se nao passar CTA nem musica, so reexporta o video.

Uso:
    python etapa6_finalizar.py montado.mp4 saida.mp4 [cta.mp4] [musica.mp3] [--4k]

A musica e achatada e abaixada de proposito: loudnorm tira o crescendo e o
volume cai pra 38%, mixado mantendo a fala cheia (normalize=0).

Depende so de ffmpeg/ffprobe.
"""
import subprocess
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import config as C

args = [a for a in sys.argv[1:] if a != "--4k"]
QUER_4K = "--4k" in sys.argv

BASE = args[0]
OUT = args[1] if len(args) > 1 else os.path.join(C.OUTPUT_DIR, "final.mp4")
CTA = args[2] if len(args) > 2 and os.path.exists(args[2]) else None
MUSICA = args[3] if len(args) > 3 and os.path.exists(args[3]) else None
os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
HD = OUT.replace(".mp4", "_1080.mp4") if QUER_4K else OUT


def duracao(p):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", p],
        capture_output=True, text=True)
    return float(r.stdout.strip())


dur = duracao(BASE)
XF = 0.7

entradas = ["-i", BASE]
idx = 1
i_cta = i_mus = None
if CTA:
    entradas += ["-i", CTA]
    i_cta = idx
    idx += 1
if MUSICA:
    entradas += ["-i", MUSICA]
    i_mus = idx
    idx += 1

fc = []
if CTA:
    dur_cta = duracao(CTA)
    total = dur + dur_cta - XF
    fc.append(f"[0:v]fps=30,scale=1080:1920,setsar=1,format=yuv420p,settb=AVTB[bv]")
    fc.append(f"[{i_cta}:v]fps=30,scale=1080:1920,setsar=1,format=yuv420p,settb=AVTB[cv]")
    fc.append(f"[bv][cv]xfade=transition=fade:duration={XF}:offset={dur - XF:.2f}[vout]")
    fc.append(f"[0:a]apad=pad_dur={dur_cta - XF + 0.05:.2f}[fala]")
    fala = "[fala]"
else:
    total = dur
    fc.append("[0:v]format=yuv420p[vout]")
    fala = "[0:a]"

if MUSICA:
    fc.append(
        f"[{i_mus}:a]atrim=0:{total:.2f},asetpts=PTS-STARTPTS,"
        f"loudnorm=I=-34:TP=-6:LRA=6,volume=0.38,"
        f"afade=t=in:st=0:d=1.2,afade=t=out:st={total - 1.5:.2f}:d=1.5[bg]")
    fc.append(f"{fala}[bg]amix=inputs=2:duration=first:normalize=0[aout]")
    audio = "[aout]"
elif CTA:
    audio = fala            # label do filtergraph (apad da fala) -> [fala]
else:
    audio = "0:a"           # sem processamento: mapeia o stream de audio direto do input

cmd = ["ffmpeg", "-y", *entradas, "-filter_complex", ";".join(fc),
       "-map", "[vout]", "-map", audio,
       "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "192k", HD]
r = subprocess.run(cmd, stderr=subprocess.PIPE)
if r.returncode:
    print("FALHOU\n", r.stderr.decode()[-2000:])
    sys.exit(1)

if QUER_4K:
    r2 = subprocess.run(
        ["ffmpeg", "-y", "-i", HD, "-vf", "scale=2160:3840:flags=lanczos",
         "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "copy", OUT],
        stderr=subprocess.PIPE)
    print("OK " + OUT if r2.returncode == 0 else "FALHA 4K\n" + r2.stderr.decode()[-1500:])
else:
    print("OK " + HD)
