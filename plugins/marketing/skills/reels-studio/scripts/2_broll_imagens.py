"""Etapa 2 - Gera as imagens do b-roll (gpt-image-2) a partir das cenas + elenco.

Metodo "imagem primeiro": a IA gera a IMAGEM da cena (nitida, controlavel) e so
depois ela vira video (etapa 3). Gerar video direto do texto sai inconsistente e
fora de padrao.

O agente escreve um cenas.json (uma cena por take), descrevendo a acao e quais
personagens do elenco aparecem:

    [
      {"id":"c01","personagens":["principal","mascote"],"acao":"...o que acontece...","extra":"...elementos/texto na cena..."},
      ...
    ]

Uso:
    python etapa2_gerar_broll.py cenas.json /pasta_saida_imagens

Requer OPENAI_API_KEY. (Etapa que usa API paga.)
"""
import os
import sys
import json
import base64
import time
import subprocess
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
import config as C

C.exigir("OPENAI_API_KEY")

with open(sys.argv[1], encoding="utf-8") as f:
    CENAS = json.load(f)
PASTA = sys.argv[2] if len(sys.argv) > 2 else os.path.join(C.OUTPUT_DIR, "imagens")
os.makedirs(PASTA, exist_ok=True)
ELENCO = C.carregar_elenco()


def descricoes(chaves):
    """Junta as descricoes dos personagens pedidos na cena."""
    blocos = []
    for k in chaves:
        d = ELENCO.get("personagens", {}).get(k) or ELENCO.get("extras", {}).get(k)
        if d:
            blocos.append(d)
    return "\n\n".join(blocos)


def prompt_da_cena(cena):
    quem = cena.get("personagens") or ELENCO.get("sempre_presentes", list(ELENCO.get("personagens", {}).keys()))
    return (
        f"Cena cinematografica em quadro horizontal 16:9. {ELENCO.get('estilo', 'estilo 3D cinematografico')}. "
        f"Composicao crivel e coerente.\n\n"
        f"PERSONAGENS (sempre presentes e consistentes):\n{descricoes(quem)}\n\n"
        f"ACAO DA CENA:\n{cena.get('acao', '')}\n\n"
        f"ELEMENTOS VISUAIS EXTRAS:\n{cena.get('extra', '')}\n\n"
        f"AMBIENTE: {ELENCO.get('ambiente', '')}\n\n"
        f"PALETA: {ELENCO.get('paleta', '')}\n\n"
        f"{ELENCO.get('area_segura', 'Mantenha personagens, rostos e textos no centro (70%). As bordas de cima e de baixo (~18%) sao so ambiente, pra nada se perder no corte.')}"
    )


def gerar(cena):
    corpo = {
        "model": "gpt-image-2",
        "prompt": prompt_da_cena(cena),
        "size": "1536x1024",
        "quality": "high",
        "output_format": "jpeg",
        "n": 1,
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=json.dumps(corpo).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {C.OPENAI_API_KEY}"},
        method="POST")
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                resp = json.load(r)
            bruta = os.path.join(PASTA, f"{cena['id']}_bruta.jpg")
            with open(bruta, "wb") as f:
                f.write(base64.b64decode(resp["data"][0]["b64_json"]))
            # a imagem nasce 3:2 (1536x1024); corta pra 16:9 tirando so topo/base
            recorte = os.path.join(PASTA, f"{cena['id']}_16x9.jpg")
            subprocess.run(["ffmpeg", "-y", "-i", bruta, "-vf", "crop=1536:864:0:80", recorte],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            print("IMAGEM OK", cena["id"], flush=True)
            return
        except urllib.error.HTTPError as e:
            print("IMAGEM ERRO", cena["id"], e.code, e.read().decode()[:160], flush=True)
            time.sleep(15)
    print("IMAGEM FALHOU", cena["id"], flush=True)


with ThreadPoolExecutor(max_workers=4) as ex:
    list(ex.map(gerar, CENAS))
print("IMAGENS PRONTAS ->", PASTA)
print("Confira as imagens e aprove ANTES de animar (etapa 3).")
