#!/usr/bin/env python3
"""Simulador de custo do reel (criar-reel-v2) — roda ANTES de gastar credito.

Estima o custo TOTAL do video (HeyGen + Higgsfield + imagens + ElevenLabs) a partir
do roteiro e do numero de B-rolls. Saida = custo total + "prosseguir?". O detalhe por
componente fica abaixo, mas o que importa pro gate e o total.

Taxas reais: CSV de uso HeyGen do Eric (14/06/2026) + extrato Higgsfield + precos publicos.
Metodologia e confianca em references/custos.md.

Regra de caixa: HeyGen + Higgsfield + ElevenLabs + imagens(se API) entram no total.
Claude (tokens) e coberto pela assinatura. Imagens podem ser API (paga) ou assinatura (gratis) —
ver --imagens. O openai_image.py da skill usa a API PAGA por padrao.

Uso:
  python simular_custo.py --cenas-file <reel>/cenas.txt --clips 3
  python simular_custo.py --segundos 53 --chars 938 --clips 3 --modo plano --imagens assinatura
  python simular_custo.py --cenas-file cenas.txt --clips 9 --engine avatar_video

Flags:
  --clips N        nro de B-rolls. Default: ceil(duracao / 5). (cada B-roll = 1 imagem + 1 video)
  --engine         avatar_iv (premium, default) | avatar_video (padrao, ~4x mais barato)
  --modo           api (default) | plano
  --imagens        api (paga, default — openai_image.py) | assinatura (gratis, feita na mao)
  --cambio         R$/US$ (default 5.10)
"""
import argparse
import math
import os
import sys

# --- taxas reais (ver references/custos.md; fonte: CSV de uso HeyGen do Eric 14/06/2026) ---
HEYGEN = {
    ("avatar_iv", "api"):      {"cr_s": 0.062, "usd_cr": 1.00},
    ("avatar_iv", "plano"):    {"cr_s": 0.022, "usd_cr": 0.145},
    ("avatar_video", "api"):   {"cr_s": 0.017, "usd_cr": 1.00},
    ("avatar_video", "plano"): {"cr_s": 0.006, "usd_cr": 0.145},  # extrapolado (ratio ~3x)
}
CHARS_POR_SEG = 17.8       # ritmo de fala medido (938 chars / 52.8s)
HF_CRED_POR_SEG = 1.0      # veo3_1_lite = 1 credito por SEGUNDO (confirmado: 4s=4cr,6s=6cr,8s=8cr)
HF_USD_POR_CRED = 0.05     # pack ~US$5 / 100 creditos -> US$0.05/s de B-roll
CLIP_DUR = 8               # segundos por clipe (veo3_1_lite aceita 4|6|8; 8 = cobre com menos imagens)
EL_USD_POR_1K = 0.22       # ElevenLabs Creator (US$/1000 chars)
IMG_USD = 0.21             # gpt-image-2 alta qualidade (por IMAGEM, via API)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cenas-file")
    ap.add_argument("--chars", type=int)
    ap.add_argument("--segundos", type=float)
    ap.add_argument("--clips", type=int)
    ap.add_argument("--engine", default="avatar_iv", choices=["avatar_iv", "avatar_video"])
    ap.add_argument("--modo", default="api", choices=["api", "plano"])
    ap.add_argument("--imagens", default="api", choices=["api", "assinatura"])
    ap.add_argument("--cambio", type=float, default=5.10)
    ap.add_argument("--clip-dur", type=float, default=CLIP_DUR)
    ap.add_argument("--hf-usd-cred", type=float, default=HF_USD_POR_CRED)
    ap.add_argument("--plano-usd-cred", type=float, default=0.145)
    ap.add_argument("--img-usd", type=float, default=IMG_USD)
    args = ap.parse_args()

    # caracteres
    chars = args.chars
    if chars is None and args.cenas_file and os.path.exists(args.cenas_file):
        txt = open(args.cenas_file, encoding="utf-8").read()
        chars = sum(1 for c in txt if c not in "\r\n")
    if not chars:
        chars = 0

    # duracao
    seg = args.segundos
    if seg is None:
        if chars:
            seg = chars / CHARS_POR_SEG
        else:
            sys.exit("passe --segundos OU --chars OU --cenas-file")

    # clipes e imagens (1 imagem por B-roll + 1 thumb)
    clips = args.clips if args.clips is not None else math.ceil(seg / args.clip_dur)
    n_imgs = clips + 1
    cambio = args.cambio

    rate = dict(HEYGEN[(args.engine, args.modo)])
    if args.modo == "plano":
        rate["usd_cr"] = args.plano_usd_cred

    def brl(u):
        return u * cambio

    # componentes
    hg_cred = seg * rate["cr_s"]
    hg_usd = hg_cred * rate["usd_cr"]
    broll_seg = clips * args.clip_dur
    hf_cred = broll_seg * HF_CRED_POR_SEG
    hf_usd = hf_cred * args.hf_usd_cred
    el_usd = chars / 1000 * EL_USD_POR_1K
    img_paga = args.imagens == "api"
    img_usd = (n_imgs * args.img_usd) if img_paga else 0.0

    total_usd = hg_usd + hf_usd + el_usd + img_usd
    total_brl = brl(total_usd)
    minutos = seg / 60 if seg else 0

    L = "=" * 64
    print(L)
    print("SIMULACAO DE CUSTO  --  criar-reel-v2")
    print(L)
    print(f"Roteiro: {chars} caracteres   duracao estimada: {seg:.1f}s ({minutos:.2f} min)")
    print(f"HeyGen: {args.engine}/{args.modo}  |  Imagens: {args.imagens}  |  cambio R${cambio:.2f}/US$")
    print(f"B-rolls: {clips} clipe(s) x {args.clip_dur:.0f}s = {clips*args.clip_dur:.0f}s  ({n_imgs} imagens: {clips} frames + 1 thumb)")
    print("-" * 64)
    print(f"{'Componente':<24}{'detalhe':<16}{'US$':>9}{'R$':>11}")
    print(f"{'HeyGen (avatar)':<24}{f'{hg_cred:.2f} cr':<16}{hg_usd:>9.2f}{brl(hg_usd):>11.2f}")
    print(f"{'Higgsfield (B-roll)':<24}{f'{broll_seg:.0f}s={hf_cred:.0f}cr':<16}{hf_usd:>9.2f}{brl(hf_usd):>11.2f}")
    img_det = f"{n_imgs} imgs" if img_paga else "assinatura"
    print(f"{'Imagens (frame+thumb)':<24}{img_det:<16}{img_usd:>9.2f}{brl(img_usd):>11.2f}")
    print(f"{'ElevenLabs (audio)':<24}{f'{chars} ch':<16}{el_usd:>9.2f}{brl(el_usd):>11.2f}")
    print("-" * 64)
    if minutos:
        print(f"(por minuto de video: US${total_usd/minutos:.2f} / R${brl(total_usd)/minutos:.2f})")
    cob = "Claude (tokens)" + ("" if img_paga else " + imagens (assinatura)")
    print(f"Coberto pela assinatura, fora do total: {cob}")
    print(L)
    print(f"==> ESSE VIDEO VAI CUSTAR ~R$ {total_brl:.2f}  (US$ {total_usd:.2f}).  Prosseguir? (s/n)")
    print(L)


if __name__ == "__main__":
    main()
