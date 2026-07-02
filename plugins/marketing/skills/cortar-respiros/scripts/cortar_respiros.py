#!/usr/bin/env python3
"""
Corta os respiros/pausas de um vídeo com auto-editor (que roda sobre o FFmpeg),
mantendo áudio e vídeo em sincronia. Suprime as barras de progresso e imprime um
resumo limpo de antes/depois.

Usage:
    python cortar_respiros.py "C:/.../video.mp4"                 # enxuto (margem 0.2s)
    python cortar_respiros.py "C:/.../video.mp4" --margin 0.1    # mais agressivo
    python cortar_respiros.py "C:/.../video.mp4" --both          # gera enxuto E agressivo
    python cortar_respiros.py "C:/.../video.mp4" --threshold 6   # sobe o limiar de silêncio
    python cortar_respiros.py "C:/.../video.mp4" --out "C:/.../saida.mp4"

Margem = padding mantido em volta da fala. Maior = mais natural; menor = mais corrido.
  0.2s ~ enxuto (natural) · 0.1s ~ agressivo (sem respiro) · 0.05s ~ no talo.
Requer: auto-editor (pip install auto-editor) e ffmpeg/ffprobe no PATH.
"""
import sys, os, subprocess

# Console do Windows pode estar em cp1252 quando pipado: forca UTF-8 pra nao
# estourar UnicodeEncodeError nas mensagens com acento.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nk=1:nw=1", path], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return None


def mmss(s):
    return f"{int(s // 60)}:{int(s % 60):02d}" if s is not None else "?"


def run_autoeditor(src, out, margin, threshold):
    cmd = [sys.executable, "-m", "auto_editor", src, "--margin", f"{margin}sec", "-o", out]
    if threshold is not None:
        cmd += ["--edit", f"audio:threshold={threshold}%"]
    print(f"-> cortando (margem {margin}s{', limiar '+str(threshold)+'%' if threshold else ''})...", flush=True)
    # captura a saída pra esconder as barras de progresso
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout[-800:]); print(r.stderr[-800:])
        raise SystemExit(f"auto-editor falhou (margem {margin}).")


def out_name(src, margin, explicit):
    if explicit:
        return explicit
    base, ext = os.path.splitext(src)
    if margin >= 0.2:
        tag = "enxuto"
    elif margin <= 0.1:
        tag = "agressivo"
    else:
        tag = "cortado"
    return f"{base}_{tag}{ext}"


def process(src, margin, threshold, explicit_out, orig_dur):
    out = out_name(src, margin, explicit_out)
    run_autoeditor(src, out, margin, threshold)
    d = duration(out)
    cut = (orig_dur - d) if (orig_dur and d) else None
    if cut is not None:
        pct = (cut / orig_dur * 100) if orig_dur else 0.0
        print(f"   {os.path.basename(out)}  ->  {mmss(d)}  (cortou {cut:.1f}s, {pct:.0f}%)")
    else:
        print(f"   {out}")
    return out


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0 if len(sys.argv) >= 2 else
                 "usage: python cortar_respiros.py <video> [--margin 0.2] [--both] [--threshold N] [--out f.mp4]")
    src = sys.argv[1]
    args = sys.argv[2:]
    if not os.path.exists(src):
        sys.exit(f"ERRO: arquivo não encontrado: {src}")
    margin = 0.2; threshold = None; explicit_out = None; both = False
    for i, a in enumerate(args):
        if a == "--margin" and i + 1 < len(args): margin = float(args[i + 1])
        if a == "--threshold" and i + 1 < len(args): threshold = float(args[i + 1])
        if a == "--out" and i + 1 < len(args): explicit_out = args[i + 1]
        if a == "--both": both = True

    orig = duration(src)
    print(f"ORIGINAL: {mmss(orig)} ({orig:.1f}s)" if orig else "ORIGINAL: ?")

    if both:
        process(src, 0.2, threshold, None, orig)
        process(src, 0.1, threshold, None, orig)
    else:
        process(src, margin, threshold, explicit_out, orig)
    print("\nPronto. Assista e confira se nenhum corte comeu o começo de palavra.")


if __name__ == "__main__":
    main()
