#!/usr/bin/env python3
"""Pre-voo de voz (rodar ANTES do elevenlabs_heygen.py, custa centavos).

O eleven_multilingual_v2 troca o timbre da voz pra CERTOS textos, de forma
deterministica (seed e voice_settings nao resolvem). Este script reproduz o split
de blocos do elevenlabs_heygen.py, gera 1 TTS por bloco e roda o checker de voz
em cada um. Bloco reprovado = reescrever a frase (mesmo sentido, ritmo diferente)
e rodar de novo, ate tudo passar. So entao disparar o run de producao.

Cache: cada bloco (voz + modelo + texto) so paga TTS uma vez em
<pasta do cenas.txt>/.prevoo-cache/ - re-rodar o preflight num bloco ja
aprovado nao gasta credito de novo (o check local em cima do audio e gratis).

Uso: python preflight_voz.py <cenas.txt> [--block-seconds 12] [--voice ID] [--env C:/MCPs/elevenlabs.env]
Exit 0 = todos os blocos passaram. Exit 1 = tem bloco reprovado (lista no stdout).
"""
import argparse, hashlib, json, os, subprocess, sys, urllib.request

from comum import CHARS_PER_SECOND, VOICE_ELEVEN_ERIC, group_scenes, ensure_tools

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
CHECKER = os.path.join(HERE, "verificar_voz.py")
MODEL = "eleven_multilingual_v2"


def load_key(env_path):
    for line in open(env_path, encoding="utf-8"):
        if line.startswith("ELEVENLABS_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit(f"ELEVENLABS_API_KEY nao encontrada em {env_path}")


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
    ensure_tools("ffmpeg")
    ap = argparse.ArgumentParser()
    ap.add_argument("cenas_file")
    ap.add_argument("--block-seconds", type=int, default=12)
    ap.add_argument("--voice", default=VOICE_ELEVEN_ERIC)
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
    # Cache por conteudo (voz + modelo + texto do bloco): re-rodar num bloco ja
    # aprovado nao paga TTS de novo. Fica do lado do cenas.txt (nao some no /tmp).
    cache_dir = os.path.join(os.path.dirname(os.path.abspath(args.cenas_file)), ".prevoo-cache")
    os.makedirs(cache_dir, exist_ok=True)
    fails = []
    for n, text in enumerate(blocks, 1):
        chave = hashlib.md5((args.voice + MODEL + text).encode("utf-8")).hexdigest()
        mp3 = os.path.join(cache_dir, f"b-{chave}.mp3")
        cache_hit = os.path.exists(mp3) and os.path.getsize(mp3) > 0
        if not cache_hit:
            tts(text, mp3, key, args.voice, seed=1000 * n + 1)  # mesmo seed da 1a tentativa do run real
        ok, line = check(mp3)
        tag = " (cache)" if cache_hit else ""
        print(f"bloco {n}: {'PASS' if ok else 'FAIL'}{tag}  ({line})", flush=True)
        if args.transcrever:
            # whisper grava "<basename do mp3>.txt" no output_dir - como o mp3 ja se
            # chama "b-<chave>.mp3", o .txt cai automaticamente na mesma chave de cache.
            txt = os.path.join(cache_dir, f"b-{chave}.txt")
            if not os.path.exists(txt):
                subprocess.run(["whisper", mp3, "--language", "Portuguese", "--model", "small",
                                "--output_format", "txt", "--output_dir", cache_dir],
                               capture_output=True, text=True, env={**os.environ, "PYTHONUTF8": "1"})
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
