#!/usr/bin/env python3
"""Composicao do Reel com engine Remotion (legenda karaoke + crossfades + end card de CTA).

Alternativa ao compose_reel.py (ffmpeg), validada em producao em 03/07/2026. Hibrido:
o ffmpeg faz o chroma key (avatar vira WebM VP9 com alpha, params comprovados) e o
Remotion faz layout, legenda animada, transicoes e end card. Render local, custo zero.

Uso:
  python compose_remotion.py --reel <pasta-do-reel> --avatar heygen/eric-green.mp4 \
      --srt <arquivo.srt> --cta PALAVRA --cta-sub "que eu te mando o guia no direct" \
      --out video-final-<slug>.mp4
  (--avatar/--srt/--out relativos sao resolvidos dentro de --reel)

Requisitos: Node 18+, ffmpeg. Primeira execucao instala as dependencias do template
num cache persistente (%LOCALAPPDATA%/criar-reel-remotion), ~2 min. Render: ~10 min/58s.
Licenca Remotion: gratuita para individuos/times de ate 3 pessoas; acima disso, licenca paga.
"""
import argparse, glob, json, os, re, shutil, subprocess, sys, tempfile

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.normpath(os.path.join(HERE, "..", "remotion-template"))
CACHE = os.path.join(
    os.environ.get("LOCALAPPDATA") or os.path.expanduser("~/.cache"),
    "criar-reel-remotion",
)


def run(cmd, cwd=None, shell=False):
    r = subprocess.run(cmd, cwd=cwd, shell=shell, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"FALHOU: {cmd}\n{(r.stderr or r.stdout)[-1200:]}")
    return r


def ffprobe_dur(path):
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
               "-of", "csv=p=0", path]).stdout.strip()
    return float(out)


def sync_template():
    """Copia o template pro cache persistente (o cache do plugin e apagado em updates)."""
    os.makedirs(os.path.join(CACHE, "src"), exist_ok=True)
    for rel in ("package.json", "tsconfig.json", "src/index.ts", "src/Root.tsx", "src/Reel.tsx"):
        shutil.copy2(os.path.join(TEMPLATE, rel), os.path.join(CACHE, rel))
    if not os.path.isdir(os.path.join(CACHE, "node_modules")):
        print("[remotion] primeira execucao: npm install no cache (~2 min)...", flush=True)
        run("npm install --no-fund --no-audit", cwd=CACHE, shell=True)


def srt_to_captions(srt_path):
    text = open(srt_path, encoding="utf-8").read()

    def ts(s):
        h, m, rest = s.split(":")
        sec, ms = rest.split(",")
        return int(h) * 3600 + int(m) * 60 + int(sec) + int(ms) / 1000

    caps = []
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = block.strip().splitlines()
        if len(lines) >= 3 and "-->" in lines[1]:
            a, b = [x.strip() for x in lines[1].split("-->")]
            caps.append({"start": ts(a), "end": ts(b), "text": " ".join(lines[2:]).strip()})
    if not caps:
        sys.exit(f"nenhuma legenda parseada de {srt_path}")
    return caps


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reel", required=True, help="pasta do reel (vira o public-dir do Remotion)")
    ap.add_argument("--avatar", default="heygen/eric-green.mp4",
                    help="video do avatar com fundo verde (relativo ao --reel ou absoluto)")
    ap.add_argument("--srt", required=True, help="SRT corrigido (relativo ao --reel ou absoluto)")
    ap.add_argument("--cta", required=True, help="palavra do CTA (vai no pill do end card)")
    ap.add_argument("--cta-sub", default="que eu te mando o material no direct",
                    help="linha abaixo do pill no end card")
    ap.add_argument("--out", required=True, help="mp4 final (relativo ao --reel ou absoluto)")
    ap.add_argument("--key", default="0x00FF00")
    ap.add_argument("--fg-height", type=int, default=1320)
    args = ap.parse_args()

    reel = os.path.abspath(args.reel)
    def resolve(p):
        return p if os.path.isabs(p) else os.path.join(reel, p)
    avatar, srt, out = resolve(args.avatar), resolve(args.srt), resolve(args.out)
    for p, nome in ((avatar, "avatar"), (srt, "srt")):
        if not os.path.exists(p):
            sys.exit(f"{nome} nao encontrado: {p}")

    clips = sorted(glob.glob(os.path.join(reel, "clip-*.mp4")))
    if not clips:
        sys.exit(f"nenhum clip-*.mp4 em {reel}")

    # 1) chroma key -> WebM com alpha (ffmpeg, params comprovados do compose_reel)
    alpha = os.path.join(reel, "eric-alpha.webm")
    if not os.path.exists(alpha):
        print("[1/4] recortando avatar (VP9 alpha, alguns minutos)...", flush=True)
        run(["ffmpeg", "-y", "-v", "error", "-i", avatar,
             "-vf", f"colorkey={args.key}:0.30:0.10,despill=type=green,scale=-2:{args.fg_height}",
             "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "2M", "-an", alpha])
    else:
        print("[1/4] eric-alpha.webm ja existe, reaproveitando", flush=True)

    # 2) audio da fala
    fala = os.path.join(reel, "fala.m4a")
    if not os.path.exists(fala):
        print("[2/4] extraindo audio da fala...", flush=True)
        run(["ffmpeg", "-y", "-v", "error", "-i", avatar, "-vn", "-c:a", "aac", "-b:a", "192k", fala])
    else:
        print("[2/4] fala.m4a ja existe, reaproveitando", flush=True)

    # 3) props (legendas + parametros)
    print("[3/4] preparando template e props...", flush=True)
    sync_template()
    props = {
        "audioSeconds": ffprobe_dur(avatar),
        "clipCount": len(clips),
        "ctaWord": args.cta,
        "ctaSubtitle": args.cta_sub,
        "captions": srt_to_captions(srt),
    }
    props_file = os.path.join(reel, "remotion-props.json")
    json.dump(props, open(props_file, "w", encoding="utf-8"), ensure_ascii=False)

    # 4) render
    print(f"[4/4] renderizando ({props['audioSeconds']:.1f}s, {len(clips)} clips; ~10 min)...", flush=True)
    run(
        f'npx remotion render src/index.ts Reel "{out}" --codec h264 --crf 18 '
        f'--public-dir "{reel}" --props "{props_file}"',
        cwd=CACHE, shell=True,
    )
    print(f"SAVED -> {out} ({ffprobe_dur(out):.1f}s)", flush=True)


if __name__ == "__main__":
    main()
