#!/usr/bin/env python3
"""
tweet-print: Gera imagem estilo "tweet print" para postar no Instagram.

Uso single:
    python generate.py \\
        --text "Se **Matrix** fosse lancado hoje, o **Neo** se chamaria **Claudio**." \\
        --name "Eric Luciano" \\
        --handle "@ericluciano" \\
        --avatar /caminho/para/foto.jpg \\
        --theme light \\
        --format 1080x1080 \\
        --output ./tweet.png

Uso carrossel (gera N PNGs numerados):
    python generate.py \\
        --texts "Slide **1** texto" "Slide **2** outro texto" "Slide **3** terceiro" \\
        --output-prefix ./carrossel

    -> gera ./carrossel-01.png, ./carrossel-02.png, ./carrossel-03.png

Marca palavras com **dois asteriscos** para deixar em negrito.

Avatar default por usuario:
    Defina a env var TWEET_PRINT_DEFAULT_AVATAR com o caminho da sua foto.
    Cada colaborador seta uma vez e a skill usa por padrao.

Dependencias:
    pip install playwright
    playwright install chromium
"""
import argparse
import base64
import os
import re
import sys
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("ERRO: Playwright nao instalado. Rode: pip install playwright && playwright install chromium", file=sys.stderr)
    sys.exit(1)


BADGE_SVG = (
    '<svg class="badge" viewBox="0 0 22 22" aria-label="Verified">'
    '<path fill="#1d9bf0" d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"/>'
    '</svg>'
)

THEMES = {
    "light": {"bg": "#f5f3ee", "text": "#0f1419", "handle": "#8a8a8a", "avatar_bg": "#1d9bf0"},
    "white": {"bg": "#ffffff", "text": "#0f1419", "handle": "#8a8a8a", "avatar_bg": "#1d9bf0"},
    "dark":  {"bg": "#000000", "text": "#e7e9ea", "handle": "#71767b", "avatar_bg": "#1d9bf0"},
}

FORMATS = {
    "1080x1080": (1080, 1080),  # feed quadrado
    "1080x1350": (1080, 1350),  # feed retrato
    "1080x1920": (1080, 1920),  # story / reel
}


def parse_bold(text: str) -> str:
    """Escapa HTML e converte **word** em <b>word</b> e newlines em <br>."""
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = text.replace("\n", "<br>")
    return text


def avatar_data_uri(path: str) -> str:
    """Le imagem do disco e devolve como data URI base64. Retorna None se nao achar."""
    if not path:
        return None
    p = Path(path).expanduser()
    if not p.exists():
        print(f"AVISO: avatar nao encontrado em {path} — usando inicial estilizada como fallback.", file=sys.stderr)
        return None
    data = p.read_bytes()
    ext = p.suffix.lower().strip(".")
    mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
    mime = mime_map.get(ext, "image/jpeg")
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


def resolve_avatar(arg_avatar: str | None) -> str | None:
    """Resolve qual avatar usar, na ordem: --avatar > TWEET_PRINT_DEFAULT_AVATAR > None."""
    if arg_avatar:
        return arg_avatar
    env_avatar = os.environ.get("TWEET_PRINT_DEFAULT_AVATAR")
    if env_avatar:
        return env_avatar
    return None


def auto_font_size(text: str) -> int:
    """Ajusta o tamanho da fonte conforme o comprimento do texto."""
    n = len(text)
    if n < 60:
        return 64
    if n < 120:
        return 56
    if n < 200:
        return 48
    return 40


