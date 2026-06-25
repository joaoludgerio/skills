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
  "frames_dir":  "<pasta-do-reel>/frames",
  "output_dir":  "<pasta-do-reel>",
  "env_path":    "<skill>/credentials.env",  # optional, this is the default
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

HOSTS = ["https://api.klingai.com", "https://api-singapore.klingai.com"]
DEFAULT_ENV = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "credentials.env")
DEFAULT_NEG = ("text, letters, words, captions, watermark, logo, brand name, "
               "distorted face, deformed hands, extra fingers, low quality, blurry, "
               "jittery motion, flicker, oversaturated, cartoon")


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
    for k in ("KLING_ACCESS_KEY", "KLING_SECRET_KEY"):
        if os.environ.get(k):
            d[k] = os.environ[k]
    return d


def b64url(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=")


def make_token(ak, sk):
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"iss": ak, "exp": int(time.time()) + 1800, "nbf": int(time.time()) - 5}
    seg = b64url(json.dumps(header, separators=(",", ":")).encode()) + b"." + \
          b64url(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(sk.encode(), seg, hashlib.sha256).digest()
    return (seg + b"." + b64url(sig)).decode()


def img_b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


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


def poll(host, ak, sk, task_id, timeout_s=600):
    url = host + "/v1/videos/image2video/" + task_id
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        r = requests.get(url, headers={"Authorization": "Bearer " + make_token(ak, sk)}, timeout=30)
        data = r.json().get("data", {})
        st = data.get("task_status")
        print(f"   ...status={st} ({int(time.time()-t0)}s)", flush=True)
        if st == "succeed":
            return data["task_result"]["videos"][0]["url"]
        if st == "failed":
            raise RuntimeError("task failed: " + json.dumps(data.get("task_status_msg", data)))
        time.sleep(10)
    raise TimeoutError("polling timed out")


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


def run_clip(clip, ak, sk, cfg, host_cache):
    n = clip["n"]
    fpath = os.path.join(cfg["frames_dir"], clip["frame"])
    if not os.path.exists(fpath):
        print(f"[clip {n}] SKIP - frame not found: {fpath}", flush=True); return None
    print(f"\n=== CLIP {n}  ({clip['frame']}) ===", flush=True)
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
    url = poll(host, ak, sk, task_id)
    out = os.path.join(cfg["output_dir"], f"clip-{n:02d}.mp4")
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(out, "wb") as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
    print(f"[clip {n}] SAVED -> {out}", flush=True)
    return out


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
    }
    env = load_env(manifest.get("env_path", DEFAULT_ENV))
    if "KLING_ACCESS_KEY" not in env or "KLING_SECRET_KEY" not in env:
        print("ERROR: KLING_ACCESS_KEY / KLING_SECRET_KEY not found (env file or environment)."); sys.exit(1)
    ak, sk = env["KLING_ACCESS_KEY"], env["KLING_SECRET_KEY"]
    os.makedirs(cfg["output_dir"], exist_ok=True)

    clips = manifest["clips"]
    if sel and sel != ["all"]:
        want = {int(x) for x in sel}
        clips = [c for c in clips if c["n"] in want]

    host_cache, done = {"host": None}, []
    for c in clips:
        try:
            r = run_clip(c, ak, sk, cfg, host_cache)
            if r:
                done.append(r)
        except Exception as e:
            print(f"[clip {c.get('n')}] ERROR: {e}", flush=True)
    print(f"\nDONE: {len(done)}/{len(clips)} clips -> {cfg['output_dir']}", flush=True)


if __name__ == "__main__":
    main()
