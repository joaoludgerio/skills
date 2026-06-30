#!/usr/bin/env python3
"""Simulador de custo do reel (criar-reel) -- roda ANTES de gastar credito.

Estima o custo do video com os precos REAIS que conhecemos (HeyGen lip-sync +
ElevenLabs + imagens) e marca o Kling como "a confirmar" -- o saldo de API do
Kling e pre-pago e a taxa por clipe ainda nao esta fechada (ver references/custos.md).
NUNCA inventa um numero pro Kling: a trava existe pra parar e mostrar o custo que
realmente sabemos, nao pra fabricar falsa precisao.

Diferenca pra v2: a v3 gera a FALA no ElevenLabs (barato) e usa o HeyGen so pro
lip-sync (Avatar V); os B-rolls vem PRIMEIRO do banco remoto (gratis) -- o Kling so
cobre os gaps. Por isso o Kling costuma ser ~zero na maioria dos reels.

Regra de caixa (definida pelo Eric): entram HeyGen, ElevenLabs, imagens(se API) e
Kling(gaps). Claude (tokens) = assinatura, fora. Banco de B-roll = gratis.

Uso:
  python simular_custo.py --cenas-file <reel>/cenas.txt --clips 10 --clips-kling 2
  python simular_custo.py --segundos 53 --chars 938 --clips 10 --clips-kling 0

Flags:
  --clips N         total de B-rolls (default: ceil(duracao / 5))
  --clips-kling N   quantos B-rolls saem no Kling (pago). Default: 0 (tudo do banco)
  --engine          avatar_iv (default, lip-sync Avatar V) | avatar_video (~4x mais barato)
  --modo            api (default) | plano
  --imagens         api (paga, default) | assinatura (gratis, feita na UI)
  --cambio          R$/US$ (default 5.10)
"""
import argparse
import math
import os
import sys

# taxas REAIS conhecidas (ver references/custos.md; fonte: CSV de uso HeyGen do Eric 14/06/2026)
HEYGEN = {
    ("avatar_iv", "api"):      {"cr_s": 0.062, "usd_cr": 1.00},
    ("avatar_iv", "plano"):    {"cr_s": 0.022, "usd_cr": 0.145},
    ("avatar_video", "api"):   {"cr_s": 0.017, "usd_cr": 1.00},
    ("avatar_video", "plano"): {"cr_s": 0.006, "usd_cr": 0.145},  # extrapolado
}
CHARS_POR_SEG = 17.8   # ritmo de fala medido (938 chars / 52.8s)
EL_USD_POR_1K = 0.22   # ElevenLabs Creator/Pro (US$/1000 chars)
IMG_USD = 0.21         # gpt-image-2 alta qualidade (por IMAGEM, via API)
CLIP_DUR = 5           # ~5s por trecho de B-roll (regra ceil(duracao / 5))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cenas-file")
    ap.add_argument("--chars", type=int)
    ap.add_argument("--segundos", type=float)
    ap.add_argument("--clips", type=int)
    ap.add_argument("--clips-kling", type=int, default=0)
    ap.add_argument("--engine", default="avatar_iv", choices=["avatar_iv", "avatar_video"])
    ap.add_argument("--modo", default="api", choices=["api", "plano"])
    ap.add_argument("--imagens", default="api", choices=["api", "assinatura"])
    ap.add_argument("--cambio", type=float, default=5.10)
    ap.add_argument("--img-usd", type=float, default=IMG_USD)
    args = ap.parse_args()

    # caracteres
    chars = args.chars
    if chars is None and args.cenas_file and os.path.exists(args.cenas_file):
        txt = open(args.cenas_file, encoding="utf-8").read()
        chars = sum(1 for c in txt if c not in "\r\n")
    chars = chars or 0

    # duracao
    seg = args.segundos
    if seg is None:
        if chars:
            seg = chars / CHARS_POR_SEG
        else:
            sys.exit("passe --segundos OU --chars OU --cenas-file")

    # clipes: total, banco (gratis) e Kling (pago / a confirmar)
    clips = args.clips if args.clips is not None else math.ceil(seg / CLIP_DUR)
    clips_kling = max(0, min(args.clips_kling, clips))
    clips_banco = max(0, clips - clips_kling)
    n_imgs = clips_kling + 1  # 1 frame por clip Kling (gap) + 1 thumb; banco nao gera frame
    cambio = args.cambio
    rate = HEYGEN[(args.engine, args.modo)]

    def brl(u):
        return u * cambio

    # componentes de custo CONHECIDO
    hg_usd = seg * rate["cr_s"] * rate["usd_cr"]
    el_usd = chars / 1000 * EL_USD_POR_1K
    img_paga = args.imagens == "api"
    img_usd = (n_imgs * args.img_usd) if img_paga else 0.0
    conhecido_usd = hg_usd + el_usd + img_usd
    conhecido_brl = brl(conhecido_usd)
    minutos = seg / 60 if seg else 0

    L = "=" * 66
    print(L)
    print("SIMULACAO DE CUSTO  --  criar-reel")
    print(L)
    print(f"Roteiro: {chars} caracteres   duracao estimada: {seg:.1f}s ({minutos:.2f} min)")
    print(f"HeyGen: {args.engine}/{args.modo} (lip-sync)  |  Imagens: {args.imagens}  |  cambio R${cambio:.2f}/US$")
    print(f"B-rolls: {clips} total = {clips_banco} do BANCO (gratis) + {clips_kling} no KLING")
    print("-" * 66)
    print(f"{'Componente':<26}{'detalhe':<15}{'US$':>9}{'R$':>11}")
    print(f"{'HeyGen (lip-sync)':<26}{f'{seg:.0f}s':<15}{hg_usd:>9.2f}{brl(hg_usd):>11.2f}")
    print(f"{'ElevenLabs (fala)':<26}{f'{chars} ch':<15}{el_usd:>9.2f}{brl(el_usd):>11.2f}")
    img_det = f"{n_imgs} imgs" if img_paga else "assinatura"
    print(f"{'Imagens (frames+thumb)':<26}{img_det:<15}{img_usd:>9.2f}{brl(img_usd):>11.2f}")
    print(f"{'B-roll banco':<26}{f'{clips_banco} clips':<15}{0:>9.2f}{0:>11.2f}")
    print("-" * 66)
    if minutos:
        print(f"(custo conhecido por minuto: US${conhecido_usd/minutos:.2f} / R${conhecido_brl/minutos:.2f})")
    print(f"Coberto pela assinatura, fora do total: Claude (tokens)" + ("" if img_paga else " + imagens (assinatura)"))
    print(L)
    print(f"CUSTO CONHECIDO: US$ {conhecido_usd:.2f}  /  R$ {conhecido_brl:.2f}")
    if clips_kling:
        print(f"+ KLING: {clips_kling} clipe(s) -- PRECO A CONFIRMAR (saldo de API pre-pago; ver custos.md)")
    else:
        print("+ KLING: 0 clipes (tudo coberto pelo banco gratis)")
    print(L)
    extra = f"  + Kling ({clips_kling} clipes a confirmar)" if clips_kling else ""
    print(f"==> ESSE VIDEO VAI CUSTAR ~R$ {conhecido_brl:.2f}{extra}.  Prosseguir? (s/n)")
    print(L)


if __name__ == "__main__":
    main()
