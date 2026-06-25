#!/usr/bin/env python3
"""HeyGen avatar video runner (criar-reel) — API v3, multi-cena.

REGRAS DE QUALIDADE:
- Motor: SEMPRE Avatar V (engine avatar_v).
- Roteiro NUNCA vai inteiro de uma vez: dividir em CENAS de 1-2 frases.
  Cada cena vira uma geracao separada; no final concatena tudo (jump cut normal de Reel).
- Termos que o TTS fala errado: escrever foneticamente no roteiro (ex: "CLAUDI" em vez de
  "Claude") e corrigir a grafia na legenda depois.

CONFIG (credentials.env na raiz do skill, ou variaveis de ambiente):
  HEYGEN_API_KEY=...        (obrigatoria)
  HEYGEN_AVATAR_ID=...      (obrigatoria — o ID do SEU avatar no HeyGen)
  HEYGEN_VOICE_ID=...       (obrigatoria — o ID da SUA voz clonada)

CHECKPOINT DE VOZ (opcional, recomendado): o HeyGen as vezes troca a voz por uma
generica. Se existir assets/voice-ref.wav (amostra da voz certa) e o modelo
assets/speaker-embed.onnx, cada cena e verificada e regenerada sozinha se vier errada.
Sem esses arquivos, o checkpoint e pulado com um aviso.

Uso:
  python heygen_video.py --scenes-file cenas.txt --out-dir <reel>/heygen [--final avatar-green.mp4]
  python heygen_video.py --text "uma frase so" --out-dir ...
"""
import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(SKILL_DIR, "credentials.env")
API = "https://api.heygen.com"
GREEN = "#00FF00"


def load_env():
    d = {}
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    d[k.strip()] = v.strip()
    for k in ("HEYGEN_API_KEY", "HEYGEN_AVATAR_ID", "HEYGEN_VOICE_ID"):
        if os.environ.get(k):
            d[k] = os.environ[k]
    return d


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
    ap.add_argument("--final", default="avatar-green.mp4")
    ap.add_argument("--avatar", default=None, help="override do HEYGEN_AVATAR_ID")
    ap.add_argument("--voice", default=None, help="override do HEYGEN_VOICE_ID")
    ap.add_argument("--bg", default=GREEN)
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--title", default="criar-reel")
    args = ap.parse_args()

    env = load_env()
    key = env.get("HEYGEN_API_KEY")
    avatar = args.avatar or env.get("HEYGEN_AVATAR_ID")
    voice = args.voice or env.get("HEYGEN_VOICE_ID")
    if not key:
        sys.exit(f"HEYGEN_API_KEY nao configurada — preencha {ENV_PATH} (veja credentials.env.example)")
    if not avatar or not voice:
        sys.exit("HEYGEN_AVATAR_ID e HEYGEN_VOICE_ID sao obrigatorios — preencha o credentials.env "
                 "com os IDs do SEU avatar e da SUA voz (liste com GET /v2/avatars e /v2/voices).")

    if args.scenes_file:
        with open(args.scenes_file, encoding="utf-8") as f:
            scenes = [ln.strip() for ln in f if ln.strip()]
    elif args.text:
        scenes = [args.text]
    else:
        sys.exit("passe --scenes-file ou --text")

    os.makedirs(args.out_dir, exist_ok=True)

    def make_body(scene_text, n, speed, label=""):
        return {
            "type": "avatar", "avatar_id": avatar, "script": scene_text,
            "voice_id": voice, "resolution": "1080p", "aspect_ratio": "9:16",
            "engine": {"type": "avatar_v"}, "title": f"{args.title} - cena {n:02d}{label}",
            "voice_settings": {"speed": speed},
            "remove_background": True,
            "background": {"type": "color", "value": args.bg},
            "output_format": "mp4",
        }

    # 1) submit todas as cenas
    jobs = []
    for i, scene in enumerate(scenes, 1):
        print(f"=== CENA {i}/{len(scenes)} submit ({len(scene)} chars) ===", flush=True)
        resp = call("POST", "/v3/videos", key, make_body(scene, i, args.speed))
        vid = resp["data"]["video_id"]
        jobs.append({"n": i, "video_id": vid, "done": False, "url": None})
        print(f"[cena {i}] video_id={vid}", flush=True)

    # 2) poll
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

    # 3) download + checkpoint de voz (opcional) + retry com quebra-cache
    checker = None
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from verificar_voz import DEFAULT_MODEL, DEFAULT_REF, VoiceChecker
        if os.path.exists(DEFAULT_MODEL) and os.path.exists(DEFAULT_REF):
            checker = VoiceChecker()
        else:
            print("AVISO: checkpoint de voz desativado (assets/voice-ref.wav ou "
                  "assets/speaker-embed.onnx ausentes — veja o README).", flush=True)
    except Exception as e:
        print(f"AVISO: checkpoint de voz indisponivel ({e}) — seguindo sem verificar.", flush=True)

    def download_and_check(j, scene_text):
        mp4 = os.path.join(args.out_dir, f"scene-{j['n']:02d}.mp4")
        for attempt in range(1, 4):
            urllib.request.urlretrieve(j["url"], mp4)
            if checker is None:
                return mp4
            sim = checker.similarity(mp4)
            if sim >= 0.5:
                print(f"[cena {j['n']}] voz OK (sim={sim:.2f})", flush=True)
                return mp4
            # IMPORTANTE: variar o speed a cada retry — o HeyGen cacheia renders de
            # requisicoes identicas e devolveria o MESMO video com a voz errada.
            retry_speed = round(args.speed + 0.02 * attempt, 2)
            print(f"[cena {j['n']}] VOZ ERRADA (sim={sim:.2f}) — regenerando "
                  f"(speed {retry_speed})...", flush=True)
            vid = call("POST", "/v3/videos", key,
                       make_body(scene_text, j["n"], retry_speed, f" retry{attempt}"))["data"]["video_id"]
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
        sys.exit(f"[cena {j['n']}] voz errada apos 3 tentativas — abortando")

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
