#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_report.py — gera report.html (dark-theme) a partir do research_data.json.

Espera o JSON ja ENRIQUECIDO pelo Claude (campos hook/format/why_it_worked/
visual_notes preenchidos). Funciona mesmo se estiverem vazios (mostra "—").

Uso:
  python build_report.py <run_dir>            # usa <run_dir>/research_data.json
  python build_report.py <caminho/arquivo.json>

As capas (frame_path) sao embutidas em base64 -> HTML e 1 arquivo portatil.
"""
import base64
import html
import json
import mimetypes
import sys
import webbrowser
from pathlib import Path


def b64_img(path):
    try:
        if not path:
            return ""
        p = Path(path)
        if not p.exists():
            return ""
        mime = mimetypes.guess_type(str(p))[0] or "image/jpeg"
        data = base64.b64encode(p.read_bytes()).decode()
        return f"data:{mime};base64,{data}"
    except Exception:
        return ""


def esc(s):
    return html.escape(str(s)) if s is not None else ""


def fmt_num(n):
    if n is None:
        return "—"
    try:
        n = int(n)
    except (ValueError, TypeError):
        return esc(n)
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n/1_000:.1f}K"
    return str(n)


def card(i, p):
    img = b64_img(p.get("frame_path"))
    thumb = (f'<img class="thumb" src="{img}" alt="">' if img
             else '<div class="thumb noimg">sem imagem</div>')
    views = p.get("views")
    metrics = [
        ("Outlier", f'{p.get("outlier_score","—")}x', "outlier"),
        ("Likes", fmt_num(p.get("likes")), ""),
        ("Coment.", fmt_num(p.get("comments")), ""),
    ]
    if views:
        metrics.insert(1, ("Views", fmt_num(views), "views"))
    metric_html = "".join(
        f'<div class="metric {cls}"><span class="mv">{esc(v)}</span><span class="ml">{esc(l)}</span></div>'
        for l, v, cls in metrics
    )
    fmt = p.get("format")
    fmt_badge = f'<span class="badge">{esc(fmt)}</span>' if fmt else ""
    transcript = p.get("transcript") or ""
    transcript_block = ""
    if transcript:
        transcript_block = f"""
        <div class="block">
          <div class="block-head">Transcrição <button class="copy" onclick="cp(this)">copiar</button></div>
          <div class="transcript">{esc(transcript)}</div>
        </div>"""
    hook = p.get("hook")
    why = p.get("why_it_worked")
    visual = p.get("visual_notes")
    caption = p.get("caption") or ""
    # so vira link se a URL for https:// (evita javascript: e afins vindos do scrape)
    url = str(p.get("url") or "")
    if url.startswith("https://"):
        view = f'<a class="view" href="{esc(url)}" target="_blank" rel="noopener">ver no Instagram ↗</a>'
    else:
        view = f'<span class="view">{esc(url)}</span>' if url else ""
    return f"""
    <article class="card">
      <div class="rank">#{i}</div>
      <div class="left">{thumb}
        {view}
      </div>
      <div class="body">
        <div class="head">
          <span class="handle">@{esc(p.get('handle'))}</span>
          {fmt_badge}
          <span class="date">{esc(p.get('posted_at'))}</span>
        </div>
        <div class="metrics">{metric_html}</div>
        {f'<div class="block"><div class="block-head">Hook</div><div class="hook">{esc(hook)}</div></div>' if hook else ''}
        {f'<div class="block"><div class="block-head">Por que funcionou</div><div class="why">{esc(why)}</div></div>' if why else ''}
        {f'<div class="block"><div class="block-head">Leitura visual</div><div class="visual">{esc(visual)}</div></div>' if visual else ''}
        {transcript_block}
        {f'<details class="cap"><summary>Legenda original</summary><div>{esc(caption)}</div></details>' if caption else ''}
      </div>
    </article>"""


def build(data):
    meta = data.get("meta", {})
    posts = data.get("posts", [])
    handles = ", ".join("@" + h for h in meta.get("handles", []))
    cards = "\n".join(card(i, p) for i, p in enumerate(posts, 1))
    return f"""<!doctype html>
