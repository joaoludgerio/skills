#!/usr/bin/env python3
"""Monta o HTML de entrega do carrossel: editor + projeto injetado.

A skill usa este script pra transformar o projeto (JSON) num arquivo HTML que
a pessoa abre no navegador ja preenchido e exporta os PNGs. E mais confiavel
do que injetar a string na mao.

Se um slide tiver "foto" apontando pra um arquivo no disco (em vez de um dataURL),
o script le a imagem e embute como dataURL base64 — assim o HTML funciona offline,
no duplo-clique, sem depender do caminho da foto.

Uso:
    python montar.py projeto.json saida.html
"""
import sys, json, os, base64, mimetypes

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "editor-carrossel.html")


def embutir_foto(valor):
    """Se 'valor' for um caminho de arquivo, vira dataURL base64. dataURL/None passam direto."""
    if not valor or valor.startswith("data:"):
        return valor
    if not os.path.exists(valor):
        print(f"AVISO: foto nao encontrada, ignorando: {valor}")
        return None
    mime = mimetypes.guess_type(valor)[0] or "image/jpeg"
    with open(valor, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    return f"data:{mime};base64,{b64}"


def main():
    if len(sys.argv) < 3:
        raise SystemExit("uso: python montar.py projeto.json saida.html")
    proj_path, out_path = sys.argv[1], sys.argv[2]

    with open(proj_path, encoding="utf-8") as f:
        proj = json.load(f)
    with open(TEMPLATE, encoding="utf-8") as f:
        html = f.read()

    # embute as fotos (caminho de arquivo -> dataURL) pra o HTML rodar offline
    for s in proj.get("slides", []):
        if s.get("foto"):
            s["foto"] = embutir_foto(s["foto"])

    # injeta window.CARROSSEL imediatamente antes da tag <script> principal,
    # pra que o boot do editor leia o projeto e ja abra preenchido.
    inj = "<script>window.CARROSSEL = " + json.dumps(proj, ensure_ascii=False) + ";</script>\n"
    idx = html.rfind("<script>")
    if idx == -1:
        raise SystemExit("template invalido: tag <script> nao encontrada")
    out = html[:idx] + inj + html[idx:]

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(out)
    print("OK ->", out_path, f"({len(proj.get('slides', []))} slides)")


if __name__ == "__main__":
    main()
