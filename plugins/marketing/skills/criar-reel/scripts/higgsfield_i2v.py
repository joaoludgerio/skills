#!/usr/bin/env python3
"""Runner de B-roll via Higgsfield CLI (criar-reel-v2) — image-to-video.

Substitui o kling_i2v.py da v1. Le o MESMO formato de manifesto (frames_dir,
output_dir, clips[{n, frame, prompt}]), mas gera no Higgsfield:
  upload do frame -> generate create <model> -> wait -> download mp4.

Uso:
  python higgsfield_i2v.py <manifest.json>           # todos os clipes
  python higgsfield_i2v.py <manifest.json> 1         # so o clipe 1 (validacao)
  python higgsfield_i2v.py <manifest.json> 3 5 7     # re-disparo seletivo

Requisitos: C:/MCPs/hf.exe autenticado (`hf.exe auth login`, uma vez, no navegador).
No manifesto, "model" = modelo de video do Higgsfield (ver `hf.exe model list --video`).
"""
import json
import os
import re
import subprocess
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HF = r"C:\MCPs\hf.exe"


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


def _collect_http_urls(obj, out):
    """Coleta (chave, valor) de toda string http(s) no JSON, recursivamente."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and v.startswith("http"):
                out.append((k, v))
            else:
                _collect_http_urls(v, out)
    elif isinstance(obj, list):
        for it in obj:
            _collect_http_urls(it, out)


def find_url(obj):
    """Acha a URL do VIDEO pronto no JSON de resultado.

    A resposta pode trazer varias URLs (ex: thumbnail_url alem da do video).
    Prioridade: 1) valor que termina em .mp4  2) chave contendo "video"
    3) so por ultimo, qualquer chave contendo "url" (match generico)."""
    candidates = []
    _collect_http_urls(obj, candidates)
    if not candidates:
        return None
    for k, v in candidates:
        if v.lower().split("?")[0].endswith(".mp4"):
            return v
    for k, v in candidates:
        if "video" in k.lower():
            return v
    for k, v in candidates:
        if "url" in k.lower():
            return v
    return None


UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def find_id(obj, keys=("id", "job_id", "upload_id", "generation_id")):
    # o `generate create --json` devolve um array de strings: ["<job_id>"]
    if isinstance(obj, str) and UUID_RE.match(obj.strip()):
        return obj.strip()
    if isinstance(obj, dict):
        for k in keys:
            if k in obj and isinstance(obj[k], str):
                return obj[k]
        for v in obj.values():
            r = find_id(v, keys)
            if r:
                return r
    elif isinstance(obj, list):
        for it in obj:
            r = find_id(it, keys)
            if r:
                return r
    return None


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    manifest = json.load(open(sys.argv[1], encoding="utf-8"))
    sel = sys.argv[2:]
    if not sel or sel == ["all"]:
        only = None
    else:
        only = [int(a) for a in sel]

    frames_dir = manifest["frames_dir"]
    out_dir = manifest["output_dir"]
    model = manifest.get("model", "")
    if not model:
        sys.exit("manifesto sem 'model' — rode `hf.exe model list --video` e escolha um")
    extra = manifest.get("hf_flags", [])  # ex: ["--aspect_ratio","9:16","--duration","5","--sound","off"]

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
