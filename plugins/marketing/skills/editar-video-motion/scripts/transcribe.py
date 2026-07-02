#!/usr/bin/env python3
"""
Transcreve um video/audio com ElevenLabs Scribe (timestamps por palavra).
Uso:  python transcribe.py <input.mp4|audio.mp3> [out.json]
Saidas: out.json (default transcript.json) + <input>-audio.mp3 (audio cru, se for video)

Procura a chave em: $ELEVENLABS_API_KEY, C:/MCPs/elevenlabs.env, ~/.config/elevenlabs.env
"""
import os, sys, subprocess, json, tempfile

def norm(p):  # /c/Users/... -> C:/Users/...
    if len(p) > 3 and p[0] == '/' and p[2] == '/' and p[1].isalpha():
        return p[1].upper() + ':' + p[2:]
    return p

def find_key():
    if os.environ.get("ELEVENLABS_API_KEY"):
        return os.environ["ELEVENLABS_API_KEY"].strip()
    for c in [r"C:/MCPs/elevenlabs.env", os.path.expanduser("~/.config/elevenlabs.env"),
              os.path.expanduser("~/elevenlabs.env")]:
        if os.path.exists(c):
            for line in open(c, encoding="utf-8"):
                line = line.strip()
                if line.startswith("ELEVENLABS_API_KEY="):
                    val = line.split("=", 1)[1]
                    return val.strip().strip('"').strip("'")
    sys.exit("ERRO: chave ElevenLabs nao encontrada (ELEVENLABS_API_KEY ou elevenlabs.env)")

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    inp = norm(sys.argv[1])
    out = sys.argv[2] if len(sys.argv) > 2 else "transcript.json"
    key = find_key()

    # se for video, extrai audio mp3 (e guarda como <base>-audio.mp3)
    ext = os.path.splitext(inp)[1].lower()
    if ext in (".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"):
        # grava o mp3 ao lado do arquivo de input (mesma pasta), nao no CWD
        audio = os.path.splitext(inp)[0] + "-audio.mp3"
        r_ff = subprocess.run(["ffmpeg", "-y", "-i", inp, "-vn", "-codec:a", "libmp3lame",
                               "-q:a", "2", audio], capture_output=True, text=True)
        if r_ff.returncode != 0:
            print((r_ff.stderr or "")[-800:], file=sys.stderr)
            sys.exit(f"ERRO: ffmpeg falhou ao extrair o audio de {inp} (returncode {r_ff.returncode}). Veja o stderr acima.")
        print("audio cru ->", audio)
    else:
        audio = inp

    print("transcrevendo (ElevenLabs Scribe)...")
    r = subprocess.run([
        "curl", "-s", "-X", "POST", "https://api.elevenlabs.io/v1/speech-to-text",
        "-H", f"xi-api-key: {key}",
        "-F", "model_id=scribe_v1", "-F", "language_code=por",
        "-F", "timestamps_granularity=word", "-F", "diarize=false",
        "-F", f"file=@{audio};type=audio/mpeg",
        "-o", out, "-w", "%{http_code}"
    ], capture_output=True, text=True)
    code = (r.stdout or "").strip()
    if code != "200":
        sys.exit(f"ERRO STT HTTP {code}: {open(out).read()[:300] if os.path.exists(out) else r.stderr}")
    d = json.load(open(out, encoding="utf-8"))
    print(f"OK -> {out}  ({round(d.get('audio_duration_secs',0),1)}s, {len(d.get('words',[]))} tokens)")

if __name__ == "__main__":
    main()
