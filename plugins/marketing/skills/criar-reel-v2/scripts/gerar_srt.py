#!/usr/bin/env python3
"""
Gera um .srt a partir de um vídeo/áudio usando Whisper local e aplica correções
automáticas de termos técnicos que o ASR costuma errar no nicho do Eric (IA/marketing).

Usage:
    python gerar_srt.py "C:/.../video.mp4" [--model small] [--lang Portuguese] [--out DIR] [--words N]

Saída: <DIR>/<basename>.srt já corrigido. Imprime "REVISAR:" com termos ambíguos que
o Claude deve checar no contexto (ex: MarkItDown vs Markdown, nomes de marca).

Legendas curtas (estilo Reels): por padrão usa timestamps por palavra do Whisper e
quebra a legenda em no máx. WORDS_PER_LINE palavras, pra cada trecho aparecer colado
na fala em vez de uma frase de 4 linhas parada na tela por vários segundos.
    --words N   máx. de palavras por legenda (default 4). --words 0 = frase inteira (modo antigo).

Requer: openai-whisper instalado e ffmpeg no PATH.
"""
import sys, os, re, shutil, subprocess

# Padrão de legenda curta: nº máx. de palavras por segmento na tela (estilo Reels).
WORDS_PER_LINE = 4

# Correções de alta confiança (substituição por palavra inteira, case-insensitive).
# Só entram aqui erros que o Whisper comete de forma consistente no nicho do Eric.
CORRECTIONS = [
    (r"\bclou?d\b", "Claude"),       # "cloud"/"clod" -> Claude
    (r"\bclaud[ie]?\b", "Claude"),   # "claudi"/"claude"/"claud" -> Claude
    (r"\bcl[áa]udi?o\b", "Claude"),  # "Cláudio" -> Claude (TTS fala CLAUDI, ASR ouve Cláudio)
    (r"\bi[áà]\b", "IA"),            # "iá" -> IA (com acento nunca é o verbo "ia")
    (r"\bchat\s*gpt\b", "ChatGPT"),
    (r"\bgit\s*hub\b", "GitHub"),
    (r"\byou\s*tube\b", "YouTube"),
    (r"\blinked\s*in\b", "LinkedIn"),
    (r"\bm\.?c\.?p\b", "MCP"),
    (r"\bpdf\b", "PDF"),
    (r"\bapi\b", "API"),
]
# Obs: "ia" NÃO entra aqui — é também o verbo ("ele ia fazer"); deixar pro Whisper/revisão.

# Termos que dependem de contexto — NÃO corrigir automático, só sinalizar.
REVIEW_TERMS = ["markdown", "markitdown", "mark it down", "fable", "opus", "anthropic",
                "expert integrado", "nano banana", "kling"]


def run_whisper(video, model, lang, out_dir, words):
    exe = shutil.which("whisper")
    if not exe:
        sys.exit("ERRO: 'whisper' não está no PATH. Instale: pip install -U openai-whisper")
    os.makedirs(out_dir, exist_ok=True)
    cmd = [exe, video, "--language", lang, "--model", model,
           "--output_format", "srt", "--output_dir", out_dir]
    if words and words > 0:
        # Timestamps por palavra + quebra em trechos curtos colados na fala (estilo Reels).
        cmd += ["--word_timestamps", "True", "--max_words_per_line", str(words)]
    print(f"-> whisper ({model}) transcrevendo"
          f"{f' (até {words} palavras/legenda)' if words else ''}...", flush=True)
    subprocess.run(cmd, check=True)
    base = os.path.splitext(os.path.basename(video))[0]
    srt = os.path.join(out_dir, base + ".srt")
    if not os.path.exists(srt):
        sys.exit(f"ERRO: SRT não gerado em {srt}")
    return srt


def apply_corrections(srt):
    text = open(srt, encoding="utf-8").read()
    n = 0
    for pat, repl in CORRECTIONS:
        text, c = re.subn(pat, repl, text, flags=re.IGNORECASE)
        n += c
    open(srt, "w", encoding="utf-8").write(text)
    return n, text


def flag_review(text):
    low = text.lower()
    found = [t for t in REVIEW_TERMS if t in low]
    return found


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: python gerar_srt.py <video> [--model small] [--lang Portuguese] [--out DIR]")
    video = sys.argv[1]
    args = sys.argv[2:]
    model = "small"; lang = "Portuguese"; out_dir = os.path.dirname(os.path.abspath(video))
    words = WORDS_PER_LINE
    for i, a in enumerate(args):
        if a == "--model" and i + 1 < len(args): model = args[i + 1]
        if a == "--lang" and i + 1 < len(args): lang = args[i + 1]
        if a == "--out" and i + 1 < len(args): out_dir = args[i + 1]
        if a == "--words" and i + 1 < len(args): words = int(args[i + 1])
    if not os.path.exists(video):
        sys.exit(f"ERRO: arquivo não encontrado: {video}")

    srt = run_whisper(video, model, lang, out_dir, words)
    n, text = apply_corrections(srt)
    print(f"-> {n} correções automáticas aplicadas.")
    review = flag_review(text)
    print(f"\nSRT pronto: {srt}")
    if review:
        print("REVISAR (termos sensíveis ao contexto — checar grafia/uso no .srt):")
        for t in review:
            print(f"   - {t}")
    print("\nLembrete: 'Markdown' (formato) e 'MarkItDown' (ferramenta) são diferentes — confira qual é cada um.")


if __name__ == "__main__":
    main()
