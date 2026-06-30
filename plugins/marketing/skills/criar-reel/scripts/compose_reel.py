#!/usr/bin/env python3
"""Composicao final do Reel (Expert Integrado / criar-reel).

Camadas (de tras pra frente):
  1. B-rolls concatenados em tela cheia (fundo, o tempo todo)
  2. Avatar HeyGen com chromakey (Eric recortado, ancorado embaixo no centro)
  3. Legenda SRT queimada (amarela bold, terco superior, acima da cabeca)

Uso:
  python compose_reel.py --avatar eric-green.mp4 --brolls-dir C:/path/reel --srt legenda.srt --out final.mp4
  Flags: --no-srt (compoe sem legenda) | --fg-height 1320 | --key 0x00FF00

A duracao final = duracao do avatar. Os B-rolls sao concatenados na ordem
(clip-01, clip-02, ...) e cortados/loopados pra cobrir o tempo todo.
"""
import argparse
import glob
import os
import subprocess
import sys
import tempfile


def ffprobe_dur(path):
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]
    )
    return float(out.strip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--avatar", required=True, help="video do HeyGen com fundo verde, OU video original (com --fg-seq)")
    ap.add_argument("--fg-seq", help="dir com PNGs alpha do rembg (f%%05d.png); pula o chromakey")
    ap.add_argument("--fg-fps", default="25", help="fps da sequencia alpha")
    ap.add_argument("--brolls-dir", required=True, help="pasta com clip-NN.mp4")
    ap.add_argument("--srt", help="arquivo .srt corrigido")
    ap.add_argument("--no-srt", action="store_true")
    ap.add_argument("--out", required=True)
    ap.add_argument("--key", default="0x00FF00")
    ap.add_argument("--similarity", default="0.30")
    ap.add_argument("--blend", default="0.10")
    ap.add_argument("--fg-height", type=int, default=1320, help="altura do Eric em px (tela 1920)")
    ap.add_argument("--sub-style", default=(
        "Style: Default,Arial,92,&H0000E6FF,&H0000E6FF,&H00000000,&H00000000,"
        "-1,0,0,0,100,100,0,0,1,9,2,8,40,40,330,1"
    ), help="linha Style do ASS (PlayRes 1080x1920); legenda amarela acima da cabeca")
    args = ap.parse_args()

    clips = sorted(glob.glob(os.path.join(args.brolls_dir, "clip-*.mp4")))
    if not clips:
        sys.exit(f"nenhum clip-*.mp4 em {args.brolls_dir}")

    dur = ffprobe_dur(args.avatar)
    total = sum(ffprobe_dur(c) for c in clips)
    loops = 1
    while total * loops < dur:
        loops += 1
    print(f"avatar: {dur:.1f}s | brolls: {len(clips)} clipes ({total:.1f}s) x{loops} loop(s)", flush=True)

    # concat list (re-encode pra timeline limpa)
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as f:
        for _ in range(loops):
            for c in clips:
                f.write(f"file '{c.replace(os.sep, '/')}'\n")
        concat_list = f.name

    if args.fg_seq:
        fg_chain = f"[2:v]format=rgba,scale=-2:{args.fg_height},fps=30[fg];"
    else:
        fg_chain = (
            f"[0:v]colorkey={args.key}:{args.similarity}:{args.blend},despill=type=green[fgk];"
            f"[fgk]scale=-2:{args.fg_height},fps=30[fg];"
        )
    fc = (
        f"[1:v]scale=1080:1920,setsar=1,fps=30[bg];"
        + fg_chain
        + f"[bg][fg]overlay=(W-w)/2:H-h[comp]"
    )
    out_label = "[comp]"
    if args.srt and not args.no_srt:
        # SRT -> ASS com estilo explicito (force_style e' interpretado errado em alguns builds)
        ass_path = os.path.splitext(args.out)[0] + ".ass"
        subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-i", args.srt, ass_path])
        ass = open(ass_path, encoding="utf-8").read()
        ass = ass.replace("PlayResX: 384", "PlayResX: 1080").replace("PlayResY: 288", "PlayResY: 1920")
        import re
        ass = re.sub(r"^Style: Default,.*$", args.sub_style, ass, count=1, flags=re.M)
        open(ass_path, "w", encoding="utf-8").write(ass)
        ass_f = ass_path.replace("\\", "/").replace(":", "\\:")
        fc += f";[comp]ass='{ass_f}'[sub]"
        out_label = "[sub]"

    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-i", args.avatar,
        "-f", "concat", "-safe", "0", "-i", concat_list,
    ]
    if args.fg_seq:
        cmd += ["-framerate", args.fg_fps, "-i", os.path.join(args.fg_seq, "f%05d.png")]
    cmd += [
        "-filter_complex", fc,
        "-map", out_label, "-map", "0:a?",
        "-t", f"{dur:.3f}",
        "-r", "30", "-vsync", "cfr",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-pix_fmt", "yuv420p",
        args.out,
    ]
    print("compondo...", flush=True)
    subprocess.check_call(cmd)
    os.unlink(concat_list)
    print(f"SAVED -> {args.out} ({ffprobe_dur(args.out):.1f}s)", flush=True)


if __name__ == "__main__":
    main()
