#!/usr/bin/env python3
"""
Kling official API - image-to-video batch runner (manifest-driven).

Reads a manifest JSON describing the clips, submits each frame as an
image-to-video task to the official Kling API (Kuaishou), polls until done,
and downloads each MP4. No external deps beyond `requests` (JWT signed manually).

Usage:
    python kling_i2v.py <manifest.json>            # run every clip
    python kling_i2v.py <manifest.json> all        # same as above
    python kling_i2v.py <manifest.json> 1 4 7      # run only clips 1,4,7

Manifest schema (all paths absolute, forward slashes on Windows):
{
  "frames_dir":  "C:/Users/Joao/Downloads/<reel>/frames",
  "output_dir":  "C:/Users/Joao/Downloads/<reel>",
  "env_path":    "C:/MCPs/kling.env",        # optional, this is the default
  "model":       "kling-v1-6",               # optional
  "mode":        "std",                       # optional: std | pro
  "duration":    "5",                         # optional: "5" | "10"
  "cfg_scale":   0.5,                          # optional
  "negative_prompt": "text, watermark, ...",  # optional
  "clips": [
    {"n": 1, "frame": "frame-01.png", "prompt": "motion description ..."},
    ...
  ]
}

The env file must contain:
    KLING_ACCESS_KEY=...
    KLING_SECRET_KEY=...
(Keys can also come from environment variables of the same name.)
"""
import sys, os, time, json, base64, hmac, hashlib, requests

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HOSTS = ["https://api.klingai.com", "https://api-singapore.klingai.com"]
DEFAULT_ENV = r"C:\MCPs\kling.env"
DEFAULT_NEG = ("text, letters, words, captions, watermark, logo, brand name, "
               "distorted face, deformed hands, extra fingers, low quality, blurry, "
               "jittery motion, flicker, oversaturated, cartoon")
STATE_FILENAME = "kling-state.json"


class KlingTaskFailed(RuntimeError):
    """Task chegou em task_status=failed (nao e erro de rede nem de auth): pode resubmeter."""
    pass


def load_env(path):
    d = {}
    if path and os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                d[k.strip()] = v.strip()
    # environment variables win if present
    for k in ("KLING_API_KEY", "KLING_ACCESS_KEY", "KLING_SECRET_KEY"):
        if os.environ.get(k):
            d[k] = os.environ[k]
    return d


