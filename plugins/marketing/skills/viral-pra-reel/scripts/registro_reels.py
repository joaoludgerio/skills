#!/usr/bin/env python3
"""Registro de reels produzidos NA NUVEM (repo publico joaoludgerio/expert-broll-bank).

O arquivo reels-produzidos.md vive no GitHub pra TODA maquina (Joao, Eric, etc.) consultar
e alimentar o mesmo historico. Leitura e publica (raw URL, sem login); escrita usa o `gh`
autenticado (a pessoa precisa ser colaboradora do repo).

Uso:
  python registro_reels.py --sync <destino.md>     # baixa o registro da nuvem pro arquivo local
  python registro_reels.py --add "| 2026-07-04 | tema | PALAVRA | slug | @ref |"
                                                   # acrescenta uma linha e sobe pro GitHub
Exit 0 = ok. Exit 2 no --add = sem acesso de escrita (a linha fica so no arquivo local;
o proximo run de quem tiver acesso pode subir).
"""
import argparse, base64, json, subprocess, sys, urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

REPO = "joaoludgerio/expert-broll-bank"
PATH = "reels-produzidos.md"  # sobrescrito por --file
RAW = f"https://raw.githubusercontent.com/{REPO}/main/{PATH}"
CABECALHO = (
    "# Registro de reels produzidos (anti-repeticao do viral-pra-reel)\n\n"
    "Fonte compartilhada entre maquinas. Atualizar depois de CADA producao.\n\n"
    "| data | tema | palavra CTA | slug Biblioteca | referência |\n|---|---|---|---|---|\n"
)


def baixar():
    try:
        with urllib.request.urlopen(RAW, timeout=30) as r:
            return r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def gh(args, input_bytes=None):
    r = subprocess.run(["gh"] + args, capture_output=True, text=False, input=input_bytes)
    return r.returncode, r.stdout.decode("utf-8", "replace"), r.stderr.decode("utf-8", "replace")


def subir(conteudo, mensagem):
    code, out, _ = gh(["api", f"repos/{REPO}/contents/{PATH}", "--jq", ".sha"])
    sha = out.strip() if code == 0 else None
    body = {"message": mensagem, "content": base64.b64encode(conteudo.encode("utf-8")).decode()}
    if sha:
        body["sha"] = sha
    code, out, err = gh(["api", "-X", "PUT", f"repos/{REPO}/contents/{PATH}", "--input", "-"],
                        input_bytes=json.dumps(body).encode("utf-8"))
    if code != 0:
        print("AVISO: sem acesso de escrita no registro remoto (gh nao autenticado ou sem "
              f"permissao no repo {REPO}). A linha ficou so no local.\n{err[-300:]}", flush=True)
        sys.exit(2)
    print("registro remoto atualizado", flush=True)


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--sync", metavar="DESTINO", help="baixa o registro da nuvem pro arquivo local")
    g.add_argument("--add", metavar="LINHA", help="acrescenta a linha (formato | a | b | c | d | e |) e sobe")
    g.add_argument("--put", metavar="ARQUIVO", help="sobe o arquivo local inteiro (sobrescreve o remoto)")
    ap.add_argument("--file", default=None, help="nome do arquivo remoto (default reels-produzidos.md)")
    args = ap.parse_args()
    global PATH, RAW
    if args.file:
        PATH = args.file
        RAW = f"https://raw.githubusercontent.com/{REPO}/main/{PATH}"

    if args.sync:
        remoto = baixar()
        if remoto is None:
            print("registro remoto ainda nao existe; criando local vazio", flush=True)
            remoto = CABECALHO
        open(args.sync, "w", encoding="utf-8").write(remoto)
        print(f"sincronizado -> {args.sync} ({remoto.count(chr(10))} linhas)", flush=True)
        return

    if args.put:
        conteudo = open(args.put, encoding="utf-8").read()
        subir(conteudo, f"atualiza {PATH}")
        return

    linha = args.add.strip()
    if not (linha.startswith("|") and linha.endswith("|") and linha.count("|") == 6):
        sys.exit("linha invalida: use o formato | data | tema | PALAVRA | slug | referência |")
    atual = baixar() or CABECALHO
    if linha in atual:
        print("linha ja existe no registro remoto, nada a fazer", flush=True)
        return
    novo = atual.rstrip() + "\n" + linha + "\n"
    subir(novo, f"registro: {linha.split('|')[4].strip()}")


if __name__ == "__main__":
    main()