<html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>IG Competitor Research — {esc(handles)}</title>
<style>
:root{{--bg:#0b0d12;--card:#141821;--card2:#1b212c;--line:#252c39;--txt:#e7ecf3;--mut:#8b95a7;--cy:#36d1dc;--cyd:#0fb5c2;--gold:#f5b945;--green:#34d399}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--txt);font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}}
.wrap{{max-width:980px;margin:0 auto;padding:40px 22px 80px}}
header h1{{font-size:26px;margin:0 0 6px;letter-spacing:-.4px}}
header .sub{{color:var(--mut);font-size:14px}}
header .pills{{margin-top:14px;display:flex;gap:8px;flex-wrap:wrap}}
.pill{{background:var(--card2);border:1px solid var(--line);border-radius:999px;padding:5px 12px;font-size:12px;color:var(--mut)}}
.pill b{{color:var(--txt)}}
.card{{display:grid;grid-template-columns:200px 1fr;gap:20px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;margin-top:18px;position:relative;overflow:hidden}}
.rank{{position:absolute;top:0;left:0;background:linear-gradient(135deg,var(--cy),var(--cyd));color:#04222a;font-weight:800;font-size:13px;padding:3px 12px;border-radius:0 0 12px 0}}
.left{{display:flex;flex-direction:column;gap:8px}}
.thumb{{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:10px;background:var(--card2);border:1px solid var(--line)}}
.thumb.noimg{{display:flex;align-items:center;justify-content:center;color:var(--mut);font-size:12px}}
.view{{color:var(--cy);font-size:12.5px;text-decoration:none;text-align:center}}
.view:hover{{text-decoration:underline}}
.head{{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:4px 0 10px}}
.handle{{font-weight:700;font-size:16px}}
.date{{color:var(--mut);font-size:12px;margin-left:auto}}
.badge{{background:rgba(54,209,220,.12);color:var(--cy);border:1px solid rgba(54,209,220,.35);border-radius:6px;padding:2px 9px;font-size:12px;font-weight:600}}
.metrics{{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px}}
.metric{{background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:8px 14px;min-width:74px;text-align:center}}
.metric .mv{{display:block;font-weight:800;font-size:18px}}
.metric .ml{{display:block;color:var(--mut);font-size:11px;text-transform:uppercase;letter-spacing:.4px}}
.metric.outlier .mv{{color:var(--gold)}}
.metric.views .mv{{color:var(--green)}}
.block{{margin-top:12px}}
.block-head{{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--mut);margin-bottom:5px;display:flex;align-items:center;gap:8px}}
.hook{{font-size:16px;font-weight:600;color:#fff}}
.why,.visual{{color:#d3dae6}}
.transcript{{background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:13px;color:#c3ccda;max-height:160px;overflow:auto;white-space:pre-wrap}}
.copy{{background:var(--card2);border:1px solid var(--line);color:var(--cy);border-radius:6px;font-size:11px;padding:2px 8px;cursor:pointer}}
.copy:hover{{border-color:var(--cy)}}
.cap{{margin-top:12px;color:var(--mut);font-size:13px}}
.cap summary{{cursor:pointer;color:var(--mut)}}
.cap>div{{margin-top:8px;white-space:pre-wrap;color:#b9c2d0}}
footer{{margin-top:40px;text-align:center;color:var(--mut);font-size:12px}}
@media(max-width:640px){{.card{{grid-template-columns:1fr}}.date{{margin-left:0}}}}
</style></head>
<body><div class="wrap">
<header>
  <h1>Pesquisa de Concorrentes — Instagram</h1>
  <div class="sub">Conteúdo de maior performance dos últimos {esc(meta.get('window_days','?'))} dias</div>
  <div class="pills">
    <span class="pill">Perfis: <b>{esc(handles)}</b></span>
    <span class="pill"><b>{esc(meta.get('picks','?'))}</b> picks de <b>{esc(meta.get('total_recent_posts','?'))}</b> posts</span>
    <span class="pill">Gerado: <b>{esc(meta.get('generated_at',''))}</b></span>
  </div>
</header>
{cards}
<footer>Gerado pela skill ig-competitor-research · Outlier = engajamento ÷ mediana do próprio perfil</footer>
</div>
<script>
function cp(btn){{
  const t=btn.closest('.block').querySelector('.transcript').innerText;
  navigator.clipboard.writeText(t).then(()=>{{const o=btn.innerText;btn.innerText='copiado!';setTimeout(()=>btn.innerText=o,1200);}});
}}
</script>
</body></html>"""


def main():
    if len(sys.argv) < 2:
        print("uso: python build_report.py <run_dir|research_data.json>")
        sys.exit(2)
    arg = Path(sys.argv[1])
    data_path = arg / "research_data.json" if arg.is_dir() else arg
    if not data_path.exists():
        print(f"ERRO: nao encontrei {data_path}")
        sys.exit(2)
    data = json.loads(data_path.read_text(encoding="utf-8"))

    # merge opcional: analysis.json (escrito pelo Claude) -> por shortcode
    analysis_path = data_path.parent / "analysis.json"
    if analysis_path.exists():
        analysis = json.loads(analysis_path.read_text(encoding="utf-8"))
        by_sc = {a.get("shortcode"): a for a in analysis}
        merged = 0
        for p in data.get("posts", []):
            a = by_sc.get(p.get("shortcode"))
            if a:
                for k in ("hook", "format", "why_it_worked", "visual_notes"):
                    if a.get(k):
                        p[k] = a[k]
                merged += 1
        print(f"[merge] analysis.json aplicado em {merged} posts")

    out_path = data_path.parent / "report.html"
    out_path.write_text(build(data), encoding="utf-8")
    print(f"OK -> {out_path}")
    try:
        webbrowser.open(out_path.resolve().as_uri())
    except Exception:
        pass


if __name__ == "__main__":
    main()
