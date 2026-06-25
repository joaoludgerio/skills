#!/usr/bin/env python3
"""Runner de B-roll via Higgsfield CLI (criar-reel-v2) — image-to-video.

Substitui o kling_i2v.py da v1. Le o MESMO formato de manifesto (frames_dir,
output_dir, clips[{n, frame, prompt}]), mas gera no Higgsfield:
  upload do frame -> generate create <model> -> wait -> download mp4.

Uso:
  python higgsfield_i2v.py <manifest.json>           # todos os clipes
  python higgsfield_i2v.py <manifest.json> 1         # so o clipe 1 (validacao)
  python higgsfield_i2v.py <manifest.json> 3 5 7     # re-disparo seletivo

Requisitos: Higgsfield CLI no PATH e autenticado (`hf auth login`, uma vez, no navegador).
Instalacao: npm install -g @higgsfield/cli (ou baixe o binario dos releases do GitHub deles).
No manifesto, "model" = modelo de video do Higgsfield (ver `hf model list --video`).
"""
import json
import os
import re
import subprocess
import sys
import urllib.request

import shutil
HF = os.environ.get("HF_CLI") or shutil.which("hf") or shutil.which("higgsfield") or "hf"


def run(args, parse_json=True):
    r = subprocess.run([HF] + args + (["--json"] if parse_json else []),
                       capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        print(f"HF ERRO: {' '.join(args)}\n{r.stdout}\n{r.stderr}", flush=True)
        return None
    if parse_json:
        try:
            return json.loads(r.stdout)
        except json.JSONDecodeError:
            # alguns comandos imprimem texto antes do JSON
            m = re.search(r"\{.*\}", r.stdout, re.S)
            return json.loads(m.group(0)) if m else {"raw": r.stdout}
    return r.stdout


def find_url(obj):
    """Acha a primeira URL de video no JSON de resultado."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and v.startswith("http") and (".mp4" in v or "video" in k.lower() or "url" in k.lower()):
                return v
            r = find_url(v)
            if r:
                return r
    elif isinstance(obj, list):
        for it in obj:
            r = find_url(it)
            if r:
                return r
    return None


def find_id(obj, keys=("id", "job_id", "upload_id", "generation_id")):
    if isinstance(obj, dict):
        for k in keys:
            if k in obj and isinstance(obj[k], str):
                return obj[k]
        for v in obj.values():
            r = find_id(v, keys)
            if r:
                return r
    elif isinstance(obj, list):
        # `generate create --json` retorna ["<job_id>"] (lista de UUIDs em string)
        if obj and isinstance(obj[0], str) and obj[0]:
            return obj[0]
        for it in obj:
            r = find_id(it, keys)
            if r:
                return r
    return None


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    manifest = json.load(open(sys.argv[1], encoding="utf-8"))
    only = [int(a) for a in sys.argv[2:]] if len(sys.argv) > 2 else None

    frames_dir = manifest["frames_dir"]
    out_dir = manifest["output_dir"]
    model = manifest.get("model", "")
    if not model:
        sys.exit("manifesto sem 'model' — rode `hf model list --video` e escolha um")
    extra = manifest.get("hf_flags", [])  # ex: ["--duration","5","--aspect-ratio","9:16"]

    ok = 0
    todo = [c for c in manifest["clips"] if only is None or c["n"] in only]
    for clip in todo:
        n, frame, prompt = clip["n"], clip["frame"], clip["prompt"]
        fpath = os.path.join(frames_dir, frame)
        print(f"\n=== CLIP {n}  ({frame}) ===", flush=True)

        up = run(["upload", "create", fpath])
        upload_id = find_id(up) if up else None
        if not upload_id:
            print(f"[clip {n}] ERRO no upload", flush=True)
            continue
        print(f"[clip {n}] upload_id={upload_id}", flush=True)

        job = run(["generate", "create", model, "--prompt", prompt, "--image", upload_id] + extra)
        job_id = find_id(job) if job else None
        if not job_id:
            print(f"[clip {n}] ERRO no create", flush=True)
            continue
        print(f"[clip {n}] job_id={job_id} — aguardando...", flush=True)

        res = run(["generate", "wait", job_id])
        url = find_url(res) if res else None
        if not url:
            print(f"[clip {n}] ERRO: sem URL no resultado: {json.dumps(res)[:400]}", flush=True)
            continue

        mp4 = os.path.join(out_dir, f"clip-{n:02d}.mp4")
        urllib.request.urlretrieve(url, mp4)
        print(f"[clip {n}] SAVED -> {mp4}", flush=True)
        ok += 1

    print(f"\nDONE: {ok}/{len(todo)} clips -> {out_dir}", flush=True)


if __name__ == "__main__":
    main()
