#!/usr/bin/env python3
"""
Corta os trechos bons e concatena -> video-base limpo (com audio sincronizado) OU mp3 limpo.
Uso:
  python cut_base.py <fonte.mp4> pieces.json --out base.mp4 --target 1920x1080 --fps 30
  python cut_base.py <fonte.mp4> pieces.json --out narracao.mp3 --audio [--gap 0.15]

pieces.json: [["rotulo", inicio, fim], ...]  em segundos, na ordem narrativa final.
  - VIDEO: concatena DURO (sem gaps) -> preserva lip-sync. Corte os pulos com motion na composicao.
  - AUDIO (--audio): insere 'gap' de silencio entre os trechos (fala avulsa mais natural).

IMPORTANTE (Windows): passe o caminho da fonte como C:/Users/... (o Python nativo nao entende /c/...).
Imprime os OFFSETS da timeline limpa por trecho (use pra sincronizar os overlays).
"""
import os, sys, json, subprocess, argparse, shutil, tempfile

def norm(p):
    if len(p) > 3 and p[0] == '/' and p[2] == '/' and p[1].isalpha():
        return p[1].upper() + ':' + p[2:]
    return p

def run_ffmpeg(cmd):
    """Roda um comando ffmpeg; em erro, imprime o fim do stderr em vez de engolir."""
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print((r.stderr or "")[-800:], file=sys.stderr)
    return r

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("pieces")
    ap.add_argument("--out", required=True)
    ap.add_argument("--target", default="1920x1080")
    ap.add_argument("--fps", default="30")
    ap.add_argument("--audio", action="store_true")
    ap.add_argument("--gap", type=float, default=0.15)
    ap.add_argument("--crf", default="18")
    ap.add_argument("--keep", action="store_true", help="mantem a pasta temporaria de trabalho (debug)")
    a = ap.parse_args()
    src = norm(a.src)
    pieces = json.load(open(a.pieces))
    W, H = a.target.lower().split("x")
    work = tempfile.mkdtemp(prefix="cutwork-")  # pasta temporaria isolada (nao mexe no CWD)
    files = []; t = 0.0
    print("OFFSETS (timeline limpa):")
    for i, (lbl, s, e) in enumerate(pieces):
        dur = float(e) - float(s)
        if a.audio:
            outp = f"{work}/{i:02d}_{lbl}.wav"
            af = f"afade=t=in:st=0:d=0.02,afade=t=out:st={max(0,dur-0.05):.3f}:d=0.05,aresample=44100"
            run_ffmpeg(["ffmpeg", "-y", "-ss", str(s), "-to", str(e), "-i", src,
                        "-af", af, "-ac", "2", outp])
        else:
            outp = f"{work}/{i:02d}_{lbl}.mp4"
            af = f"afade=t=in:st=0:d=0.02,afade=t=out:st={max(0,dur-0.04):.3f}:d=0.04"
            run_ffmpeg(["ffmpeg", "-y", "-ss", str(s), "-i", src, "-t", f"{dur:.3f}",
                        "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={a.fps},format=yuv420p",
                        "-c:v", "libx264", "-preset", "medium", "-crf", a.crf, "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-af", af, outp])
        ok = os.path.exists(outp) and os.path.getsize(outp) > 0
        print(f"  {lbl:8s} {t:8.2f} -> {t+dur:8.2f}   {'OK' if ok else 'FAIL'}")
        if not ok:
            sys.exit(f"FALHA ao cortar {lbl} (cheque o caminho da fonte: use C:/...)")
        files.append(outp); t += dur
    print(f"TOTAL {round(t,2)}s")

    listf = f"{work}/list.txt"
    with open(listf, "w") as f:
        if a.audio:
            run_ffmpeg(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                        "-t", str(a.gap), f"{work}/sil.wav"])
            for j, fl in enumerate(files):
                f.write(f"file '{os.path.basename(fl)}'\n")
                if j < len(files) - 1:
                    f.write("file 'sil.wav'\n")
        else:
            for fl in files:
                f.write(f"file '{os.path.basename(fl)}'\n")

    if a.audio:
        run_ffmpeg(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", listf, "-c", "copy", f"{work}/m.wav"])
        run_ffmpeg(["ffmpeg", "-y", "-i", f"{work}/m.wav", "-codec:a", "libmp3lame", "-q:a", "2", a.out])
    else:
        run_ffmpeg(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", listf, "-c", "copy", a.out])
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=noprint_wrappers=1:nokey=1", a.out], capture_output=True, text=True)
    print(f"-> {a.out}  ({r.stdout.strip()}s)")
    if a.keep:
        print(f"(debug) pasta de trabalho mantida: {work}")
    else:
        shutil.rmtree(work, ignore_errors=True)

if __name__ == "__main__":
    main()
