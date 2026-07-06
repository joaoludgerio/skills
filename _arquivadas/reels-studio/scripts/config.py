"""Configuracao compartilhada: carrega chaves de API, o avatar e o elenco do b-roll.

Importado pelos outros scripts. Le:
  - config/chaves.env   (formato CHAVE=valor)
  - config/avatar.json  (avatar HeyGen + voz)
  - config/elenco.json  (personagens/estilo do b-roll de imagens)

Nenhuma chave fica no codigo.
"""
import os
import json

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_DIR = os.path.join(SKILL_DIR, "config")


def _carregar_env():
    caminho = os.path.join(CONFIG_DIR, "chaves.env")
    if not os.path.exists(caminho):
        return
    with open(caminho, encoding="utf-8") as f:
        for linha in f:
            linha = linha.strip()
            if not linha or linha.startswith("#") or "=" not in linha:
                continue
            chave, valor = linha.split("=", 1)
            os.environ.setdefault(chave.strip(), valor.strip())


_carregar_env()

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")        # imagens do b-roll (gpt-image-2)
HEYGEN_API_KEY = os.environ.get("HEYGEN_API_KEY", "")        # avatar que apresenta
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")  # opcional: voz clonada
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "").strip() or os.path.join(SKILL_DIR, "saida")


def exigir(*nomes):
    """Aborta com mensagem clara se faltar alguma chave necessaria."""
    faltando = [n for n in nomes if not os.environ.get(n)]
    if faltando:
        raise SystemExit(
            f"Faltam chaves: {faltando}. Rode o onboarding (PASSO 0 do SKILL.md) "
            f"e preencha config/chaves.env."
        )


def _carregar_json(nome, dica):
    caminho = os.path.join(CONFIG_DIR, nome)
    if not os.path.exists(caminho):
        raise SystemExit(f"Sem config/{nome}. {dica}")
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def carregar_avatar():
    return _carregar_json("avatar.json", "Rode o onboarding (PASSO 0.2) pra configurar o avatar HeyGen.")


def carregar_elenco():
    return _carregar_json("elenco.json", "Rode o onboarding (PASSO 0.3) pra montar o elenco do b-roll.")
