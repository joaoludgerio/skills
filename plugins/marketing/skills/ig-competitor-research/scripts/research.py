#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
research.py — motor da skill ig-competitor-research.

Pipeline (parte deterministica, sem LLM):
  1. Le handles de concorrentes (arg, --file ou competitors.txt).
  2. Scrape via Apify (apify~instagram-profile-scraper) numa unica chamada batch.
  3. Filtra posts da janela (--dias, default 7), descarta pinned.
  4. Calcula engajamento + outlier score (vs mediana do proprio perfil).
  5. Pega top N por handle, reordena global por outlier score -> top picks.
  6. Baixa a capa (displayUrl) de cada pick. Pra Video, baixa o mp4,
     extrai audio com ffmpeg e transcreve com Whisper local (gratis).
  7. Grava output/<run>/research_data.json + frames/ + (campos qualitativos vazios
     pro Claude preencher: format, hook, why_it_worked, visual_notes).

A analise visual e o "por que viralizou" NAO sao feitos aqui — sao do Claude
(ver SKILL.md). Este script entrega os dados objetivos + a midia.

Requisitos (ja presentes no PC do Eric): APIFY_TOKEN, ffmpeg no PATH,
openai-whisper (import whisper).
"""
import argparse
import json
import os
import re
import socket
import statistics
import subprocess
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path

ACTOR_ID = "apify~instagram-profile-scraper"
APIFY_BASE = "https://api.apify.com/v2"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def log(msg):
    print(msg, flush=True)


def normalize_handle(raw):
    s = str(raw).strip()
    m = re.search(r"instagram\.com/([^/?#]+)", s, re.I)
    if m:
        s = m.group(1)
    return s.lstrip("@").rstrip("/").lower()


def read_handles(args):
    if args.handles:
        raw = []
        for chunk in args.handles:
            raw.extend(re.split(r"[\s,]+", chunk))
    else:
        path = Path(args.file) if args.file else Path(__file__).resolve().parent.parent / "competitors.txt"
        if not path.exists():
            log(f"ERRO: sem handles. Passe-os como argumento ou crie {path}")
            sys.exit(2)
        raw = []
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.split("#", 1)[0].strip()
            if line:
                raw.append(line)
    handles, seen = [], set()
    for r in raw:
        h = normalize_handle(r)
        if h and h not in seen:
            seen.add(h)
            handles.append(h)
    return handles


def apify_scrape(handles, posts_per_profile, token):
    url = f"{APIFY_BASE}/acts/{ACTOR_ID}/run-sync-get-dataset-items"
    body = json.dumps({
        "usernames": handles,
        "resultsType": "details",
        "resultsLimit": posts_per_profile,
        "addParentData": False,
    }).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",  # token no header, nao na query string
        },
        method="POST",
    )
    log(f"[apify] scraping {len(handles)} handles via {ACTOR_ID} ...")
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            items = json.loads(r.read())
    except urllib.error.HTTPError as e:
        log(f"ERRO: o Apify respondeu HTTP {e.code} ({e.reason}).")
        log("Cheque se o APIFY_TOKEN esta valido e se os handles existem/estao publicos.")
        sys.exit(1)
    except (urllib.error.URLError, socket.timeout, TimeoutError) as e:
        log(f"ERRO: falha de rede/timeout ao chamar o Apify: {e}")
        log("Cheque sua conexao e o APIFY_TOKEN. Se foi timeout, tente com menos handles por vez.")
        sys.exit(1)
    log(f"[apify] {len(items)} perfis retornados")
    return items


def parse_ts(ts):
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return None


def engagement(post):
    likes = post.get("likesCount") or 0
    comments = post.get("commentsCount") or 0
    if likes < 0:
        likes = 0
    # comentario pesa mais que like (maior sinal de intencao)
    return likes + comments * 3


def collect_posts(profiles, days):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    picks = []
    for prof in profiles:
        if not isinstance(prof, dict):
            continue
        handle = (prof.get("username") or "").lower()
        followers = prof.get("followersCount")
        posts = prof.get("latestPosts") or []
        # mediana de engajamento do perfil (base do outlier) — usa todos os posts retornados
        eng_all = [engagement(p) for p in posts if not p.get("isPinned")]
        median_eng = statistics.median(eng_all) if eng_all else 0
        recent = []
        for p in posts:
            if p.get("isPinned"):
                continue
            ts = parse_ts(p.get("timestamp"))
            if ts and ts >= cutoff:
                recent.append((p, ts))
        for p, ts in recent:
            eng = engagement(p)
            outlier = round(eng / median_eng, 2) if median_eng else 0.0
            picks.append({
                "handle": handle,
                "followers": followers,
                "url": p.get("url"),
                "shortcode": p.get("shortCode"),
                "type": p.get("type"),
                "caption": (p.get("caption") or "").strip(),
                "hashtags": p.get("hashtags") or [],
                "likes": p.get("likesCount") or 0,
                "comments": p.get("commentsCount") or 0,
                "views": p.get("videoViewCount") or p.get("videoPlayCount"),
                "engagement": eng,
                "outlier_score": outlier,
                "posted_at": ts.date().isoformat(),
                "display_url": p.get("displayUrl"),
                "video_url": p.get("videoUrl"),
                # campos qualitativos — preenchidos pelo Claude depois:
                "hook": None,
                "format": None,
                "transcript": None,
                "why_it_worked": None,
                "visual_notes": None,
            })
    return picks


def rank(picks, top_per_handle, top_total):
    by_handle = {}
    for p in picks:
        by_handle.setdefault(p["handle"], []).append(p)
    kept = []
    for handle, ps in by_handle.items():
        ps.sort(key=lambda x: (x["outlier_score"], x["engagement"]), reverse=True)
        kept.extend(ps[:top_per_handle])
    kept.sort(key=lambda x: (x["outlier_score"], x["engagement"]), reverse=True)
    return kept[:top_total]


def http_download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        while True:
            chunk = r.read(65536)
            if not chunk:
                break
            f.write(chunk)
    return dest


def extract_audio(video_path, audio_path, max_seconds):
    cmd = ["ffmpeg", "-y", "-i", str(video_path)]
    if max_seconds:
        cmd += ["-t", str(max_seconds)]
    cmd += ["-vn", "-ac", "1", "-ar", "16000", "-f", "wav", str(audio_path)]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def download_media(picks, run_dir, max_seconds):
    """Baixa capa (sempre) e, pra videos, o mp4 -> audio wav. Em paralelo (I/O)."""
    frames = run_dir / "frames"
    audio = run_dir / "audio"
    frames.mkdir(exist_ok=True)
    audio.mkdir(exist_ok=True)

    def grab(i, p):
        slug = f"{i:02d}_{p['handle']}_{p.get('shortcode') or 'x'}"
        try:
            if p.get("display_url"):
                jpg = frames / f"{slug}.jpg"
                http_download(p["display_url"], jpg)
                p["frame_path"] = str(jpg)
        except Exception as e:
            p["frame_path"] = None
            log(f"  [warn] capa falhou {p['handle']}: {e}")
        if p.get("type") == "Video" and p.get("video_url"):
            try:
                mp4 = audio / f"{slug}.mp4"
                wav = audio / f"{slug}.wav"
                http_download(p["video_url"], mp4)
                extract_audio(mp4, wav, max_seconds)
                p["_audio_path"] = str(wav)
                mp4.unlink(missing_ok=True)  # so precisamos do audio
            except Exception as e:
                p["_audio_path"] = None
                log(f"  [warn] audio falhou {p['handle']}: {e}")
        return p

    log(f"[download] baixando midia de {len(picks)} posts ...")
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(grab, i, p): p for i, p in enumerate(picks, 1)}
        for fut in as_completed(futs):
            p = futs[fut]
            try:
                fut.result()
            except Exception as e:
                log(f"  [warn] download falhou @{p.get('handle')} ({p.get('shortcode') or 'sem shortcode'}): {e}")


def transcribe_all(picks, model_name):
    to_do = [p for p in picks if p.get("_audio_path")]
    if not to_do:
        return
    try:
        import whisper
    except ImportError:
        log("[whisper] openai-whisper nao instalado — pulando transcricao. (pip install -U openai-whisper)")
        return
    log(f"[whisper] carregando modelo '{model_name}' e transcrevendo {len(to_do)} videos ...")
    model = whisper.load_model(model_name)
    for p in to_do:
        try:
            res = model.transcribe(p["_audio_path"], fp16=False)
            p["transcript"] = (res.get("text") or "").strip()
            p["lang"] = res.get("language")
            log(f"  [ok] {p['handle']} ({p.get('lang')}) {len(p['transcript'])} chars")
        except Exception as e:
            log(f"  [warn] transcricao falhou {p['handle']}: {e}")


def main():
    ap = argparse.ArgumentParser(description="IG competitor research — coleta + ranking + transcricao")
    ap.add_argument("handles", nargs="*", help="@handles ou URLs (separados por espaco/virgula)")
    ap.add_argument("--file", help="arquivo com 1 handle por linha (default: competitors.txt)")
    ap.add_argument("--dias", type=int, default=7, help="janela em dias (default 7)")
    ap.add_argument("--top-per-handle", type=int, default=3, help="top posts por perfil (default 3)")
    ap.add_argument("--top-total", type=int, default=15, help="total de picks no relatorio (default 15)")
    ap.add_argument("--posts-per-profile", type=int, default=24, help="quantos posts puxar por perfil no scrape (default 24)")
    ap.add_argument("--whisper-model", default=os.environ.get("WHISPER_MODEL", "small"), help="modelo Whisper: tiny|base|small|medium (default small)")
    ap.add_argument("--max-audio-seconds", type=int, default=120, help="segundos de audio a transcrever por video (default 120)")
    ap.add_argument("--no-transcribe", action="store_true", help="pula download de video + Whisper (so metadados+capa)")
    ap.add_argument("--outdir", default=str(Path(__file__).resolve().parent.parent / "output"), help="pasta base de saida")
    args = ap.parse_args()

    token = os.environ.get("APIFY_TOKEN") or os.environ.get("APIFY_API_TOKEN")
    if not token:
        log("ERRO: APIFY_TOKEN nao encontrado no ambiente.")
        sys.exit(2)

    handles = read_handles(args)
    if not handles:
        log("ERRO: nenhum handle valido.")
        sys.exit(2)
    log(f"[handles] {', '.join('@'+h for h in handles)}")

    profiles = apify_scrape(handles, args.posts_per_profile, token)
    picks_all = collect_posts(profiles, args.dias)
    log(f"[filter] {len(picks_all)} posts nos ultimos {args.dias} dias")
    if not picks_all:
        log("Nenhum post recente na janela. Aumente --dias ou cheque os handles.")
        sys.exit(1)
    picks = rank(picks_all, args.top_per_handle, args.top_total)
    log(f"[rank] {len(picks)} picks selecionados")

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = Path(args.outdir) / stamp
    run_dir.mkdir(parents=True, exist_ok=True)

    if not args.no_transcribe:
        download_media(picks, run_dir, args.max_audio_seconds)
        transcribe_all(picks, args.whisper_model)
    else:
        # ainda baixa capas pra analise visual
        frames = run_dir / "frames"
        frames.mkdir(exist_ok=True)
        for i, p in enumerate(picks, 1):
            if p.get("display_url"):
                try:
                    jpg = frames / f"{i:02d}_{p['handle']}.jpg"
                    http_download(p["display_url"], jpg)
                    p["frame_path"] = str(jpg)
                except Exception:
                    p["frame_path"] = None

    # limpa campos internos
    for p in picks:
        p.pop("_audio_path", None)

    meta = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "window_days": args.dias,
        "handles": handles,
        "total_recent_posts": len(picks_all),
        "picks": len(picks),
        "whisper_model": None if args.no_transcribe else args.whisper_model,
    }
    out = {"meta": meta, "posts": picks}
    data_path = run_dir / "research_data.json"
    data_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    log("")
    log(f"OK -> {data_path}")
    log(f"Frames -> {run_dir / 'frames'}")
    log("Proximo passo (Claude): ler cada frame + transcript, preencher hook/format/why_it_worked/visual_notes, depois rodar build_report.py")
    print(f"RUN_DIR={run_dir}")


if __name__ == "__main__":
    main()
