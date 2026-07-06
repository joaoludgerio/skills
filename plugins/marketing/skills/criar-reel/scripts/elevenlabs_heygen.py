#!/usr/bin/env python3
"""ElevenLabs TTS -> HeyGen lip-sync runner (Expert Integrado / criar-reel).

POR QUE EXISTE: gerar a fala cena-a-cena no HeyGen (TTS interno) custa ~US$10-11
por video de 1 min. Aqui o audio inteiro sai do ElevenLabs em BLOCOS grandes
(default ~20s — decisao do Eric/Joao em 11/06/2026) e o HeyGen so faz o lip-sync
do avatar sobre o audio pronto — poucas requisicoes grandes em vez de muitas pequenas.

FLUXO por bloco:
  1. agrupa as cenas do cenas.txt em blocos de ~N segundos (estimativa por chars)
  2. gera o audio do bloco no ElevenLabs (voz Eric Profissional - Abril-25)
  3. CHECKPOINT DE VOZ no audio (janelas deslizantes — pega troca de voz no MEIO
     do audio, o defeito conhecido do ElevenLabs) ANTES de gastar credito HeyGen.
     Falhou -> regenera o audio (max 3x). So audio aprovado segue.
  4. sobe o .mp3 como asset no HeyGen (upload.heygen.com/v1/asset)
  5. POST /v3/videos com audio_asset_id (Avatar V, fundo verde, 9:16)
  6. baixa, re-verifica a voz no video, concatena tudo no final

Uso:
  python elevenlabs_heygen.py --scenes-file cenas.txt --out-dir C:/path/heygen
      [--block-seconds 20] [--final eric-green.mp4] [--so-audio] [--blocks 1 2]
  --so-audio: para depois do checkpoint de voz (nao gasta HeyGen) — bom pra testar
  --blocks: (re)processa so os blocos listados (1-based)

Credenciais: C:\\MCPs\\heygen.env e C:\\MCPs\\elevenlabs.env.
Saida: <out-dir>/audio-NN.mp3, <out-dir>/block-NN.mp4 e o concat final.
"""
import argparse
import hashlib
import json
import math
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HEYGEN_ENV = r"C:\MCPs\heygen.env"
ELEVEN_ENV = r"C:\MCPs\elevenlabs.env"
HEYGEN_API = "https://api.heygen.com"
HEYGEN_UPLOAD = "https://upload.heygen.com/v1/asset"
ELEVEN_API = "https://api.elevenlabs.io"

AVATAR_ERIC_2026 = "bd4f2d9e3ed342a2999b2f585dacc567"
VOICE_ELEVEN_ERIC = "ASKPogZ3ZKeHiPbzqJws"  # Eric Profissional - Abril-25 (PVC professional)
# Escolha do João em 25/06/2026. Anterior: "pvrRNrLjbQYSX1OUhj24" (Eric - Maio/2026, clone).
ELEVEN_MODEL = "eleven_multilingual_v2"     # mais estavel que o v3 pra PVC
GREEN = "#00FF00"

# Voz Eric Profissional no eleven_multilingual_v2: ~17.5 chars/segundo (calibrado em
# 11/06/2026: 707 chars -> 36.5s). Usado so pra AGRUPAR cenas em blocos — nao precisa ser exato.
CHARS_PER_SECOND = 17.5


def load_env(path, var):
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.startswith(var + "="):
                return line.split("=", 1)[1].strip()
    sys.exit(f"{var} nao encontrada em {path}")


def http_retry(fn, what, retries=3):
    """Retry com backoff em erro transitorio (429/5xx/rede): um soluco de rede no meio
    do run (TTS, upload, polling) nao pode derrubar tudo depois de credito ja gasto."""
    for attempt in range(1, retries + 1):
        try:
            return fn()
        except urllib.error.HTTPError as e:
            print(f"{what}: HTTP {e.code}: {e.read().decode(errors='replace')}", flush=True)
            if not ((e.code == 429 or e.code >= 500) and attempt < retries):
                raise
        except (urllib.error.URLError, TimeoutError) as e:
            print(f"{what}: erro de rede: {e}", flush=True)
            if attempt >= retries:
                raise
        time.sleep(10 * attempt)


