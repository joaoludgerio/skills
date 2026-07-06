#!/usr/bin/env python3
"""Remove o fundo de um video falado (sem chroma) usando rembg (isnet-general-use).

Modelo permitido: isnet-general-use (preserva objetos como microfone etc.).
u2net_human_seg e PROIBIDO nesta skill (abre buraco em props/objetos no quadro).

Saida: sequencia de PNGs com alpha em <out_dir>/fg-out/f%05d.png, prontos pro
compose (overlay da sequencia sobre o B-roll). O audio segue no video original.

Uso:
  python rembg_video.py <video.mp4> <out_dir> [--crop W:H:X:Y] [--fps 25]
"""
import argparse
import glob
import json
import os
import shutil
import subprocess
import sys
import time


def ensure_ffmpeg_available():
    """Confere se o ffmpeg esta no PATH antes de extrair frames do video."""
    if shutil.which("ffmpeg") is None:
        sys.exit("ERRO: ffmpeg nao encontrado no PATH. Instale o ffmpeg e tente novamente.")


def sidecar_path(fout):
    """Caminho do sidecar que guarda os parametros usados pra gerar os PNGs de fg-out."""
    return os.path.join(fout, "_params.json")


def compute_current_params(args):
    """Monta o dict de parametros da execucao atual (model, crop, fps e dados do video)."""
    video_abspath = os.path.abspath(args.video)
    st = os.stat(video_abspath)
    return {
        "model": args.model,
        "crop": args.crop,
        "fps": args.fps,
        "video": video_abspath,
        "video_mtime": st.st_mtime,
        "video_size": st.st_size,
    }


def load_sidecar(path):
    """Le o sidecar de parametros anterior, se existir e for legivel."""
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def save_sidecar(path, params):
    """Grava o sidecar de parametros da execucao atual."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(params, f, ensure_ascii=False, indent=2)


def describe_param_diff(old_params, new_params):
    """Lista os campos que mudaram entre o sidecar antigo e os parametros atuais."""
    diffs = []
    for key in ("model", "crop", "fps", "video", "video_mtime", "video_size"):
        if old_params.get(key) != new_params.get(key):
            diffs.append(f"{key}: {old_params.get(key)!r} -> {new_params.get(key)!r}")
    return diffs


def ensure_consistent_fg_out(fout, current_params):
    """Se fg-out ja tem PNGs de uma execucao com outros parametros, apaga tudo pra nao misturar.

    Sidecar ausente (execucao antiga, anterior a esse controle) ou com qualquer parametro
    diferente: aviso claro e limpeza total dos frames antigos. Sidecar igual: mantem os PNGs
    (retomada normal apos crash). O glob so pega f*.png, entao nunca apaga o proprio sidecar.
    """
    existentes = glob.glob(os.path.join(fout, "f*.png"))
    if not existentes:
        return
    antigos = load_sidecar(sidecar_path(fout))
    if antigos is None:
        print("aviso: fg-out tem PNGs de uma execucao anterior sem registro de parametros. "
              "Limpando fg-out para nao misturar frames.", flush=True)
    else:
        diffs = describe_param_diff(antigos, current_params)
        if not diffs:
            return
        print("aviso: parametros mudaram desde a ultima execucao, limpando fg-out:", flush=True)
        for d in diffs:
            print(f"   {d}", flush=True)
    for fp in existentes:
        os.remove(fp)


def main():
    ensure_ffmpeg_available()
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

    current_params = compute_current_params(args)
    ensure_consistent_fg_out(fout, current_params)
    save_sidecar(sidecar_path(fout), current_params)

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
