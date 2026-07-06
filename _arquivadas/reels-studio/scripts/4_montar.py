"""Etapa 4 - Montagem: apresentador em cima + b-roll na faixa de baixo.

O b-roll (16:9) entra como uma faixa continua no RODAPE do reels 9:16, com uma
borda fina separando, e o apresentador ocupa o topo. Os takes de b-roll sao
distribuidos igualmente ao longo do video.

Dois modos:
  sobrepor : apresentador 1080x1920 inteiro, b-roll sobreposto no rodape.
             Use quando o video NAO tem legenda na parte de baixo.
  cortar   : corta o "teto morto" acima da cabeca do apresentador e empilha o
             b-roll embaixo. Use quando o video JA tem legenda embaixo (assim
             nada cobre a legenda).

Uso:
    python etapa4_montar.py base.mp4 /pasta_dos_takes saida.mp4 [sobrepor|cortar] [corte_y]

Depende so de ffmpeg/ffprobe.
"""
import subprocess
import os
import sys
import glob

sys.path.insert(0, os.path.dirname(__file__))
import config as C

BASE = sys.argv[1]
PASTA_TAKES = sys.argv[2]
OUT = sys.argv[3] if len(sys.argv) > 3 else os.path.join(C.OUTPUT_DIR, "montado_1080.mp4")
MODO = sys.argv[4] if len(sys.argv) > 4 else "cortar"
CORTE_Y = int(sys.argv[5]) if len(sys.argv) > 5 else 400
os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)

FAIXA_W, FAIXA_H = 1080, 608  # 16:9 dentro da largura do reels


def duracao(p):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", p],
        capture_output=True, text=True)
    return float(r.stdout.strip())


dur = duracao(BASE)
takes = sorted(glob.glob(os.path.join(PASTA_TAKES, "*.mp4")))
if not takes:
    raise SystemExit(f"Nenhum take .mp4 em {PASTA_TAKES}")
n = len(takes)
seg = dur / n  # cada take cobre uma fatia igual da timeline

entradas = ["-i", BASE] + sum([["-i", t] for t in takes], [])
fc = []
rotulos = ""
for i in range(1, n + 1):
    # escala o take, deixa 6px de borda no topo separando do apresentador, normaliza
    fc.append(
        f"[{i}:v]trim=0:{seg:.5f},setpts=PTS-STARTPTS,scale={FAIXA_W}:{FAIXA_H - 6},"
        f"pad={FAIXA_W}:{FAIXA_H}:0:6:color=0x222222,fps=30,setsar=1,format=yuv420p[t{i}]"
    )
    rotulos += f"[t{i}]"
fc.append(f"{rotulos}concat=n={n}:v=1:a=0[faixa0]")
# o avatar e o mestre da duracao: estende a faixa (clonando o ultimo frame) ate
# cobrir todo o avatar, pra o shortest/vstack NUNCA cortar a fala do apresentador
# quando ha poucas cenas pra um video longo.
fc.append(f"[faixa0]tpad=stop_mode=clone:stop_duration={dur:.3f},"
          f"trim=0:{dur:.3f},setpts=PTS-STARTPTS[faixa]")

if MODO == "cortar":
    altura_pres = 1920 - FAIXA_H
    fc.append(f"[0:v]crop=1080:{altura_pres}:0:{CORTE_Y},setsar=1,fps=30,format=yuv420p[pres]")
    fc.append(f"[pres][faixa]vstack=2[v]")
else:  # sobrepor
    y = 1920 - FAIXA_H
    fc.append(f"[0:v]fps=30,scale=1080:1920,setsar=1,format=yuv420p[bg]")
    fc.append(f"[bg][faixa]overlay=0:{y}:shortest=1[v]")

cmd = ["ffmpeg", "-y", *entradas, "-filter_complex", ";".join(fc),
       "-map", "[v]", "-map", "0:a",
       "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "160k", OUT]
r = subprocess.run(cmd, stderr=subprocess.PIPE)
print("OK " + OUT if r.returncode == 0 else "FALHOU\n" + r.stderr.decode()[-2000:])
