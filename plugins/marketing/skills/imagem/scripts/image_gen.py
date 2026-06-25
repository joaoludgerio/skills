#!/usr/bin/env python3
"""
image_gen.py — wrapper CLI para geração/edição de imagens via OpenAI gpt-image-2
Skill: imagem (~/.claude/skills/imagem)
"""

import argparse
import base64
import os
import pathlib
import sys

try:
    from openai import OpenAI
except ImportError:
    print("ERRO: openai nao instalado. Rode: pip install openai")
    sys.exit(1)


def get_api_key():
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key:
        # Tenta 1Password
        import subprocess
        result = subprocess.run(
            ["op", "read", "op://Agentes Eric/OPENAI_API_KEY/credential"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            key = result.stdout.strip()
    if not key:
        print("ERRO: OPENAI_API_KEY nao encontrada. Configure no env ou 1Password.")
        sys.exit(1)
    return key


def cmd_edit(args):
    client = OpenAI(api_key=get_api_key())
    with open(args.image, "rb") as f:
        kwargs = dict(
            model=args.model,
            image=f,
            prompt=args.prompt,
            n=1,
        )
        if args.size:
            kwargs["size"] = args.size
        if args.quality:
            kwargs["quality"] = args.quality
        if args.output_format:
            kwargs["output_format"] = args.output_format

        result = client.images.edit(**kwargs)

    img_data = base64.b64decode(result.data[0].b64_json)
    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(img_data)
    print(f"OK: {out} — {len(img_data)} bytes")


def cmd_generate(args):
    client = OpenAI(api_key=get_api_key())
    kwargs = dict(
        model=args.model,
        prompt=args.prompt,
        n=1,
    )
    if args.size:
        kwargs["size"] = args.size
    if args.quality:
        kwargs["quality"] = args.quality
    if args.output_format:
        kwargs["output_format"] = args.output_format

    result = client.images.generate(**kwargs)

    img_data = base64.b64decode(result.data[0].b64_json)
    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(img_data)
    print(f"OK: {out} — {len(img_data)} bytes")


def main():
    parser = argparse.ArgumentParser(description="image_gen — OpenAI gpt-image-2 CLI")
    sub = parser.add_subparsers(dest="cmd")

    # edit
    p_edit = sub.add_parser("edit", help="Edita imagem existente")
    p_edit.add_argument("--model", default="gpt-image-2")
    p_edit.add_argument("--image", required=True, help="Caminho da imagem de referência")
    p_edit.add_argument("--prompt", required=True)
    p_edit.add_argument("--out", required=True, help="Caminho de saída")
    p_edit.add_argument("--size", default="1024x1536")
    p_edit.add_argument("--quality", default="high")
    p_edit.add_argument("--output-format", default="jpeg", dest="output_format")
    p_edit.add_argument("--force", action="store_true")

    # generate
    p_gen = sub.add_parser("generate", help="Gera imagem do zero")
    p_gen.add_argument("--model", default="gpt-image-2")
    p_gen.add_argument("--prompt", required=True)
    p_gen.add_argument("--out", required=True, help="Caminho de saída")
    p_gen.add_argument("--size", default="1024x1024")
    p_gen.add_argument("--quality", default="high")
    p_gen.add_argument("--output-format", default="jpeg", dest="output_format")
    p_gen.add_argument("--force", action="store_true")

    args = parser.parse_args()
    if args.cmd == "edit":
        cmd_edit(args)
    elif args.cmd == "generate":
        cmd_generate(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
