"""Opcional - Gancho (cold open) audiovisual.

Copia a FRASE MAIS FORTE do video pro comecinho como abertura: so o apresentador
(sem b-roll), com (1) um efeito visual diferenciado e (2) a mesma frase escrita
numa faixa na tela. Depois uma transicao animada (fadeblack) entra no corpo do
video. A frase continua no lugar original dela tambem.

A frase deve vir COMPLETA (nunca cortada no meio), mesmo que passe um pouco do
tempo. Quem escolhe a frase e o agente, pelos criterios: gera curiosidade,
cria expectativa, ou e forte/polemica.

Uso:
    python etapa5_gancho.py apresentador.mp4 ini fim efeito "FRASE COMPLETA" corpo.mp4 saida.mp4
    efeito = pb | vhs | fantasma | tv_antiga

Depende de ffmpeg + Pillow (pip install pillow).
"""
import subprocess
import sys
import os
import json
from PIL import Image, ImageDraw, ImageFont

SRC = sys.argv[1]
INI = float(sys.argv[2])
FIM = float(sys.argv[3])
EFEITO = sys.argv[4]
FRASE = sys.argv[5].strip()
CORPO = sys.argv[6]
OUT = sys.argv[7]
XF = 0.45
dur_gancho = FIM - INI
FAIXA_PNG = os.path.join(os.environ.get("TEMP", "/tmp"), "gancho_faixa.png")

# cada efeito da uma textura diferente pro cold open se destacar do corpo
EFEITOS = {
    "pb":       "hue=s=0,eq=contrast=1.2:brightness=-0.02,vignette=angle=PI/4",
    "vhs":      "rgbashift=rh=5:bh=-5,curves=preset=vintage,noise=alls=14:allf=t,vignette",
    "fantasma": "tmix=frames=6:weights=1 1 1 1 1 1,eq=brightness=0.04:saturation=0.55,vignette",
    "tv_antiga": "noise=alls=20:allf=t,curves=preset=vintage,eq=contrast=1.12,vignette",
}
fx = EFEITOS.get(EFEITO, EFEITOS["pb"])

# procura uma fonte bold em qualquer SO (Windows, Mac, Linux); cai pro default se nao achar
FONTES = [
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/Arialbd.ttf",
    "/System/Library/Fonts/Supplemental/Arial Black.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
]
fonte_path = next((f for f in FONTES if os.path.exists(f)), None)

W, H = 1080, 1920


def _hex_rgba(h, alpha=235):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


# cor da faixa: usa a cor de marca do elenco (campo opcional "cor_gancho") se houver;
# senao um coral neutro. Leitura tolerante - o gancho funciona mesmo sem elenco.json.
COR_FAIXA = (230, 57, 70, 235)
_elenco = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config", "elenco.json")
try:
    if os.path.exists(_elenco):
        with open(_elenco, encoding="utf-8") as _f:
            _cor = json.load(_f).get("cor_gancho")
        if _cor:
            COR_FAIXA = _hex_rgba(_cor)
except Exception:
    pass
BRANCO = (255, 255, 255, 255)
CONTORNO = (0, 0, 0, 255)
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
texto = FRASE.upper()


def encaixar(t):
    """No maximo 2 linhas; encolhe a fonte de 66 ate 28px ate caber."""
    linhas = []
    for tam in range(66, 27, -2):
        fonte = ImageFont.truetype(fonte_path, tam) if fonte_path else ImageFont.load_default()
        linhas, atual = [], ""
        for palavra in t.split():
            tentativa = (atual + " " + palavra).strip()
            if d.textlength(tentativa, font=fonte) <= 900:
                atual = tentativa
            else:
                linhas.append(atual)
                atual = palavra
        if atual:
            linhas.append(atual)
        if len(linhas) <= 2:
            return fonte, tam, linhas, tam + 10
    return fonte, 28, linhas[:2], 38


fonte, tam, linhas, lh = encaixar(texto)
print(f"fonte={tam}px linhas={len(linhas)}", flush=True)
altura_bloco = lh * len(linhas)
larg_max = max(d.textlength(l, font=fonte) for l in linhas)
pad_x, pad_y = 40, 28

# centro da faixa: meio da tela + 15% (fica no terco inferior)
centro_y = (H // 2) + int(H * 0.15)
bx0 = (W - larg_max) // 2 - pad_x
bx1 = (W + larg_max) // 2 + pad_x
by0 = centro_y - altura_bloco // 2 - pad_y
by1 = centro_y + altura_bloco // 2 + pad_y
if by1 > H - 20:
    desloca = by1 - (H - 20)
    by0 -= desloca
    by1 -= desloca
    centro_y -= desloca
d.rounded_rectangle([bx0, by0, bx1, by1], radius=24, fill=COR_FAIXA)
y = centro_y - altura_bloco // 2
for l in linhas:
    x = (W - d.textlength(l, font=fonte)) // 2
    d.text((x, y), l, font=fonte, fill=BRANCO, stroke_width=4, stroke_fill=CONTORNO)
    y += lh
img.save(FAIXA_PNG)

fc = (
    f"[0:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p,{fx}[g0];"
    f"[g0][2:v]overlay=0:0[g1];[g1]settb=AVTB[gancho];"
    f"[1:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p,settb=AVTB[corpo];"
    f"[gancho][corpo]xfade=transition=fadeblack:duration={XF}:offset={dur_gancho - XF:.2f}[v];"
    f"[0:a]asetpts=PTS-STARTPTS[ga];[1:a]asetpts=PTS-STARTPTS[ca];"
    f"[ga][ca]acrossfade=d={XF}[a]"
)
cmd = ["ffmpeg", "-y", "-ss", f"{INI}", "-to", f"{FIM}", "-i", SRC, "-i", CORPO, "-i", FAIXA_PNG,
       "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
       "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "192k", OUT]
r = subprocess.run(cmd, stderr=subprocess.PIPE)
print("OK " + OUT if r.returncode == 0 else "FALHOU\n" + r.stderr.decode()[-2000:])
