#!/usr/bin/env python3
"""Gate de portugues PERFEITO na legenda: compara o SRT palavra a palavra com o cenas.txt.

A legenda transcreve a fala e a fala vem do cenas.txt, entao TODA palavra do SRT precisa
existir no vocabulario do cenas.txt (apos mapear as grafias foneticas do TTS pra grafia
escrita). Palavra fora do vocabulario = erro de transcricao do Whisper (ex: "reesplicar",
"concerteza") e REPROVA: corrigir no SRT com a grafia do cenas.txt e rodar de novo.

Uso: python checar_srt.py <arquivo.srt> <cenas.txt>
Exit 0 = limpo. Exit 1 = palavras suspeitas listadas (com o numero do bloco SRT).
"""
import re, sys, unicodedata

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# grafia fonetica do cenas.txt -> grafia escrita esperada na legenda (glossario voz-eric.md)
FONETICA = {
    "cláudi": ["claude"], "claudi": ["claude"],
    "côud": ["code"], "coud": ["code"],
    "eme": ["mcp"], "cê": ["mcp"], "pê": ["mcp"],
    "slék": ["slack"], "rimótchon": ["remotion"], "tuénti": ["twenty"],
    "ôupen": ["openart", "open"], "dairéctor": ["director"], "dairécting": ["directing"],
    "váib": ["vibe"], "váibe": ["vibe"], "flôu": ["flow"],
    "guit": ["github"], "râb": ["github"],
    "éipifai": ["apify"], "apólo": ["apollo"],
    "línquedin": ["linkedin"], "rédit": ["reddit"], "gúgou": ["google"], "méps": ["maps"],
}
# sempre aceitas (numerais que o Whisper escreve em digito, pontuacao de siglas comuns)
EXTRAS = {"1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "15", "20", "30", "50", "60", "100", "ia", "ai"}


def norm(w):
    w = w.lower().strip(".,!?;:\"'()[]…—-–")
    return w


def palavras(texto):
    return [norm(w) for w in re.findall(r"[\wÀ-ÿ]+(?:-[\wÀ-ÿ]+)*", texto)]


def main():
    if len(sys.argv) != 3:
        sys.exit("uso: python checar_srt.py <arquivo.srt> <cenas.txt>")
    srt_path, cenas_path = sys.argv[1], sys.argv[2]

    cenas = open(cenas_path, encoding="utf-8").read()
    vocab = set(palavras(cenas)) | EXTRAS
    for fon, escritas in FONETICA.items():
        if fon in vocab:
            vocab.update(escritas)

    texto = open(srt_path, encoding="utf-8").read()
    suspeitas = []
    for bloco in re.split(r"\n\s*\n", texto.strip()):
        linhas = bloco.strip().splitlines()
        if len(linhas) < 3 or "-->" not in linhas[1]:
            continue
        num = linhas[0].strip()
        for w in palavras(" ".join(linhas[2:])):
            if w and w not in vocab:
                suspeitas.append((num, w))

    if suspeitas:
        print("LEGENDA REPROVADA — palavras fora do texto-fonte (corrigir pra grafia do cenas.txt):")
        for num, w in suspeitas:
            print(f"  bloco {num}: \"{w}\"")
        print(f"\n{len(suspeitas)} ocorrencia(s). Corrigir TODAS e rodar de novo. Uma letra errada reprova.")
        sys.exit(1)
    print("LEGENDA OK — todas as palavras conferem com o cenas.txt.")


if __name__ == "__main__":
    main()
