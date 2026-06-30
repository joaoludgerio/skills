#!/usr/bin/env python3
"""HeyGen avatar video runner (Expert Integrado / criar-reel) — API v3, multi-cena.

REGRAS DE QUALIDADE (do Eric):
- Motor: SEMPRE Avatar V (engine avatar_v).
- Roteiro NUNCA vai inteiro de uma vez: dividir em CENAS de 1-2 frases.
  Cada cena vira uma geracao separada; no final concatena tudo (jump cut normal de Reel).
- Avatar: Eric 2026 | Voz: Eric Profissional - Abril-25.

Uso:
  python heygen_video.py --scenes-file cenas.txt --out-dir C:/path/heygen [--final eric-green.mp4]
    (cenas.txt: uma cena por linha, 1-2 frases cada; linhas vazias ignoradas)
  python heygen_video.py --text "uma frase so" --out-dir ... (vira 1 cena)

Credenciais em C:\\MCPs\\heygen.env (HEYGEN_API_KEY=...).
Saida: <out-dir>/scene-01.mp4 ... e o concat final com fundo verde.
"""
import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request

ENV_PATH = r"C:\MCPs\heygen.env"
API = "https://api.heygen.com"
AVATAR_ERIC_2026 = "bd4f2d9e3ed342a2999b2f585dacc567"
VOICE_ERIC_PROFISSIONAL = "ad27e0ff57f040f197b3731e53b35244"  # Eric Profissional - Abril-25
GREEN = "#00FF00"


def load_key():
    with open(ENV_PATH, encoding="utf-8") as f:
        for line in f:
            if line.startswith("HEYGEN_API_KEY="):
                return line.split("=", 1)[1].strip()
    sys.exit(f"HEYGEN_API_KEY nao encontrada em {ENV_PATH}")


def call(method, path, key, body=None):
    req = urllib.request.Request(
        API + path,
        data=json.dumps(body).encode() if body else None,
        method=method,
        headers={"x-api-key": key, "Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()}", flush=True)
        raise


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenes-file")
    ap.add_argument("--text")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--final", default="eric-green.mp4")
    ap.add_argument("--avatar", default=AVATAR_ERIC_2026)
    ap.add_argument("--voice", default=VOICE_ERIC_PROFISSIONAL)
    ap.add_argument("--bg", default=GREEN)
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--title", default="criar-reel")
    args = ap.parse_args()

    if args.scenes_file:
        with open(args.scenes_file, encoding="utf-8") as f:
            scenes = [ln.strip() for ln in f if ln.strip()]
    elif args.text:
        scenes = [args.text]
    else:
        sys.exit("passe --scenes-file ou --text")

    os.makedirs(args.out_dir, exist_ok=True)
    key = load_key()

    # 1) submit todas as cenas (paralelo no lado do HeyGen)
    jobs = []
    for i, scene in enumerate(scenes, 1):
        body = {
            "type": "avatar",
            "avatar_id": args.avatar,
            "script": scene,
            "voice_id": args.voice,
            "resolution": "1080p",
            "aspect_ratio": "9:16",
            "engine": {"type": "avatar_v"},
            "title": f"{args.title} - cena {i:02d}",
            "voice_settings": {"speed": args.speed},
            "remove_background": True,
            "background": {"type": "color", "value": args.bg},
            "output_format": "mp4",
        }
        print(f"=== CENA {i}/{len(scenes)} submit ({len(scene)} chars) ===", flush=True)
        resp = call("POST", "/v3/videos", key, body)
        vid = resp["data"]["video_id"]
        jobs.append({"n": i, "video_id": vid, "done": False, "url": None})
        print(f"[cena {i}] video_id={vid}", flush=True)

    # 2) poll ate todas concluirem
    t0 = time.time()
    while not all(j["done"] for j in jobs):
        time.sleep(20)
        for j in jobs:
            if j["done"]:
                continue
            st = call("GET", f"/v3/videos/{j['video_id']}", key)
            data = st.get("data", st)
            status = data.get("status")
            if status == "completed":
                j["done"] = True
                j["url"] = data.get("video_url")
                print(f"[cena {j['n']}] completed ({int(time.time()-t0)}s)", flush=True)
            elif status == "failed":
                print(f"[cena {j['n']}] FAILED: {json.dumps(data.get('error'))}", flush=True)
                sys.exit(1)
        pend = sum(1 for j in jobs if not j["done"])
        if pend:
            print(f"   ...{pend} cena(s) pendente(s) ({int(time.time()-t0)}s)", flush=True)
        if time.time() - t0 > 2700:
            sys.exit("timeout de 45 min no polling")

    # 3) download + CHECKPOINT DE VOZ (anti voz-trocada) + retry
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from verificar_voz import VoiceChecker
    checker = VoiceChecker()

    def download_and_check(j, scene_text):
        """Baixa a cena; se a voz nao for a do Eric, regenera (max 3 tentativas)."""
        mp4 = os.path.join(args.out_dir, f"scene-{j['n']:02d}.mp4")
        for attempt in range(1, 4):
            urllib.request.urlretrieve(j["url"], mp4)
            sim = checker.similarity(mp4)
            if sim >= 0.5:
                print(f"[cena {j['n']}] voz OK (sim={sim:.2f})", flush=True)
                return mp4
            print(f"[cena {j['n']}] VOZ ERRADA (sim={sim:.2f}) — regenerando (tentativa {attempt+1}/3)...", flush=True)
            # IMPORTANTE: variar o speed a cada retry — o HeyGen cacheia renders de
            # requisicoes identicas e devolveria o MESMO video com a voz errada.
            retry_speed = round(args.speed + 0.02 * attempt, 2)
            body = {
                "type": "avatar", "avatar_id": args.avatar, "script": scene_text,
                "voice_id": args.voice, "resolution": "1080p", "aspect_ratio": "9:16",
                "engine": {"type": "avatar_v"}, "title": f"{args.title} - cena {j['n']:02d} retry{attempt}",
                "voice_settings": {"speed": retry_speed},
                "remove_background": True,
                "background": {"type": "color", "value": args.bg},
                "output_format": "mp4",
            }
            vid = call("POST", "/v3/videos", key, body)["data"]["video_id"]
            t1 = time.time()
            while True:
                time.sleep(15)
                st = call("GET", f"/v3/videos/{vid}", key)
                data = st.get("data", st)
                if data.get("status") == "completed":
                    j["url"] = data.get("video_url")
                    break
                if data.get("status") == "failed":
                    sys.exit(f"[cena {j['n']}] retry FAILED: {json.dumps(data.get('error'))}")
                if time.time() - t1 > 900:
                    sys.exit(f"[cena {j['n']}] timeout no retry")
        sys.exit(f"[cena {j['n']}] voz errada apos 3 tentativas — abortando (avisar o Eric)")

    listfile = os.path.join(args.out_dir, "concat.txt")
    with open(listfile, "w", encoding="utf-8") as f:
        for j, scene_text in zip(jobs, scenes):
            print(f"baixando cena {j['n']}...", flush=True)
            mp4 = download_and_check(j, scene_text)
            f.write(f"file '{mp4.replace(os.sep, '/')}'\n")

    final = os.path.join(args.out_dir, args.final)
    subprocess.check_call([
        "ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listfile,
        "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p", final,
    ])
    print(f"FINAL -> {final}", flush=True)


if __name__ == "__main__":
    main()
