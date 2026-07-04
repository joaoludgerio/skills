#!/usr/bin/env python3
"""Pre-voo de voz (rodar ANTES do elevenlabs_heygen.py, custa centavos).

O eleven_multilingual_v2 troca o timbre da voz pra CERTOS textos, de forma
deterministica (seed e voice_settings nao resolvem). Este script reproduz o split
de blocos do elevenlabs_heygen.py, gera 1 TTS por bloco e roda o checker de voz
em cada um. Bloco reprovado = reescrever a frase (mesmo sentido, ritmo diferente)
e rodar de novo, ate tudo passar. So entao disparar o run de producao.

Uso: python preflight_voz.py <cenas.txt> [--block-seconds 12] [--voice ID] [--env C:/MCPs/elevenlabs.env]
Exit 0 = todos os blocos passaram. Exit 1 = tem bloco reprovado (lista no stdout).
"""
import argparse, json, os, subprocess, sys, tempfile, urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
CHECKER = os.path.join(HERE, "verificar_voz.py")
CHARS_PER_SECOND = 17.5  # manter igual ao elevenlabs_heygen.py
DEFAULT_VOICE = "ASKPogZ3ZKeHiPbzqJws"  # Eric Profissional - Abril-25
MODEL = "eleven_multilingual_v2"


def load_key(env_path):
    for line in open(env_path, encoding="utf-8"):
        if line.startswith("ELEVENLABS_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit(f"ELEVENLABS_API_KEY nao encontrada em {env_path}")


def group_scenes(scenes, block_seconds):
    """Copia fiel do split do elevenlabs_heygen.py (corte so em fim de cena)."""
    max_chars = block_seconds * CHARS_PER_SECOND
    blocks, cur = [], []
    for s in scenes:
        cand = " ".join(cur + [s])
        if cur and len(cand) > max_chars:
            blocks.append(" ".join(cur)); cur = [s]
        else:
            cur.append(s)
    if cur:
        blocks.append(" ".join(cur))
    return blocks


def tts(text, out, key, voice, seed):
    body = {"text": text, "model_id": MODEL, "seed": seed}
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
        data=json.dumps(body).encode(), headers={"xi-api-key": key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        open(out, "wb").write(r.read())


def check(path):
    r = subprocess.run([sys.executable, CHECKER, path], capture_output=True, text=True,
                       env={**os.environ, "PYTHONUTF8": "1"})
    line = (r.stdout or "").strip().splitlines()[-1] if (r.stdout or "").strip() else "sem saida do checker"
    return "OK" in line, line


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cenas_file")
    ap.add_argument("--block-seconds", type=int, default=12)
    ap.add_argument("--voice", default=DEFAULT_VOICE)
    ap.add_argument("--env", default=r"C:\MCPs\elevenlabs.env")
    ap.add_argument("--transcrever", action="store_true",
                    help="transcreve cada bloco com whisper (small) e imprime, pra conferir a "
                         "PRONUNCIA de nomes de ferramenta (ex: Gemini falado errado)")
    args = ap.parse_args()

    if not os.path.exists(CHECKER):
        sys.exit("verificar_voz.py nao encontrado ao lado deste script")
    scenes = [l.strip() for l in open(args.cenas_file, encoding="utf-8") if l.strip()]
    blocks = group_scenes(scenes, args.block_seconds)
    key = load_key(args.env)
    tmp = tempfile.mkdtemp(prefix="prevoo-voz-")
    fails = []
    for n, text in enumerate(blocks, 1):
        mp3 = os.path.join(tmp, f"b{n:02d}.mp3")
        tts(text, mp3, key, args.voice, seed=1000 * n + 1)  # mesmo seed da 1a tentativa do run real
        ok, line = check(mp3)
        print(f"bloco {n}: {'PASS' if ok else 'FAIL'}  ({line})", flush=True)
        if args.transcrever:
            r = subprocess.run(["whisper", mp3, "--language", "Portuguese", "--model", "small",
                                "--output_format", "txt", "--output_dir", tmp],
                               capture_output=True, text=True, env={**os.environ, "PYTHONUTF8": "1"})
            txt = os.path.join(tmp, os.path.splitext(os.path.basename(mp3))[0] + ".txt")
            ouvido = open(txt, encoding="utf-8").read().strip() if os.path.exists(txt) else "(sem transcricao)"
            print(f"   ouvido: {ouvido}", flush=True)
            print(f"   fonte : {text}", flush=True)
        if not ok:
            fails.append((n, text))
    if fails:
        print("\nBLOCOS REPROVADOS — reescrever a frase (mesmo sentido, ritmo/estrutura diferentes) e re-rodar:")
        for n, t in fails:
            print(f"[{n}] {t}")
        sys.exit(1)
    print("\nTODOS OS BLOCOS PASSARAM — liberado pro run de producao.")


if __name__ == "__main__":
    main()
