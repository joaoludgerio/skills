# -*- coding: utf-8 -*-
"""
Banco de B-rolls remoto (GitHub Release) — a skill consulta e baixa só o que precisa.

Catalogo: bank.json publico (raw GitHub). Cada clip tem id, cat[], desc, res, hd, thumb, url.
Clips ficam num Release do repo expert-broll-bank (URLs publicas, sem login).

Uso (etapa 6 do criar-reel):
  python broll_bank.py --list                      # catalogo inteiro
  python broll_bank.py --list --cat servidor       # so categoria
  python broll_bank.py --list --hd                 # so 1080x1920
  python broll_bank.py --thumb crm-03 tag-08        # baixa thumbs p/ conferir (em ./_bankthumbs)
  python broll_bank.py --get crm-03 tag-08 ai-slop-09 --out C:/Users/Joao/Downloads/reel-novo
        # baixa na ORDEM dada como clip-01.mp4, clip-02.mp4, ... (com cache local)

Env:
  BROLL_BANK_URL  -> sobrescreve a URL do bank.json
"""
import argparse, json, os, sys, urllib.request, hashlib, shutil

DEFAULT_BANK = "https://raw.githubusercontent.com/joaoludgerio/expert-broll-bank/main/bank.json"
CACHE = os.path.join(os.path.expanduser("~"), ".cache", "broll-bank")


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": "broll-bank/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    return data if binary else data.decode("utf-8")


def load_bank():
    url = os.environ.get("BROLL_BANK_URL", DEFAULT_BANK)
    return json.loads(fetch(url))


def cmd_list(bank, cat=None, hd=False):
    clips = bank["clips"]
    if cat:
        clips = [c for c in clips if cat in c["cat"]]
    if hd:
        clips = [c for c in clips if c.get("hd")]
    print(f"# {len(clips)} clips | categorias: {', '.join(bank['categorias'])}")
    for c in clips:
        flag = "HD " if c.get("hd") else "   "
        print(f"{flag}{c['id']:<28} [{','.join(c['cat'])}]  {c['desc']}")


def download_cached(url, dest):
    os.makedirs(CACHE, exist_ok=True)
    key = hashlib.md5(url.encode()).hexdigest() + "_" + os.path.basename(url)
    cpath = os.path.join(CACHE, key)
    if not os.path.exists(cpath) or os.path.getsize(cpath) == 0:
        data = fetch(url, binary=True)
        with open(cpath, "wb") as f:
            f.write(data)
    shutil.copyfile(cpath, dest)
    return os.path.getsize(dest)


def cmd_get(bank, ids, out):
    by = {c["id"]: c for c in bank["clips"]}
    os.makedirs(out, exist_ok=True)
    missing = [i for i in ids if i not in by]
    if missing:
        print("IDs nao encontrados no banco:", ", ".join(missing), file=sys.stderr)
    n = 0
    for i, cid in enumerate([x for x in ids if x in by], 1):
        dest = os.path.join(out, f"clip-{i:02d}.mp4")
        sz = download_cached(by[cid]["url"], dest)
        print(f"clip-{i:02d}.mp4 <- {cid} ({sz//1024} KB)")
        n += 1
    print(f"OK: {n} clips -> {out}")


def cmd_thumb(bank, ids):
    by = {c["id"]: c for c in bank["clips"]}
    os.makedirs("_bankthumbs", exist_ok=True)
    for cid in ids:
        if cid in by:
            dest = os.path.join("_bankthumbs", cid + ".jpg")
            with open(dest, "wb") as f:
                f.write(fetch(by[cid]["thumb"], binary=True))
            print("thumb:", dest)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--cat")
    ap.add_argument("--hd", action="store_true")
    ap.add_argument("--get", nargs="+")
    ap.add_argument("--thumb", nargs="+")
    ap.add_argument("--out")
    a = ap.parse_args()
    bank = load_bank()
    if a.list:
        cmd_list(bank, a.cat, a.hd)
    elif a.thumb:
        cmd_thumb(bank, a.thumb)
    elif a.get:
        if not a.out:
            ap.error("--get exige --out <pasta do reel>")
        cmd_get(bank, a.get, a.out)
    else:
        ap.error("use --list, --thumb ou --get")


if __name__ == "__main__":
    main()
