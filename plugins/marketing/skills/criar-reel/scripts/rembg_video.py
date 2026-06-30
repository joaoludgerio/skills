#!/usr/bin/env python3
"""Remove o fundo de um video falado (sem chroma) usando rembg (u2net_human_seg).

Saida: sequencia de PNGs com alpha em <out_dir>/fg-out/f%05d.png, prontos pro
compose (overlay da sequencia sobre o B-roll). O audio segue no video original.

Uso:
  python rembg_video.py <video.mp4> <out_dir> [--crop W:H:X:Y] [--fps 25]
"""
import argparse
import glob
import os
import subprocess
import sys
import time


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("out_dir")
    ap.add_argument("--crop", help="W:H:X:Y (opcional)")
    ap.add_argument("--fps", default=None, help="default: fps nativo")
    ap.add_argument("--model", default="isnet-general-use",
                    help="isnet-general-use preserva objetos (microfone etc.); u2net_human_seg abre buraco em props")
    args = ap.parse_args()

    fin = os.path.join(args.out_dir, "fg-in")
    fout = os.path.join(args.out_dir, "fg-out")
    os.makedirs(fin, exist_ok=True)
    os.makedirs(fout, exist_ok=True)

    vf = []
    if args.crop:
        w, h, x, y = args.crop.split(":")
        vf.append(f"crop={w}:{h}:{x}:{y}")
    if args.fps:
        vf.append(f"fps={args.fps}")
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", args.video]
    if vf:
        cmd += ["-vf", ",".join(vf)]
    cmd += [os.path.join(fin, "f%05d.png")]
    print("extraindo frames...", flush=True)
    subprocess.check_call(cmd)

    frames = sorted(glob.glob(os.path.join(fin, "f*.png")))
    print(f"{len(frames)} frames -> rembg ({args.model})", flush=True)

    from rembg import new_session, remove
    from PIL import Image

    session = new_session(args.model)
    t0 = time.time()
    for i, fp in enumerate(frames, 1):
        outp = os.path.join(fout, os.path.basename(fp))
        if os.path.exists(outp):
            continue
        img = Image.open(fp)
        out = remove(img, session=session)
        out.save(outp)
        if i % 100 == 0 or i == len(frames):
            rate = i / (time.time() - t0)
            eta = (len(frames) - i) / rate if rate else 0
            print(f"   {i}/{len(frames)} ({rate:.1f} fps, eta {eta/60:.1f} min)", flush=True)

    print(f"DONE -> {fout}", flush=True)


if __name__ == "__main__":
    main()
