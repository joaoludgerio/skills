#!/usr/bin/env python3
"""Arquiva um reel produzido NA NUVEM (release 'arquivo' do repo privado
joaoludgerio/expert-reels-arquivo) e opcionalmente apaga a pasta local.

Sobe 3 assets por reel: <slug>-final.mp4 (master), <slug>-fala.mp4 (video do HeyGen,
o asset PAGO que permite recompor de graca no futuro) e <slug>-textos.zip (cenas.txt,
roteiro.md, legenda-post.md, .srt, thumb). B-rolls/frames/blocos NAO sobem (regeneraveis).

Uso:
  python arquivar_reel.py --reel <pasta> [--slug nome-do-reel] [--apagar]
  python arquivar_reel.py --baixar <slug> --out <pasta>     # recupera um reel arquivado

Requer `gh` autenticado com acesso ao repo. --apagar so remove a pasta depois de
verificar que os 3 assets subiram com o tamanho certo.
"""
import argparse, glob, json, os, shutil, subprocess, sys, zipfile

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REPO = "joaoludgerio/expert-reels-arquivo"
TAG = "arquivo"


def gh(args):
    r = subprocess.run(["gh"] + args, capture_output=True, text=True)
    return r.returncode, r.stdout, r.stderr


def assets_remotos():
    code, out, err = gh(["release", "view", TAG, "--repo", REPO, "--json", "assets",
                         "--jq", "[.assets[] | {name, size}]"])
    if code != 0:
        sys.exit(f"sem acesso ao release (gh autenticado? colaborador do repo?): {err[-200:]}")
    return {a["name"]: a["size"] for a in json.loads(out or "[]")}


def upload(path, nome):
    tmp = os.path.join(os.path.dirname(path), nome)
    renomeado = False
    if os.path.basename(path) != nome:
        shutil.copy2(path, tmp); renomeado = True
    code, _, err = gh(["release", "upload", TAG, tmp, "--repo", REPO, "--clobber"])
    if renomeado:
        os.remove(tmp)
    if code != 0:
        sys.exit(f"upload de {nome} falhou: {err[-300:]}")
    print(f"  subiu {nome}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--reel", help="pasta do reel a arquivar")
    g.add_argument("--baixar", metavar="SLUG", help="baixa um reel arquivado")
    ap.add_argument("--slug", help="nome no arquivo (default: nome da pasta sem 'reel-')")
    ap.add_argument("--apagar", action="store_true", help="apaga a pasta local apos verificar o upload")
    ap.add_argument("--out", help="pasta destino do --baixar")
    args = ap.parse_args()

    if args.baixar:
        out = args.out or f"./{args.baixar}"
        os.makedirs(out, exist_ok=True)
        code, _, err = gh(["release", "download", TAG, "--repo", REPO, "-D", out,
                           "--pattern", f"{args.baixar}-*"])
        if code != 0:
            sys.exit(f"download falhou: {err[-300:]}")
        print(f"baixado pra {out}", flush=True)
        return

    reel = os.path.abspath(args.reel)
    slug = args.slug or os.path.basename(reel).removeprefix("reel-")
    finais = sorted(glob.glob(os.path.join(reel, "video-final-*.mp4")))
    fala = os.path.join(reel, "heygen", "eric-green.mp4")
    if not finais:
        sys.exit(f"nenhum video-final-*.mp4 em {reel}")
    if not os.path.exists(fala):
        sys.exit(f"fala nao encontrada: {fala}")

    # textos + thumb num zip pequeno
    ztmp = os.path.join(reel, f"{slug}-textos.zip")
    with zipfile.ZipFile(ztmp, "w", zipfile.ZIP_DEFLATED) as z:
        for pat in ("cenas.txt", "roteiro.md", "legenda-post.md", "*.srt", "thumb-*.png"):
            for f in glob.glob(os.path.join(reel, pat)):
                z.write(f, os.path.basename(f))
    print(f"arquivando '{slug}'...", flush=True)
    upload(finais[0], f"{slug}-final.mp4")
    upload(fala, f"{slug}-fala.mp4")
    upload(ztmp, f"{slug}-textos.zip")
    os.remove(ztmp)

    # verificacao de tamanho antes de qualquer exclusao
    rem = assets_remotos()
    esperado = {
        f"{slug}-final.mp4": os.path.getsize(finais[0]),
        f"{slug}-fala.mp4": os.path.getsize(fala),
    }
    for nome, tam in esperado.items():
        if rem.get(nome) != tam:
            sys.exit(f"VERIFICACAO FALHOU pra {nome} (local {tam} vs remoto {rem.get(nome)}). NADA foi apagado.")
    print("verificacao de tamanho OK", flush=True)

    if args.apagar:
        shutil.rmtree(reel)
        print(f"pasta local apagada: {reel}", flush=True)
    else:
        print("(pasta local mantida; use --apagar pra remover apos arquivar)", flush=True)


if __name__ == "__main__":
    main()