def b64url(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=")


def make_token(ak, sk):
    # Sem secret = chave única (bearer) do novo modelo Kling: usa direto, sem JWT.
    if not sk:
        return ak
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"iss": ak, "exp": int(time.time()) + 1800, "nbf": int(time.time()) - 5}
    seg = b64url(json.dumps(header, separators=(",", ":")).encode()) + b"." + \
          b64url(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(sk.encode(), seg, hashlib.sha256).digest()
    return (seg + b"." + b64url(sig)).decode()


def img_b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def carregar_state(path):
    """Le o kling-state.json (se existir e for JSON valido); senao devolve dict vazio."""
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def salvar_state(path, state):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def prompt_md5(prompt):
    return hashlib.md5(prompt.encode("utf-8")).hexdigest()


def clip_state_valido(entry, clip):
    """Confere se a entrada salva no state ainda corresponde a este clipe (mesmo frame e prompt)."""
    if not entry:
        return False
    return entry.get("frame") == clip["frame"] and entry.get("prompt_md5") == prompt_md5(clip["prompt"])


def calc_timeout_s(cfg):
    """Timeout do poll: maior pra mode=pro ou duration=10; manifest pode forcar via poll_timeout."""
    if cfg.get("poll_timeout"):
        return int(cfg["poll_timeout"])
    if cfg.get("mode") == "pro" or cfg.get("duration") == "10":
        return 1200
    return 600


def submit(host, ak, sk, cfg, image_b64, prompt):
    url = host + "/v1/videos/image2video"
    headers = {"Authorization": "Bearer " + make_token(ak, sk),
               "Content-Type": "application/json"}
    body = {"model_name": cfg["model"], "image": image_b64, "prompt": prompt,
            "negative_prompt": cfg["negative_prompt"], "cfg_scale": cfg["cfg_scale"],
            "mode": cfg["mode"], "duration": cfg["duration"]}
    r = requests.post(url, headers=headers, json=body, timeout=60)
    try:
        return r.json(), None
    except Exception:
        return None, f"HTTP {r.status_code}: {r.text[:300]}"


def fetch_poll_json(host, ak, sk, task_id):
    """GET do status com retry (3x, sleep 10*attempt) pra falha de rede ou JSON invalido.
    Erros de negocio (code!=0, failed, risk control) nao passam por aqui: sao tratados no poll()."""
    url = host + "/v1/videos/image2video/" + task_id
    last_err = None
    for attempt in range(1, 4):
        try:
            r = requests.get(url, headers={"Authorization": "Bearer " + make_token(ak, sk)}, timeout=30)
            return r.json()
        except (requests.exceptions.RequestException, ValueError) as e:
            last_err = e
            print(f"   ...falha de rede no poll (tentativa {attempt}/3): {e}", flush=True)
            if attempt < 3:
                time.sleep(10 * attempt)
    raise last_err


def poll(host, ak, sk, task_id, timeout_s=600):
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        j = fetch_poll_json(host, ak, sk, task_id)
        code = j.get("code")
        if code is not None and code != 0:
            # token expirou / erro de auth no meio do poll -- abortar cedo com a mensagem
            # real em vez de ficar imprimindo status vazio ate o timeout de 10 min.
            msg = j.get("message", "")
            if code == 1102:
                raise RuntimeError(f"Kling code=1102: sem saldo na conta. Compre um resource pack "
                                    f"no painel Kling antes de tentar de novo. ({msg})")
            if "risk control" in msg.lower() or "risk" in msg.lower() and "control" in msg.lower():
                raise RuntimeError(f"Kling risk control (moderacao): imagem barrada. Ajuste a imagem "
                                    f"(ex: vestir figuras nuas) e tente de novo. ({msg})")
            raise RuntimeError(f"Kling code={code}: {msg or j}")
        data = j.get("data", {})
        st = data.get("task_status")
        msg = data.get("task_status_msg", "")
        if msg and ("risk control" in msg.lower() or ("risk" in msg.lower() and "control" in msg.lower())):
            raise RuntimeError(f"Kling risk control (moderacao): imagem barrada. Ajuste a imagem "
                                f"(ex: vestir figuras nuas) e tente de novo. ({msg})")
        print(f"   ...status={st} ({int(time.time()-t0)}s)", flush=True)
        if st == "succeed":
            return data["task_result"]["videos"][0]["url"]
        if st == "failed":
            raise KlingTaskFailed("task failed: " + json.dumps(data.get("task_status_msg", data)))
        time.sleep(10)
    raise TimeoutError(f"polling timed out apos {timeout_s}s (task_id={task_id} em {host} ja esta salvo "
                        f"no {STATE_FILENAME}; rode de novo o mesmo clipe pra retomar o poll sem cobrar de novo)")


def pick_host(ak, sk, cfg, image_b64, prompt):
    """Submit on the first host that authenticates (avoids double-charging)."""
    last = None
    for h in HOSTS:
        print(f"-> trying host {h}", flush=True)
        j, err = submit(h, ak, sk, cfg, image_b64, prompt)
        if err:
            print(f"   host error: {err}", flush=True); last = err; continue
        code = j.get("code")
        if code == 0:
            return h, j
        print(f"   api code={code} msg={j.get('message')}", flush=True)
        last = j
        if code not in (1000, 1001, 1002, 1003, 1004):  # 100x = auth family -> try next host
            return h, j
    return None, last


def baixar_video(url, cfg, n, state, state_path, state_key):
    """Baixa o mp4 final e marca o clipe como 'downloaded' no state."""
    out = os.path.join(cfg["output_dir"], f"clip-{n:02d}.mp4")
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(out, "wb") as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
    print(f"[clip {n}] SAVED -> {out}", flush=True)
    state[state_key]["status"] = "downloaded"
    salvar_state(state_path, state)
    return out


def tentar_retomar(clip, ak, sk, cfg, host_cache, state, state_path, state_key):
    """Se ja existe uma entrada valida (mesmo frame e prompt) no state, evita resubmeter.
    Devolve (True, resultado) quando resolveu o clipe (path do mp4), ou (False, None)
    quando deve seguir pro fluxo normal de submissao abaixo."""
    n = clip["n"]
    entry = state.get(state_key)
    if not clip_state_valido(entry, clip):
        return False, None
    status = entry.get("status")
    if status == "downloaded":
        out = os.path.join(cfg["output_dir"], f"clip-{n:02d}.mp4")
        if os.path.exists(out):
            print(f"[clip {n}] JA BAIXADO -> {out} (apague o mp4 ou a entrada '{state_key}' "
                  f"do {STATE_FILENAME} pra regerar)", flush=True)
            return True, out
        return False, None  # mp4 sumiu: cai pra submissao normal abaixo
    if status not in ("submitted", "succeed"):
        return False, None
    host, task_id = entry["host"], entry["task_id"]
    print(f"[clip {n}] RETOMANDO poll de task_id={task_id} em {host} (nao resubmete, nao cobra de novo)",
          flush=True)
    host_cache["host"] = host_cache.get("host") or host
    try:
        url = poll(host, ak, sk, task_id, calc_timeout_s(cfg))
    except KlingTaskFailed as e:
        print(f"[clip {n}] task antiga falhou ({e}); limpando state e resubmetendo", flush=True)
        state.pop(state_key, None)
        salvar_state(state_path, state)
        return False, None
    entry["status"] = "succeed"
    state[state_key] = entry
    salvar_state(state_path, state)
    return True, baixar_video(url, cfg, n, state, state_path, state_key)


def run_clip(clip, ak, sk, cfg, host_cache, state, state_path):
    n = clip["n"]
    state_key = str(n)
    fpath = os.path.join(cfg["frames_dir"], clip["frame"])
    if not os.path.exists(fpath):
        print(f"[clip {n}] SKIP - frame not found: {fpath}", flush=True); return None
    print(f"\n=== CLIP {n}  ({clip['frame']}) ===", flush=True)

    resolvido, resultado = tentar_retomar(clip, ak, sk, cfg, host_cache, state, state_path, state_key)
    if resolvido:
        return resultado

    image_b64 = img_b64(fpath)
    if host_cache.get("host") is None:
        host, j = pick_host(ak, sk, cfg, image_b64, clip["prompt"])
        if host is None or j.get("code") != 0:
            print(f"[clip {n}] SUBMIT FAILED: {j}", flush=True); return None
        host_cache["host"] = host
    else:
        host = host_cache["host"]
        j, err = submit(host, ak, sk, cfg, image_b64, clip["prompt"])
        if err or j.get("code") != 0:
            print(f"[clip {n}] SUBMIT FAILED: {err or j}", flush=True); return None
    task_id = j["data"]["task_id"]
    print(f"[clip {n}] task_id={task_id} on {host}", flush=True)
    state[state_key] = {"task_id": task_id, "host": host, "frame": clip["frame"],
                         "prompt_md5": prompt_md5(clip["prompt"]), "status": "submitted"}
    salvar_state(state_path, state)

    url = poll(host, ak, sk, task_id, calc_timeout_s(cfg))
    state[state_key]["status"] = "succeed"
    salvar_state(state_path, state)
    return baixar_video(url, cfg, n, state, state_path, state_key)


def main():
    if len(sys.argv) < 2:
        print("usage: python kling_i2v.py <manifest.json> [all | n n n]"); sys.exit(2)
    manifest = json.load(open(sys.argv[1], encoding="utf-8"))
    sel = sys.argv[2:]
    cfg = {
        "frames_dir": manifest["frames_dir"],
        "output_dir": manifest["output_dir"],
        "model": manifest.get("model", "kling-v1-6"),
        "mode": manifest.get("mode", "std"),
        "duration": str(manifest.get("duration", "5")),
        "cfg_scale": manifest.get("cfg_scale", 0.5),
        "negative_prompt": manifest.get("negative_prompt", DEFAULT_NEG),
        "poll_timeout": manifest.get("poll_timeout"),
    }
    env = load_env(manifest.get("env_path", DEFAULT_ENV))
    if env.get("KLING_API_KEY"):
        ak, sk = env["KLING_API_KEY"], ""              # chave única (bearer) — novo modelo Kling
    elif env.get("KLING_ACCESS_KEY") and env.get("KLING_SECRET_KEY"):
        ak, sk = env["KLING_ACCESS_KEY"], env["KLING_SECRET_KEY"]  # par AK/SK via JWT (legado)
    else:
        print("ERROR: defina KLING_API_KEY (chave única) OU KLING_ACCESS_KEY + KLING_SECRET_KEY no env."); sys.exit(1)
    os.makedirs(cfg["output_dir"], exist_ok=True)

    clips = manifest["clips"]
    if sel and sel != ["all"]:
        want = {int(x) for x in sel}
        clips = [c for c in clips if c["n"] in want]

    state_path = os.path.join(cfg["output_dir"], STATE_FILENAME)
    state = carregar_state(state_path)

    host_cache, done = {"host": None}, []
    for c in clips:
        try:
            r = run_clip(c, ak, sk, cfg, host_cache, state, state_path)
            if r:
                done.append(r)
        except Exception as e:
            print(f"[clip {c.get('n')}] ERROR: {e}", flush=True)
    print(f"\nDONE: {len(done)}/{len(clips)} clips -> {cfg['output_dir']}", flush=True)


if __name__ == "__main__":
    main()