def heygen_call(method, path, key, body=None):
    def _call():
        req = urllib.request.Request(
            HEYGEN_API + path,
            data=json.dumps(body).encode() if body else None,
            method=method,
            headers={"x-api-key": key, "Content-Type": "application/json", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    return http_retry(_call, f"HeyGen {method} {path}")


def download(url, dest, timeout=300):
    """Download com timeout e escrita em chunks (urlretrieve nao tem timeout)."""
    def _dl():
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout) as r, open(dest, "wb") as f:
            while True:
                chunk = r.read(256 * 1024)
                if not chunk:
                    break
                f.write(chunk)
        return dest
    return http_retry(_dl, f"download {os.path.basename(dest)}")


def group_scenes(scenes, block_seconds):
    """Agrupa cenas consecutivas em blocos de ~block_seconds (corte só em fim de cena)."""
    max_chars = block_seconds * CHARS_PER_SECOND
    blocks, cur = [], []
    for s in scenes:
        cand = " ".join(cur + [s])
        if cur and len(cand) > max_chars:
            blocks.append(" ".join(cur))
            cur = [s]
        else:
            cur.append(s)
    if cur:
        blocks.append(" ".join(cur))
    return blocks


def eleven_tts(text, out_mp3, el_key, voice, seed=None):
    body = {"text": text, "model_id": ELEVEN_MODEL}
    if seed is not None:
        body["seed"] = seed

    def _tts():
        req = urllib.request.Request(
            f"{ELEVEN_API}/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
            data=json.dumps(body).encode("utf-8"), method="POST",
            headers={"xi-api-key": el_key, "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.read()

    audio = http_retry(_tts, "ElevenLabs TTS")
    with open(out_mp3, "wb") as f:
        f.write(audio)
    return out_mp3


def audio_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return float(out)


def check_voice_windows(checker, mp3, win=10, threshold=0.5):
    """Verifica a voz em janelas de `win`s ao longo do audio INTEIRO (o defeito do
    ElevenLabs e trocar a voz no meio — checar so o comeco nao pega). Retorna
    (ok, lista de (inicio, sim))."""
    if checker is None:          # checkpoint desativado / sem modelo+ref nesta maquina
        return True, []
    import numpy as np
    dur = audio_duration(mp3)
    results = []
    t = 0.0
    while t < dur - 1.0:
        seg = min(win, dur - t)
        raw = subprocess.run(
            ["ffmpeg", "-v", "error", "-ss", str(t), "-t", str(seg), "-i", mp3,
             "-ar", "16000", "-ac", "1", "-f", "s16le", "-vn", "-"],
            capture_output=True, check=True,
        ).stdout
        x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        s = checker._ext.create_stream()
        s.accept_waveform(16000, x)
        s.input_finished()
        e = np.array(checker._ext.compute(s))
        sim = float(np.dot(checker._ref, e / np.linalg.norm(e)))
        results.append((t, sim))
        t += win
    ok = all(sim >= threshold for _, sim in results)
    return ok, results


def heygen_upload_audio(mp3, key):
    with open(mp3, "rb") as f:
        data = f.read()

    def _up():
        req = urllib.request.Request(HEYGEN_UPLOAD, data=data, method="POST",
                                     headers={"x-api-key": key, "Content-Type": "audio/mpeg"})
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.load(r)

    resp = http_retry(_up, f"HeyGen upload {os.path.basename(mp3)}")
    return resp["data"]["id"]


def md5_arquivo(path):
    """MD5 do conteudo do arquivo (usado pra saber se o audio-NN.mp3 mudou entre runs:
    job antigo de OUTRO audio nao pode ser reaproveitado)."""
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def carregar_jobs(path):
    """Le jobs.json (se existir) e devolve dict {n: job} pra retomada apos crash/queda
    no meio da FASE 2/3 (job no HeyGen ja foi pago, nao pode se perder)."""
    if not os.path.exists(path):
        return {}
    try:
        with open(path, encoding="utf-8") as f:
            lista = json.load(f)
        return {j["n"]: j for j in lista}
    except (json.JSONDecodeError, KeyError, OSError) as e:
        print(f"[jobs] jobs.json ilegivel ({e}), ignorando e comecando do zero", flush=True)
        return {}


def salvar_jobs(path, jobs_all):
    """Persiste o estado dos jobs pagos do HeyGen em disco (escrita atomica via arquivo
    temporario + replace, pra nao corromper o jobs.json se o processo cair no meio)."""
    lista = sorted(jobs_all.values(), key=lambda j: j["n"])
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(lista, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def heygen_submeter_bloco(n, mp3, hg_key, avatar, bg, title):
    """Sobe o audio do bloco e cria o job de lip-sync no HeyGen. Retorna o registro do
    job (mesmo formato salvo em jobs.json)."""
    asset = heygen_upload_audio(mp3, hg_key)
    body = {
        "type": "avatar",
        "avatar_id": avatar,
        "audio_asset_id": asset,
        "resolution": "1080p",
        "aspect_ratio": "9:16",
        "engine": {"type": "avatar_v"},
        "title": f"{title} - bloco {n:02d}",
        "remove_background": True,
        "background": {"type": "color", "value": bg},
        "output_format": "mp4",
    }
    resp = heygen_call("POST", "/v3/videos", hg_key, body)
    vid = resp["data"]["video_id"]
    print(f"[bloco {n}] asset={asset} video_id={vid}", flush=True)
    return {"n": n, "video_id": vid, "asset_id": asset, "done": False, "url": None,
            "audio_md5": md5_arquivo(mp3)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenes-file")
    ap.add_argument("--text")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--final", default="eric-green.mp4")
    ap.add_argument("--block-seconds", type=int, default=20)
    ap.add_argument("--avatar", default=AVATAR_ERIC_2026)
    ap.add_argument("--eleven-voice", default=VOICE_ELEVEN_ERIC)
    ap.add_argument("--bg", default=GREEN)
    ap.add_argument("--title", default="criar-reel")
    ap.add_argument("--threshold", type=float, default=0.5)
    ap.add_argument("--no-voice-check", action="store_true",
                    help="pula o checkpoint de voz (util em outra maquina / outra voz)")
    ap.add_argument("--voice-model", default=os.environ.get("VOICE_MODEL", "C:/MCPs/speaker-embed.onnx"),
                    help="modelo sherpa speaker-embed.onnx (env VOICE_MODEL)")
    ap.add_argument("--voice-ref", default=os.environ.get("VOICE_REF", "C:/MCPs/eric-voice-ref.wav"),
                    help="~20s da SUA voz, 16k mono (env VOICE_REF)")
    ap.add_argument("--regen-audio", action="store_true",
                    help="forca regerar o TTS mesmo se o audio-NN.mp3 ja existir (default: reaproveita)")
    ap.add_argument("--so-audio", action="store_true",
                    help="gera e valida so os audios (nao gasta credito HeyGen)")
    ap.add_argument("--blocks", type=int, nargs="*", default=None,
                    help="processa so estes blocos (1-based); util pra re-rodar falha")
    args = ap.parse_args()

    if args.scenes_file:
        with open(args.scenes_file, encoding="utf-8") as f:
            scenes = [ln.strip() for ln in f if ln.strip()]
    elif args.text:
        scenes = [args.text]
    else:
        sys.exit("passe --scenes-file ou --text")

    os.makedirs(args.out_dir, exist_ok=True)
    hg_key = load_env(HEYGEN_ENV, "HEYGEN_API_KEY")
    el_key = load_env(ELEVEN_ENV, "ELEVENLABS_API_KEY")

    blocks = group_scenes(scenes, args.block_seconds)
    est = [len(b) / CHARS_PER_SECOND for b in blocks]
    print(f"=== {len(scenes)} cenas -> {len(blocks)} blocos de ~{args.block_seconds}s "
          f"(estimativas: {', '.join(f'{e:.0f}s' for e in est)}) ===", flush=True)

    sel = args.blocks or list(range(1, len(blocks) + 1))

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from verificar_voz import VoiceChecker
    # Checkpoint de voz e OPCIONAL — pega o bug do ElevenLabs trocar a voz no meio.
    # Precisa do modelo sherpa (speaker-embed.onnx) + ~20s de referencia da SUA voz.
    # Se faltar qualquer um (ou --no-voice-check), segue sem o check em vez de quebrar.
    checker = None
    if args.no_voice_check:
        print("[voz] checkpoint desativado (--no-voice-check). Seguindo sem ele.", flush=True)
    elif not os.path.exists(args.voice_model) or not os.path.exists(args.voice_ref):
        faltam = [p for p in (args.voice_model, args.voice_ref) if not os.path.exists(p)]
        print("[voz] checkpoint PULADO — nao achei: " + ", ".join(faltam) + ".\n"
              "      E opcional (so detecta o ElevenLabs trocar a voz no meio). Pra ligar: baixe o\n"
              "      modelo sherpa 'speaker-embed.onnx', grave ~20s da SUA voz (16k mono .wav) e aponte\n"
              "      com --voice-model/--voice-ref (ou env VOICE_MODEL/VOICE_REF). Seguindo sem ele.", flush=True)
    else:
        try:
            checker = VoiceChecker(args.voice_model, args.voice_ref)
        except Exception as e:
            print(f"[voz] checkpoint PULADO (erro ao carregar: {e}). Seguindo sem ele.", flush=True)
            checker = None

    # FASE 1 — audios ElevenLabs + checkpoint de voz (barato; nada de HeyGen ainda)
    audios = {}
    for n in sel:
        text = blocks[n - 1]
        mp3 = os.path.join(args.out_dir, f"audio-{n:02d}.mp3")
        # Reaproveita o audio ja gerado+validado (ex: depois de um --so-audio aprovado).
        # Evita re-rolar o TTS e arriscar mudar a pronuncia. --regen-audio forca regenerar.
        # Alem da voz, o TEXTO do bloco tem que bater (sidecar .txt): se o cenas.txt ou o
        # --block-seconds mudarem entre runs, o audio antigo e de OUTRO texto — nao reaproveitar.
        sidecar = mp3 + ".txt"
        if os.path.exists(mp3) and not args.regen_audio:
            texto_igual = os.path.exists(sidecar) and open(sidecar, encoding="utf-8").read() == text
            if not texto_igual:
                print(f"[bloco {n}] audio existente e de outro texto/split — regerando", flush=True)
            else:
                ok, _ = check_voice_windows(checker, mp3, threshold=args.threshold)
                if ok:
                    print(f"[bloco {n}] audio reaproveitado (mesmo texto, voz OK, {audio_duration(mp3):.1f}s)", flush=True)
                    audios[n] = mp3
                    continue
                print(f"[bloco {n}] audio existente reprovou no check — regerando", flush=True)
        for attempt in range(1, 4):
            # seed varia por tentativa — regenerar igual devolveria o mesmo defeito
            eleven_tts(text, mp3, el_key, args.eleven_voice, seed=1000 * n + attempt)
            ok, wins = check_voice_windows(checker, mp3, threshold=args.threshold)
            sims = " ".join(f"{t:.0f}s={s:.2f}" for t, s in wins)
            dur = audio_duration(mp3)
            if ok:
                print(f"[bloco {n}] audio OK ({dur:.1f}s) janelas: {sims}", flush=True)
                with open(sidecar, "w", encoding="utf-8") as f:
                    f.write(text)
                audios[n] = mp3
                break
            print(f"[bloco {n}] VOZ SUSPEITA (tentativa {attempt}/3) janelas: {sims}", flush=True)
        else:
            sys.exit(f"[bloco {n}] voz errada no ElevenLabs apos 3 tentativas — abortando")

    if args.so_audio:
        print("--so-audio: parando antes do HeyGen. Audios validados:", flush=True)
        for n in sorted(audios):
            print(f"  {audios[n]}", flush=True)
        return

    # FASE 2 — upload + lip-sync no HeyGen (todas em paralelo do lado deles)
    # jobs.json guarda o video_id de cada bloco: sao jobs PAGOS (~US$4/min), um
    # crash/queda no meio do polling de ate 45min nao pode fazer um re-run pagar de novo.
    jobs_path = os.path.join(args.out_dir, "jobs.json")
    jobs_all = carregar_jobs(jobs_path)

    jobs = []
    resumidos = set()
    for n in sorted(audios):
        audio_md5 = md5_arquivo(audios[n])
        prev = jobs_all.get(n)
        if prev and prev.get("video_id") and prev.get("audio_md5") == audio_md5:
            print(f"[bloco {n}] retomando job pago de um run anterior (video_id={prev['video_id']})", flush=True)
            job = dict(prev)
            job["done"], job["url"] = False, None
            resumidos.add(n)
        else:
            if prev and prev.get("audio_md5") != audio_md5:
                print(f"[bloco {n}] audio foi regenerado desde o ultimo job, resubmetendo", flush=True)
            job = heygen_submeter_bloco(n, audios[n], hg_key, args.avatar, args.bg, args.title)
        jobs.append(job)
        jobs_all[n] = job
        salvar_jobs(jobs_path, jobs_all)

    t0 = time.time()
    while not all(j["done"] for j in jobs):
        time.sleep(20)
        for i, j in enumerate(jobs):
            if j["done"]:
                continue
            n = j["n"]
            try:
                st = heygen_call("GET", f"/v3/videos/{j['video_id']}", hg_key)
            except (urllib.error.HTTPError, urllib.error.URLError) as e:
                if n not in resumidos:
                    raise
                # job retomado que nao existe mais no HeyGen (expirou/nunca ficou pronto):
                # descarta o registro antigo e resubmete so este bloco.
                print(f"[bloco {n}] job retomado nao respondeu ({e}), descartando e resubmetendo", flush=True)
                job = heygen_submeter_bloco(n, audios[n], hg_key, args.avatar, args.bg, args.title)
                jobs[i] = job
                jobs_all[n] = job
                resumidos.discard(n)
                salvar_jobs(jobs_path, jobs_all)
                continue
            data = st.get("data", st)
            status = data.get("status")
            if status == "completed":
                j["done"], j["url"] = True, data.get("video_url")
                salvar_jobs(jobs_path, jobs_all)
                print(f"[bloco {n}] completed ({int(time.time()-t0)}s)", flush=True)
            elif status == "failed":
                if n in resumidos:
                    print(f"[bloco {n}] job retomado FAILED ({json.dumps(data.get('error'))}), "
                          f"descartando e resubmetendo", flush=True)
                    job = heygen_submeter_bloco(n, audios[n], hg_key, args.avatar, args.bg, args.title)
                    jobs[i] = job
                    jobs_all[n] = job
                    resumidos.discard(n)
                    salvar_jobs(jobs_path, jobs_all)
                else:
                    salvar_jobs(jobs_path, jobs_all)
                    sys.exit(f"[bloco {n}] FAILED: {json.dumps(data.get('error'))}")
        pend = sum(1 for j in jobs if not j["done"])
        if pend:
            print(f"   ...{pend} bloco(s) pendente(s) ({int(time.time()-t0)}s)", flush=True)
        if time.time() - t0 > 2700:
            salvar_jobs(jobs_path, jobs_all)
            sys.exit("timeout de 45 min no polling")

    # FASE 3 — download + re-verificacao + concat
    mp4s = []
    suspeitos = []
    for j in sorted(jobs, key=lambda x: x["n"]):
        mp4 = os.path.join(args.out_dir, f"block-{j['n']:02d}.mp4")
        download(j["url"], mp4)
        ok, wins = check_voice_windows(checker, mp4, threshold=args.threshold)
        sims = " ".join(f"{t:.0f}s={s:.2f}" for t, s in wins)
        print(f"[bloco {j['n']}] video {'OK' if ok else 'VOZ SUSPEITA'} janelas: {sims}", flush=True)
        if not ok:
            suspeitos.append(j["n"])
        mp4s.append(mp4)

    def alerta_suspeitos():
        # exit 3 = codigo distinto: o video final EXISTE, mas precisa de revisao humana
        if suspeitos:
            blocos = " ".join(str(n) for n in suspeitos)
            print(f"ATENCAO: blocos [{blocos}] com VOZ SUSPEITA no video. Ouvir antes de usar; "
                  f"re-rodar com --blocks {blocos} --regen-audio se confirmar.", flush=True)
            sys.exit(3)

    if args.blocks:
        print("(--blocks: pulei o concat — re-rode sem --blocks ou concatene na mao)", flush=True)
        alerta_suspeitos()
        return

    listfile = os.path.join(args.out_dir, "concat.txt")
    with open(listfile, "w", encoding="utf-8") as f:
        for m in mp4s:
            # SEMPRE absoluto: o concat demuxer resolve path relativo em relacao ao
            # DIRETORIO DA LISTA, entao "heygen/block-01.mp4" virava heygen/heygen/...
            f.write(f"file '{os.path.abspath(m).replace(os.sep, '/')}'\n")
    final = os.path.join(args.out_dir, args.final)
    subprocess.check_call([
        "ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listfile,
        "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p", final,
    ])
    print(f"FINAL -> {final}", flush=True)
    alerta_suspeitos()


if __name__ == "__main__":
    main()
