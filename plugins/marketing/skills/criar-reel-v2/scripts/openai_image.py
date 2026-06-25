#!/usr/bin/env python3
"""Gerador de frames/thumb via OpenAI GPT Image 2 (criar-reel-v2).

Substitui o Nano Banana da v1. Mesmo uso conceitual: 1 frame 9:16 por clipe.

Uso:
  python openai_image.py --prompt "..." --out C:/path/frame-01.png [--size 1024x1792] [--quality high]

Credenciais em C:\\MCPs\\openai.env (OPENAI_API_KEY=...).
Modelo: gpt-image-2 (endpoint v1/images/generations, resposta b64_json).
"""
import argparse
import base64
import json
import os
import sys
import urllib.request

ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "credentials.env")
API = "https://api.openai.com/v1/images/generations"
MODEL = "gpt-image-2"


def load_key():
    if os.environ.get("OPENAI_API_KEY"):
        return os.environ["OPENAI_API_KEY"]
    try:
        with open(ENV_PATH, encoding="utf-8") as f:
            for line in f:
                if line.startswith("OPENAI_API_KEY="):
                    return line.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    sys.exit(f"OPENAI_API_KEY nao encontrada em {ENV_PATH}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--size", default="1024x1792", help="retrato 9:16; fallback automatico p/ 1024x1536")
    ap.add_argument("--quality", default="high", choices=["low", "medium", "high"])
    args = ap.parse_args()

    key = load_key()

    def call(size):
        body = json.dumps({
            "model": MODEL, "prompt": args.prompt, "size": size,
            "quality": args.quality, "n": 1,
        }).encode()
        req = urllib.request.Request(
            API, data=body, method="POST",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.load(r)

    try:
        resp = call(args.size)
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        if "size" in err and args.size != "1024x1536":
            print(f"size {args.size} recusado, tentando 1024x1536...", flush=True)
            resp = call("1024x1536")
        else:
            print("ERRO:", err, flush=True)
            sys.exit(1)

    b64 = resp["data"][0]["b64_json"]
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "wb") as f:
        f.write(base64.b64decode(b64))
    print(f"SAVED -> {args.out}", flush=True)


if __name__ == "__main__":
    main()