def build_html(args, width, height, theme, text_html, avatar_uri, font_size, badge_html):
    """Monta o HTML completo com placeholders substituidos."""
    avatar_html = (
        f'<img class="avatar" src="{avatar_uri}" alt="">'
        if avatar_uri
        else f'<div class="avatar avatar-fallback">{args.name[0].upper()}</div>'
    )
    inner_padding = 80
    content_width = width - (inner_padding * 2)

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Tweet</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  html, body {{
    width: {width}px;
    height: {height}px;
    background: {theme["bg"]};
    font-family: "Inter", -apple-system, "Segoe UI", "Helvetica Neue", system-ui, sans-serif;
    color: {theme["text"]};
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }}
  body {{
    display: flex;
    align-items: center;
    padding: 0 {inner_padding}px;
  }}
  .post {{
    width: {content_width}px;
    max-width: {content_width}px;
    min-width: 0;
  }}
  .header {{
    display: flex;
    align-items: center;
    gap: 24px;
    margin-bottom: 36px;
  }}
  .avatar {{
    width: 120px;
    height: 120px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    background: #ddd;
  }}
  .avatar-fallback {{
    background: linear-gradient(135deg, {theme["avatar_bg"]} 0%, #0a4a6e 100%);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 56px;
    font-weight: 700;
  }}
  .name-block {{ display: flex; flex-direction: column; gap: 4px; }}
  .name-row {{ display: flex; align-items: center; gap: 8px; }}
  .name {{
    font-size: 40px;
    font-weight: 700;
    color: {theme["text"]};
    letter-spacing: -0.7px;
  }}
  .badge {{ width: 32px; height: 32px; }}
  .handle {{
    font-size: 30px;
    color: {theme["handle"]};
    font-style: italic;
    font-weight: 400;
  }}
  .tweet-text {{
    font-size: {font_size}px;
    line-height: 1.2;
    color: {theme["text"]};
    font-weight: 400;
    letter-spacing: -1.5px;
    word-wrap: break-word;
  }}
  .tweet-text b {{ font-weight: 700; }}
</style>
</head>
<body>
<div class="post">
  <div class="header">
    {avatar_html}
    <div class="name-block">
      <div class="name-row">
        <span class="name">{args.name}</span>
        {badge_html}
      </div>
      <span class="handle">{args.handle}</span>
    </div>
  </div>
  <div class="tweet-text">{text_html}</div>
</div>
</body>
</html>"""


def render(html: str, width: int, height: int, output: str):
    """Renderiza o HTML em PNG via Playwright headless."""
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page(viewport={"width": width, "height": height})
            page.set_content(html, wait_until="networkidle")
            page.evaluate("async () => { await document.fonts.ready; }")
            Path(output).parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=output, type="png", full_page=False)
        finally:
            browser.close()


def main():
    parser = argparse.ArgumentParser(
        description="Gera imagem estilo tweet print para Instagram",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    text_group = parser.add_mutually_exclusive_group(required=True)
    text_group.add_argument("--text", help="Texto do tweet (single). Use **word** para negrito.")
    text_group.add_argument("--texts", nargs="+", help="Lista de textos para carrossel. Gera N PNGs numerados (use --output-prefix).")
    parser.add_argument("--name", default="Eric Luciano", help="Nome de exibicao")
    parser.add_argument("--handle", default="@ericluciano", help="Handle (com @)")
    parser.add_argument("--avatar", help="Caminho do arquivo de avatar (jpg/png/webp). Se omitido, usa TWEET_PRINT_DEFAULT_AVATAR ou inicial estilizada.")
    parser.add_argument("--theme", default="light", choices=list(THEMES), help="Tema visual")
    parser.add_argument("--format", default="1080x1080", choices=list(FORMATS), help="Formato/dimensoes")
    parser.add_argument("--no-verified", action="store_true", help="Nao mostrar selo verificado azul")
    parser.add_argument("--font-size", type=int, help="Override do tamanho da fonte do tweet (px)")
    parser.add_argument("--output", default="./tweet-print.png", help="Caminho do PNG de saida (modo single)")
    parser.add_argument("--output-prefix", default="./carrossel", help="Prefixo dos PNGs no modo carrossel (gera prefix-01.png, prefix-02.png, ...)")
    args = parser.parse_args()

    width, height = FORMATS[args.format]
    theme = THEMES[args.theme]
    badge_html = "" if args.no_verified else BADGE_SVG
    avatar_uri = avatar_data_uri(resolve_avatar(args.avatar))

    texts = args.texts if args.texts else [args.text]
    is_carousel = len(texts) > 1

    for idx, text in enumerate(texts, start=1):
        text_html = parse_bold(text)
        font_size = args.font_size or auto_font_size(text)
        html = build_html(args, width, height, theme, text_html, avatar_uri, font_size, badge_html)

        if is_carousel:
            output = f"{args.output_prefix}-{idx:02d}.png"
        else:
            output = args.output

        render(html, width, height, output)
        print(f"OK: {output}")


if __name__ == "__main__":
    main()
