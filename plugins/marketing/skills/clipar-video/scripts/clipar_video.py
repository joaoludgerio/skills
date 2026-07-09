#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
clipar_video.py — pipeline estilo Opus Clip
Fases: transcricao | analise | cortar | tudo (default)
"""

import io
import sys
# forçar UTF-8 no stdout do Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import argparse
import json
import math
import os
import re
import subprocess
from pathlib import Path

# ─── deps opcionais ───────────────────────────────────────────────────────────
try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False

try:
    import cv2
    import numpy as np
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False


# ─── helpers de tempo ─────────────────────────────────────────────────────────

def seg_to_hhmmss(s: float) -> str:
    # Em ms inteiros: arredondar a fracao isolada gerava "00:59:60,000" (SRT invalido).
    total_ms = round(s * 1000)
    h, r = divmod(total_ms, 3_600_000)
    m, r = divmod(r, 60_000)
    sec, ms = divmod(r, 1000)
    return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"


def run_ffmpeg(cmd: list):
    """Roda ffmpeg/ffprobe capturando a saida; em erro, mostra o fim do stderr (legivel)."""
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"❌ {Path(cmd[0]).name} falhou:\n{r.stderr[-800:]}")
    return r


def seg_to_mmss(s: float) -> str:
    m = int(s // 60)
    sec = int(s % 60)
    return f"{m}:{sec:02d}"


def slug(text: str, max_chars: int = 40) -> str:
    t = re.sub(r"[^\w\s-]", "", text.lower())
    t = re.sub(r"[\s_]+", "-", t).strip("-")
    return t[:max_chars]


def _localizar_out_dir_existente(video: Path) -> "Path | None":
    """Localiza a pasta de saida mais recente do mesmo video (padrao clipes-<nome>-<timestamp>)
    dentro de Downloads. Usada como fallback quando --out-dir nao foi passado nas fases
    analise/cortar, para nao criar uma pasta nova (o que faria a fase seguinte nao achar
    transcript.json / clips_selecionados.json da fase anterior)."""
    downloads = Path.home() / "Downloads"
    padrao = f"clipes-{slug(video.stem, 30)}-*"
    candidatos = [p for p in downloads.glob(padrao) if p.is_dir()]
    if not candidatos:
        return None
    candidatos.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return candidatos[0]


# ─── FASE 1 — transcrição via OpenAI Whisper API ─────────────────────────────

def _load_openai_key() -> str:
    key = os.environ.get("OPENAI_API_KEY", "")
    if key:
        return key
    for p in ["C:/MCPs/openai.env", "C:/MCPs/.env", str(Path.home() / ".config/openai.env")]:
        try:
            for line in Path(p).read_text().splitlines():
                if line.startswith("OPENAI_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"')
        except Exception:
            pass
    sys.exit("OPENAI_API_KEY nao encontrada. Exporte a variavel ou coloque em C:/MCPs/openai.env")


def _transcrever_chunk(client, chunk_path: Path, offset: float) -> tuple[list, list]:
    """Transcreve um chunk e retorna (words, segments) com timestamps ajustados pelo offset."""
    with open(chunk_path, "rb") as f:
        result = client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            language="pt",
            response_format="verbose_json",
            timestamp_granularities=["word", "segment"],
        )
    words = []
    for w in (result.words or []):
        words.append({
            "word": w.word,
            "start": round(w.start + offset, 3),
            "end": round(w.end + offset, 3),
        })
    segments = []
    for s in (result.segments or []):
        segments.append({
            "start": round(s.start + offset, 3),
            "end": round(s.end + offset, 3),
            "text": s.text.strip(),
        })
    return words, segments


def fase_transcricao(video: Path, out_dir: Path, model_name: str = "medium") -> dict:
    json_path = out_dir / "transcript.json"
    if json_path.exists():
        print(f"Transcricao ja existe: {json_path}", flush=True)
        return json.loads(json_path.read_text(encoding="utf-8"))

    # A API do Whisper aceita arquivos de ate 25MB. Videos de podcast sao maiores,
    # entao extraimos o audio e dividimos em chunks de ~20 minutos.
    try:
        from openai import OpenAI
    except ImportError:
        sys.exit("Instale openai: pip install openai")

    api_key = _load_openai_key()
    client = OpenAI(api_key=api_key)

    # 1. Extrair audio em mp3 (muito menor que o video original)
    audio_path = out_dir / "audio_completo.mp3"
    if not audio_path.exists():
        print("Extraindo audio do video (FFmpeg)...", flush=True)
        run_ffmpeg([
            "ffmpeg", "-y", "-i", str(video),
            "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k",
            str(audio_path),
        ])
        size_mb = audio_path.stat().st_size / 1024 / 1024
        print(f"Audio extraido: {size_mb:.1f} MB", flush=True)

    # 2. Dividir em chunks de 20 min se necessario
    probe = run_ffmpeg(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)],
    )
    total_dur = float(probe.stdout.strip())
    chunk_sec = 20 * 60  # 20 minutos por chunk
    n_chunks = math.ceil(total_dur / chunk_sec)

    chunks_dir = out_dir / "chunks"
    chunks_dir.mkdir(exist_ok=True)

    all_words: list = []
    all_segments: list = []

    for i in range(n_chunks):
        offset = i * chunk_sec
        chunk_path = chunks_dir / f"chunk_{i:02d}.mp3"

        if not chunk_path.exists():
            dur = min(chunk_sec, total_dur - offset)
            run_ffmpeg([
                "ffmpeg", "-y", "-ss", str(offset), "-t", str(dur),
                "-i", str(audio_path), "-c", "copy", str(chunk_path),
            ])

        size_mb = chunk_path.stat().st_size / 1024 / 1024
        print(f"Transcrevendo chunk {i+1}/{n_chunks} ({seg_to_mmss(offset)} - {seg_to_mmss(offset+chunk_sec)}, {size_mb:.1f}MB)...", flush=True)

        w, s = _transcrever_chunk(client, chunk_path, offset)
        all_words.extend(w)
        all_segments.extend(s)
        print(f"  -> {len(s)} segmentos transcritos", flush=True)

    full_text = " ".join(s["text"] for s in all_segments)
    data = {
        "video": str(video),
        "duration": total_dur,
        "text": full_text,
        "words": all_words,
        "segments": all_segments,
    }

    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Transcricao salva: {json_path}  ({len(all_words)} palavras, {seg_to_mmss(total_dur)} de video)", flush=True)
    return data


# ─── FASE 2 — análise Claude ──────────────────────────────────────────────────

PROMPT_ANALISE = """Você é um especialista em vídeos virais para Instagram Reels, TikTok e YouTube Shorts.

Abaixo está a transcrição completa de um vídeo longo (podcast/gravação) com timestamps de cada segmento.
Sua tarefa: identificar os {n_clips} melhores trechos para virar clipes virais de {duracao}s cada.

FORMATO DA TRANSCRIÇÃO:
[MM:SS] texto do segmento

CRITÉRIOS DE SELEÇÃO (em ordem de importância):
1. Hook forte nos primeiros 3-5 segundos (frase que prende atenção imediatamente)
2. Narrativa auto-contida (o trecho faz sentido sem assistir o resto do vídeo)
3. Momento de insight, revelação ou dado surpreendente
4. Mudança emocional clara (problema → solução, ou expectativa → realidade)
5. Ausência de referências a "o que falei antes" ou "como vou mostrar depois"

PENALIDADES:
- Trechos com muito silêncio ou hesitação ("hum", "ã", "então...")
- Referências a slides/tela que o espectador não vai ver
- Dependência de contexto anterior para fazer sentido
- Início com "como eu disse..." ou "voltando ao..."

TRANSCRIÇÃO:
{transcricao}

Responda APENAS com JSON válido neste formato exato (sem markdown, sem explicação):
{{
  "clips": [
    {{
      "rank": 1,
      "start": 123.4,
      "end": 183.4,
      "titulo": "Título curto do clipe (max 60 chars)",
      "hook": "Primeira frase exata que abre o clipe (o hook)",
      "motivo": "Por que esse trecho é viral (1 linha)",
      "score": 9.2
    }}
  ]
}}

REGRAS:
- start e end são em SEGUNDOS (float)
- A duração de cada clipe deve ser próxima de {duracao}s (±15s de variação é ok)
- Os clipes NÃO podem se sobrepor
- Ordene por score (maior primeiro)
- score de 0.0 a 10.0
- "titulo" e "hook" NUNCA usam travessão (—): use vírgula, dois pontos ou parênteses
"""

def fase_analise(out_dir: Path, n_clips: int, duracao: int) -> list:
    if not HAS_ANTHROPIC:
        sys.exit("❌ anthropic não instalado: pip install anthropic")

    json_path = out_dir / "transcript.json"
    if not json_path.exists():
        sys.exit("❌ Transcrição não encontrada. Rode a fase 'transcricao' primeiro.")

    # Cache da análise só vale se os parâmetros forem os mesmos do run anterior.
    clips_path = out_dir / "clips_selecionados.json"
    params_path = out_dir / "analise_params.json"
    params = {"clips": n_clips, "duracao": duracao}
    if clips_path.exists():
        try:
            saved = json.loads(params_path.read_text(encoding="utf-8"))
        except Exception:
            saved = None
        if saved == params:
            print(f"✅ Análise já existe: {clips_path}")
            return json.loads(clips_path.read_text(encoding="utf-8"))
        print("⚠️  Parâmetros mudaram desde a última análise, reanalisando...")

    data = json.loads(json_path.read_text(encoding="utf-8"))

    # Montar transcrição formatada com timestamps por segmento
    linhas = []
    for seg in data["segments"]:
        ts = seg_to_mmss(seg["start"])
        linhas.append(f"[{ts}] {seg['text']}")
    transcricao = "\n".join(linhas)

    print(f"🤖 Analisando transcrição com Claude ({len(data['segments'])} segmentos)...")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        # tenta ler do .env
        env_paths = [
            Path.home() / ".config" / "anthropic.env",
            Path("C:/MCPs/anthropic.env"),
            Path("C:/MCPs/.env"),
        ]
        for p in env_paths:
            if p.exists():
                for line in p.read_text().splitlines():
                    if line.startswith("ANTHROPIC_API_KEY="):
                        api_key = line.split("=", 1)[1].strip().strip('"')
                        break
            if api_key:
                break
    if not api_key:
        sys.exit("❌ ANTHROPIC_API_KEY não encontrada (ambiente ou C:/MCPs/anthropic.env).")

    client = anthropic.Anthropic(api_key=api_key)

    prompt = PROMPT_ANALISE.format(
        n_clips=n_clips,
        duracao=duracao,
        transcricao=transcricao,
    )

    msg = client.messages.create(
        # atualizar aqui quando trocar de modelo (nao ha outra referencia hardcoded no script)
        model="claude-sonnet-5",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    # modelos com extended thinking devolvem blocos de thinking ANTES do texto;
    # pegar o primeiro bloco de texto de verdade em vez de assumir content[0]
    raw = next(
        (b.text for b in msg.content if getattr(b, "type", "") == "text"), None
    )
    if raw is None:
        sys.exit("❌ Resposta da API sem bloco de texto (só thinking?). Rodar de novo.")
    raw = raw.strip()

    # limpar markdown se vier
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"```\s*$", "", raw)

    try:
        result = json.loads(raw)
        clips = result["clips"]
    except Exception as e:
        print(f"❌ Erro ao parsear resposta Claude: {e}")
        print("Resposta raw:", raw[:500])
        sys.exit(1)

    # ajustar end para não ultrapassar duração total + descartar curtos de verdade
    total = data["duration"]
    validos = []
    for c in clips:
        c["end"] = min(c["end"], total)
        if c["end"] - c["start"] < 10:
            print(f"⚠️  Clipe #{c['rank']} muito curto ({c['end']-c['start']:.0f}s), descartado")
            continue
        validos.append(c)

    # resolver sobreposição: mantém o de maior score entre os que se intersectam
    escolhidos = []
    for c in sorted(validos, key=lambda c: -c.get("score", 0)):
        if any(c["start"] < e["end"] and e["start"] < c["end"] for e in escolhidos):
            print(f"⚠️  Clipe #{c['rank']} sobrepõe outro de score maior, descartado")
            continue
        escolhidos.append(c)
    clips = sorted(escolhidos, key=lambda c: c["rank"])

    clips_path.write_text(json.dumps(clips, ensure_ascii=False, indent=2), encoding="utf-8")
    params_path.write_text(json.dumps(params), encoding="utf-8")

    # imprimir tabela
    print("\n" + "=" * 70)
    print("CLIPES ENCONTRADOS")
    print("=" * 70)
    print(f"{'#':<3} {'Início':<7} {'Fim':<7} {'Dur':<5} {'Score':<6} Hook")
    print("-" * 70)
    for c in clips:
        dur = c["end"] - c["start"]
        hook_trunc = c["hook"][:50] + ("..." if len(c["hook"]) > 50 else "")
        print(f"{c['rank']:<3} {seg_to_mmss(c['start']):<7} {seg_to_mmss(c['end']):<7} {dur:.0f}s   {c['score']:<6} {hook_trunc}")
    print("=" * 70)

    return clips


# ─── FASE 3 — cortar + legenda + reencadre ────────────────────────────────────

# ─── Glossário de ASR (portado da skill gerar-srt, manter os dois em sincronia) ──
# Correções de alta confiança: erros que o Whisper comete de forma consistente no
# nicho do Eric. Substituição por palavra inteira, case-insensitive.
CORRECTIONS = [
    (r"\bclaud[ie]?\b", "Claude"),   # "claudi"/"claude"/"claud" -> Claude
    (r"\bcl[áa]udi?o\b", "Claude"),  # "Cláudio" -> Claude (ASR ouve nome próprio)
    (r"\bi[áà]\b", "IA"),            # "iá" -> IA (com acento nunca é o verbo "ia")
    (r"\bchat\s*gpt\b", "ChatGPT"),
    (r"\bgit\s*hub\b", "GitHub"),
    (r"\byou\s*tube\b", "YouTube"),
    (r"\blinked\s*in\b", "LinkedIn"),
    (r"\bm\.?c\.?p\b", "MCP"),
    (r"\bpdf\b", "PDF"),
    (r"\bapi\b", "API"),
]
# Termos que dependem de contexto: NÃO corrigir automático, só sinalizar no manifest
# ("cloud" quase sempre é "Claude" na fala do Eric, mas "Google Cloud" é legítimo).
REVIEW_TERMS = ["cloud", "clod", "markdown", "markitdown", "mark it down", "fable", "opus",
                "anthropic", "expert integrado", "nano banana", "kling"]

APLICAR_GLOSSARIO = True  # desligável via --sem-glossario


def corrigir_texto(texto: str) -> str:
    if not APLICAR_GLOSSARIO:
        return texto
    for pat, repl in CORRECTIONS:
        texto = re.sub(pat, repl, texto, flags=re.IGNORECASE)
    return texto


def termos_pra_revisar(texto_srt: str) -> list:
    baixo = texto_srt.lower()
    return sorted({t for t in REVIEW_TERMS if t in baixo})


def gerar_srt_para_clip(words: list, start: float, end: float, max_words: int = 4) -> str:
    """Gera SRT word-by-word relativo ao início do clipe."""
    # criterio de SOBREPOSICAO: palavra que comeca um tico antes do start (o corte
    # cai no meio da fala com frequencia) entra; palavra alem do fim do video, nao.
    clip_words = [w for w in words if w["end"] > start and w["start"] < end]

    linhas_srt = []
    grupos = []
    grupo_atual = []

    for w in clip_words:
        grupo_atual.append(w)
        if len(grupo_atual) >= max_words:
            grupos.append(grupo_atual)
            grupo_atual = []
    if grupo_atual:
        grupos.append(grupo_atual)

    n = 0
    for grupo in grupos:
        t_start = max(grupo[0]["start"] - start, 0.0)
        t_end = min(grupo[-1]["end"] - start, end - start)  # clamp: video acaba em end
        if t_end <= t_start:
            continue
        n += 1
        texto = corrigir_texto(" ".join(w["word"].strip() for w in grupo))
        linhas_srt.append(f"{n}")
        linhas_srt.append(f"{seg_to_hhmmss(t_start)} --> {seg_to_hhmmss(t_end)}")
        linhas_srt.append(texto)
        linhas_srt.append("")

    return "\n".join(linhas_srt)


def _detectar_faces_frame(gray, det_frontal, det_profile):
    """Detecta faces num frame usando cascatas frontal + perfil (perfil nos dois sentidos).
    Retorna lista de (x, y, w, h)."""
    faces = list(det_frontal.detectMultiScale(gray, 1.1, 5, minSize=(50, 50)))
    if not faces:
        faces = list(det_profile.detectMultiScale(gray, 1.1, 5, minSize=(50, 50)))
    if not faces:
        # perfil olhando pro outro lado = espelhar a imagem
        flipped = cv2.flip(gray, 1)
        w_frame = gray.shape[1]
        for (x, y, fw, fh) in det_profile.detectMultiScale(flipped, 1.1, 5, minSize=(50, 50)):
            faces.append((w_frame - x - fw, y, fw, fh))
    return faces


def detectar_letterbox(video_path: Path, start: float, end: float) -> tuple:
    """Detecta barras pretas (letterbox cinematografico) medindo luminancia por linha.
    Retorna (y0, altura_util). Se nao ha letterbox, retorna (0, altura_total)."""
    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    dur = end - start
    acc = None
    for off in [dur * (i + 1) / 6 for i in range(5)]:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int((start + off) * fps))
        ret, f = cap.read()
        if not ret:
            continue
        rm = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).mean(axis=1)
        acc = rm if acc is None else np.maximum(acc, rm)
    cap.release()
    if acc is None:
        return (0, 0)
    h = len(acc)
    thr = 8
    top = next((i for i in range(h) if acc[i] > thr), 0)
    bot = next((i for i in range(h - 1, -1, -1) if acc[i] > thr), h - 1)
    # so trata como letterbox se as barras forem significativas (> 1.5% da altura)
    if top < h * 0.015 and (h - 1 - bot) < h * 0.015:
        return (0, h)
    return (top, bot - top + 1)


def _detectar_corpo_x(frames: list) -> float | None:
    """Fallback pra plano aberto: detector de pessoa (HOG) sobre os frames amostrados.
    O Haar de rosto falha quando a pessoa aparece pequena/de lado na camera aberta,
    mas o corpo inteiro visivel e' exatamente o caso bom do HOG."""
    try:
        hog = cv2.HOGDescriptor()
        hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
        posicoes = []
        for frame in frames:
            h, w = frame.shape[:2]
            escala = 640.0 / w
            small = cv2.resize(frame, (640, max(1, int(h * escala))))
            rects, weights = hog.detectMultiScale(
                small, winStride=(8, 8), padding=(8, 8), scale=1.05)
            if len(rects) == 0:
                continue
            melhor = max(range(len(rects)), key=lambda i: float(weights[i]))
            x, _, rw, _ = rects[melhor]
            posicoes.append((x + rw / 2) / 640.0)
        if len(posicoes) < 2:
            return None
        posicoes.sort()
        return posicoes[len(posicoes) // 2]
    except Exception:
        return None


def detectar_face_x(video_path: Path, start: float, end: float,
                    y0: int = 0, ch: int = 0) -> float | None:
    """Amostra varios frames no intervalo [start,end] e retorna a MEDIANA da posicao X
    normalizada (0.0 a 1.0) da pessoa, DENTRO da area util [y0, y0+ch] (sem letterbox).

    Ordem de confianca: rosto com bastante hit > corpo (HOG) > rosto com pouco hit.
    Rosto com POUCOS hits nos samples e' tratado como suspeito (em plano aberto o Haar
    gera falso positivo em tela/cenario e o corte central acaba enquadrando a mesa):
    nesse caso a deteccao de corpo decide."""
    if not HAS_CV2:
        return None
    try:
        cap = cv2.VideoCapture(str(video_path))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        hc = cv2.data.haarcascades
        det_frontal = cv2.CascadeClassifier(hc + "haarcascade_frontalface_default.xml")
        det_profile = cv2.CascadeClassifier(hc + "haarcascade_profileface.xml")

        dur = end - start
        n_samples = 11
        offsets = [dur * (i + 1) / (n_samples + 1) for i in range(n_samples)]

        posicoes = []
        frames = []
        for off in offsets:
            frame_target = int((start + off) * fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_target)
            ret, frame = cap.read()
            if not ret:
                continue
            w_frame = frame.shape[1]
            if ch > 0:
                frame = frame[y0:y0 + ch, :]
            frames.append(frame)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = _detectar_faces_frame(gray, det_frontal, det_profile)
            if not faces:
                continue
            x, _, fw, _ = max(faces, key=lambda f: f[2] * f[3])
            posicoes.append((x + fw / 2) / w_frame)

        cap.release()

        # Rosto consistente (metade+ dos samples): confiavel, usa.
        if len(posicoes) >= max(3, len(frames) // 2):
            posicoes.sort()
            return posicoes[len(posicoes) // 2]

        # Rosto raro ou ausente: provavel plano aberto; corpo decide.
        corpo = _detectar_corpo_x(frames)
        if corpo is not None:
            print("   🧍 plano sem rosto confiável: enquadrando pela detecção de corpo")
            return corpo

        if posicoes:
            posicoes.sort()
            return posicoes[len(posicoes) // 2]
        return None
    except Exception:
        return None


def detectar_cenas(video_path: Path, start: float, end: float, threshold: float = 0.15) -> list:
    """Retorna os tempos (segundos, relativos a start) onde ha corte de cena no intervalo."""
    try:
        out = subprocess.run(
            ["ffmpeg", "-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", str(video_path),
             "-an", "-vf", f"select='gt(scene,{threshold})',showinfo", "-f", "null", "-"],
            capture_output=True, text=True,
        ).stderr
        return [float(m.group(1)) for m in re.finditer(r"pts_time:([0-9.]+)", out)]
    except Exception:
        return []


def _xoff(face_x, w, target_w):
    if face_x is not None:
        cx = int(face_x * w)
        return max(0, min(cx - target_w // 2, w - target_w))
    return (w - target_w) // 2


def _xoff_manual(crop_side: str, w: int, target_w: int) -> int:
    """Offset X quando o usuario forca o lado do crop (sem deteccao de face).
    'esquerda' mostra a metade esquerda do frame, 'direita' a metade direita."""
    if crop_side == "esquerda":
        return 0
    if crop_side == "direita":
        return w - target_w
    return (w - target_w) // 2


def reframe_9x16(video: Path, start: float, end: float, out_path: Path, crop_side: str = "auto"):
    """Reenquadra o trecho [start,end] do SOURCE pra 9:16 preenchendo a tela:
    1. Remove letterbox cinematografico (barras pretas).
    2. Detecta cortes de camera e reenquadra CADA plano centralizando no rosto daquele plano
       (a menos que crop_side seja 'esquerda' ou 'direita', que forca o mesmo lado em todo o clipe
       e pula a deteccao de face, para o caso de pessoa na lateral / podcast com 2 pessoas).
    Corta direto do source com seek preciso (re-encode) — sem desync de keyframe."""
    probe = run_ffmpeg(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "json", str(video)],
    )
    info = json.loads(probe.stdout)["streams"][0]
    w, h = info["width"], info["height"]

    # 1. Letterbox
    y0, ch = (0, h)
    if HAS_CV2:
        y0, ch = detectar_letterbox(video, start, end)
        if ch == 0:
            y0, ch = 0, h
    if y0 > 0 or ch < h:
        print(f"   ✂️  Letterbox removido: {y0}px topo, area util {w}x{ch}")

    enc = ["-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "18",
           "-c:a", "aac", "-b:a", "160k"]

    # Fonte (apos remover letterbox) mais alta que 9:16 → crop vertical face-aware.
    target_w = int(round(ch * 9 / 16))

    # Fonte ja mais estreita que 9:16 (raro): preenche com scale+crop
    if target_w >= w:
        run_ffmpeg([
            "ffmpeg", "-y", "-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", str(video),
            "-map", "0:v:0", "-map", "0:a:0?", "-dn", "-write_tmcd", "0",
            "-vf", f"crop={w}:{ch}:0:{y0},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
            *enc, str(out_path),
        ])
        return

    dur = end - start
    cortes = [c for c in detectar_cenas(video, start, end) if 0.5 < c < dur - 0.5]
    bounds = sorted(set([0.0] + cortes + [dur]))
    shots = list(zip(bounds[:-1], bounds[1:]))

    def crop_vf(x_off):
        return f"crop={target_w}:{ch}:{x_off}:{y0},scale=1080:1920"

    # Um plano so
    if len(shots) <= 1:
        if crop_side != "auto":
            x_off = _xoff_manual(crop_side, w, target_w)
        else:
            x_off = _xoff(detectar_face_x(video, start, end, y0, ch), w, target_w)
        run_ffmpeg([
            "ffmpeg", "-y", "-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", str(video),
            "-map", "0:v:0", "-map", "0:a:0?", "-dn", "-write_tmcd", "0",
            "-vf", crop_vf(x_off), *enc, str(out_path),
        ])
        return

    # Varios planos: reenquadra cada um centralizando no rosto e concatena
    print(f"   🎥 {len(shots)} planos detectados, reenquadrando cada um...")
    seg_dir = out_path.parent / "shots"
    seg_dir.mkdir(exist_ok=True)

    # Plano sem rosto detectado NAO cai pro corte central (numa camera aberta o
    # centro costuma ser a mesa/cenario, nao a pessoa): herda o enquadre do plano
    # vizinho mais proximo que TEM rosto. Central so se nenhum plano tiver rosto.
    if crop_side != "auto":
        offsets_x = [_xoff_manual(crop_side, w, target_w)] * len(shots)
    else:
        faces = [detectar_face_x(video, start + s0, start + s1, y0, ch)
                 for s0, s1 in shots]
        com_rosto = [i for i, f in enumerate(faces) if f is not None]
        sem_rosto = [i for i, f in enumerate(faces) if f is None]
        if sem_rosto and com_rosto:
            for i in sem_rosto:
                vizinho = min(com_rosto, key=lambda j: abs(j - i))
                faces[i] = faces[vizinho]
            print(f"   👤 {len(sem_rosto)} plano(s) sem rosto herdaram o enquadre do plano vizinho")
        offsets_x = [_xoff(f, w, target_w) for f in faces]

    parts = []
    for i, (s0, s1) in enumerate(shots):
        x_off = offsets_x[i]
        part = seg_dir / f"shot_{i:02d}.mp4"
        run_ffmpeg([
            "ffmpeg", "-y", "-ss", f"{start + s0:.3f}", "-to", f"{start + s1:.3f}", "-i", str(video),
            "-map", "0:v:0", "-map", "0:a:0?", "-dn", "-write_tmcd", "0",
            "-vf", crop_vf(x_off), *enc, str(part),
        ])
        parts.append(part)

    lista = seg_dir / "concat.txt"
    lista.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
    run_ffmpeg([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lista),
        "-c", "copy", str(out_path),
    ])
    for p in parts:
        p.unlink(missing_ok=True)
    lista.unlink(missing_ok=True)
    seg_dir.rmdir()


# Estilos de legenda queimada (force_style do filtro subtitles; cores em &HAABBGGRR).
# "eric" = amarelo oficial dos Reels do perfil (&H0000E6FF, mesmo valor do compose_reel
# do criar-reel), negrito, contorno preto mais grosso. Posição continua embaixo-centro:
# a posição alta acima da cabeça é da composição com avatar, não serve pra corte cru.
ESTILOS_LEGENDA = {
    "padrao": (
        "FontName=Arial,FontSize=18,Bold=1,"
        "PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,"
        "BorderStyle=3,Outline=2,Shadow=0,"
        "Alignment=2,MarginV=50"
    ),
    "eric": (
        "FontName=Arial,FontSize=18,Bold=1,"
        "PrimaryColour=&H0000E6FF,SecondaryColour=&H0000E6FF,OutlineColour=&H00000000,"
        "BorderStyle=1,Outline=3,Shadow=0,"
        "Alignment=2,MarginV=60"
    ),
}


def cortar_clip(
    video: Path,
    clip: dict,
    out_dir: Path,
    transcript: dict,
    formato: str,
    queimar_legenda: bool,
    idx: int,
    crop_side: str = "auto",
    estilo_legenda: str = "padrao",
):
    start = clip["start"]
    end = clip["end"]
    dur = end - start
    nome_slug = slug(clip.get("titulo", f"clip-{idx:02d}"))
    clip_nome = f"clip-{idx:02d}-{nome_slug}"

    clip_dir = out_dir / clip_nome
    clip_dir.mkdir(exist_ok=True)

    print(f"\n✂️  Cortando clipe {idx}: {seg_to_mmss(start)} → {seg_to_mmss(end)} ({dur:.0f}s)")

    # ── Reenquadre (9:16 face-aware por plano, ou 16:9 corte reto)
    reencadrado = clip_dir / "reencadrado.mp4"
    # Retry de um clipe (final apagado) NUNCA reaproveita reenquadre velho: ele pode
    # ter sido gerado por uma versao anterior da logica de enquadre.
    if reencadrado.exists() and not (out_dir / f"{clip_nome}.mp4").exists():
        reencadrado.unlink()
        print("   ♻️  Reenquadre antigo descartado: refazendo com a lógica atual")
    if not reencadrado.exists() and formato == "9:16":
        print(f"   📐 Reenquadrando para 9:16...")
        reframe_9x16(video, start, end, reencadrado, crop_side=crop_side)
    elif not reencadrado.exists():
        # 16:9 — corta do source com seek preciso (re-encode), remove faixa data
        subprocess.run([
            "ffmpeg", "-y", "-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", str(video),
            "-map", "0:v:0", "-map", "0:a:0?", "-dn", "-write_tmcd", "0",
            "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "18",
            "-c:a", "aac", "-b:a", "160k",
            str(reencadrado),
        ], check=True, capture_output=True)
    else:
        print(f"✅ Clipe {idx} reencadrado já existe.")

    # ── 3. SRT
    srt_path = out_dir / f"{clip_nome}.srt"
    if not srt_path.exists():
        srt = gerar_srt_para_clip(transcript["words"], start, end)
        srt_path.write_text(srt, encoding="utf-8")
        print(f"   📝 SRT gerado: {srt_path.name}")
    revisar = termos_pra_revisar(srt_path.read_text(encoding="utf-8"))
    if revisar:
        print(f"   ⚠️  Termos pra conferir no SRT (contexto decide): {', '.join(revisar)}")

    # ── 4. Queimar legenda
    final = out_dir / f"{clip_nome}.mp4"
    if not final.exists():
        if queimar_legenda:
            print(f"   🔤 Queimando legenda...")
            # escape do path pra FFmpeg no Windows
            srt_escaped = str(srt_path).replace("\\", "/").replace(":", "\\:")
            estilo = ESTILOS_LEGENDA.get(estilo_legenda, ESTILOS_LEGENDA["padrao"])
            vf_legenda = f"subtitles='{srt_escaped}':force_style='{estilo}'"
            run_ffmpeg([
                "ffmpeg", "-y", "-i", str(reencadrado),
                "-map", "0:v:0", "-map", "0:a:0?", "-dn", "-write_tmcd", "0",
                "-vf", vf_legenda,
                "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "18",
                "-c:a", "aac", "-b:a", "160k",
                str(final),
            ])
        else:
            # Sem legenda: re-encode mesmo assim pra garantir 8-bit compativel (origem pode ser 10-bit)
            run_ffmpeg([
                "ffmpeg", "-y", "-i", str(reencadrado),
                "-map", "0:v:0", "-map", "0:a:0?", "-dn", "-write_tmcd", "0",
                "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "18",
                "-c:a", "aac", "-b:a", "160k",
                str(final),
            ])

        # limpar intermediários
        reencadrado.unlink(missing_ok=True)
        clip_dir.rmdir() if not any(clip_dir.iterdir()) else None
        print(f"   ✅ {final.name}")
    else:
        print(f"✅ Clipe {idx} final já existe: {final.name}")

    return final, revisar


def fase_cortar(video: Path, out_dir: Path, formato: str, queimar_legenda: bool,
                crop_side: str = "auto", estilo_legenda: str = "padrao"):
    clips_path = out_dir / "clips_selecionados.json"
    if not clips_path.exists():
        sys.exit("❌ clips_selecionados.json não encontrado. Rode a fase 'analise' primeiro.")

    transcript_path = out_dir / "transcript.json"
    if not transcript_path.exists():
        sys.exit("❌ transcript.json não encontrado. Rode a fase 'transcricao' primeiro.")

    clips = json.loads(clips_path.read_text(encoding="utf-8"))
    transcript = json.loads(transcript_path.read_text(encoding="utf-8"))

    print(f"\n🎬 Cortando {len(clips)} clipes...")
    finais = []
    avisos = []
    for i, clip in enumerate(clips, 1):
        f, revisar = cortar_clip(video, clip, out_dir, transcript, formato, queimar_legenda, i,
                                 crop_side=crop_side, estilo_legenda=estilo_legenda)
        finais.append(f)
        avisos.append(revisar)

    print("\n" + "=" * 60)
    print("CLIPES PRONTOS")
    print("=" * 60)
    print(f"📁 {out_dir}")
    for c, f in zip(clips, finais):
        dur = c["end"] - c["start"]
        print(f"  ✅ {f.name}  ({dur:.0f}s | {formato} | score {c['score']})")
    print("=" * 60)

    escrever_manifest(video, out_dir, clips, finais, avisos, formato, estilo_legenda)


def escrever_manifest(video: Path, out_dir: Path, clips: list, finais: list,
                      avisos: list, formato: str, estilo_legenda: str):
    """Manifest de revisão: substitui o checkpoint humano no modo automático."""
    linhas = [
        f"# Manifest: {video.name}",
        "",
        f"Gerado pelo clipar-video em {__import__('datetime').datetime.now().strftime('%d/%m/%Y %H:%M')}. "
        f"Formato {formato}, legenda estilo \"{estilo_legenda}\", glossário de ASR "
        f"{'aplicado' if APLICAR_GLOSSARIO else 'DESLIGADO'}.",
        "",
        "Revisar aqui em vez de assistir tudo: score alto primeiro, conferir os termos sinalizados, "
        "e publicar via Reels de teste (regra: aba Eric do mini-site da linha editorial).",
        "",
        "| # | Arquivo | Trecho | Duração | Score | Hook |",
        "|---|---------|--------|---------|-------|------|",
    ]
    for i, (c, f) in enumerate(zip(clips, finais), 1):
        dur = c["end"] - c["start"]
        hook = str(c.get("hook", "")).replace("|", "/")
        linhas.append(
            f"| {i} | {f.name} | {seg_to_mmss(c['start'])} a {seg_to_mmss(c['end'])} "
            f"| {dur:.0f}s | {c.get('score', '?')} | {hook} |"
        )
    com_aviso = [(i, rev) for i, rev in enumerate(avisos, 1) if rev]
    linhas.append("")
    if com_aviso:
        linhas.append("## Termos pra conferir no SRT (o contexto decide, ex.: cloud vs Claude)")
        for i, rev in com_aviso:
            linhas.append(f"- Clipe {i}: {', '.join(rev)}")
    else:
        linhas.append("Nenhum termo de revisão sinalizado nos SRTs.")
    linhas.append("")
    linhas.append("## Legendas de post")
    linhas.append("Arquivos clip-NN-legenda-post.md nesta pasta (gerados pela skill no modo automático); "
                  "se não existirem, pedir ao Claude: \"gera as legendas de post do manifest\".")
    manifest = out_dir / "manifest.md"
    manifest.write_text("\n".join(linhas) + "\n", encoding="utf-8")
    print(f"📋 Manifest de revisão salvo: {manifest}")


# ─── CLI ──────────────────────────────────────────────────────────────────────

def _dur_minutos(video: Path) -> float:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(video)],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        return float(out) / 60.0
    except Exception:
        return 0.0


def processar_video(video: Path, args, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"📂 Pasta de saída: {out_dir}")

    queimar = not args.sem_legenda

    if args.fase in ("transcricao", "tudo"):
        fase_transcricao(video, out_dir)

    if args.fase in ("analise", "tudo"):
        fase_analise(out_dir, n_clips=args.clips, duracao=args.duracao)

    if args.fase in ("cortar", "tudo"):
        fase_cortar(video, out_dir, formato=args.formato, queimar_legenda=queimar,
                    crop_side=args.crop_side, estilo_legenda=args.estilo_legenda)


def main():
    ap = argparse.ArgumentParser(description="Clipar vídeo longo em clipes virais")
    ap.add_argument("--video", default=None, help="Um vídeo específico (ou use --batch)")
    ap.add_argument("--batch", default=None,
                    help="Pasta com vários vídeos (.mp4/.mov/.mkv): processa todos em fila, "
                         "sempre com --fase tudo, uma pasta de saída por vídeo")
    ap.add_argument("--duracao", type=int, default=60, help="Duração alvo dos clipes em segundos")
    ap.add_argument("--clips", type=int, default=5, help="Número de clipes a extrair")
    ap.add_argument("--formato", default="9:16", choices=["9:16", "16:9"])
    ap.add_argument("--sem-legenda", action="store_true")
    ap.add_argument("--fase", default="tudo", choices=["transcricao", "analise", "cortar", "tudo"])
    ap.add_argument("--out-dir", default=None,
                    help="Pasta da fase anterior (obrigatorio na pratica pra 'analise'/'cortar'; "
                         "sem ele o script tenta achar a pasta mais recente do mesmo video)")
    ap.add_argument("--crop-side", default="auto", choices=["auto", "esquerda", "direita"],
                    help="Lado do crop no reenquadre 9:16. 'auto' detecta o rosto; "
                         "'esquerda'/'direita' forca o lado (usar quando ha 2 pessoas lado a lado)")
    ap.add_argument("--estilo-legenda", default="padrao", choices=sorted(ESTILOS_LEGENDA),
                    help="Estilo da legenda queimada: 'padrao' (branca) ou 'eric' "
                         "(amarela oficial dos Reels do perfil, negrito, contorno preto)")
    ap.add_argument("--sem-glossario", action="store_true",
                    help="Nao aplicar as correcoes automaticas de ASR no SRT (Claude, ChatGPT, GitHub...)")
    args = ap.parse_args()

    global APLICAR_GLOSSARIO
    APLICAR_GLOSSARIO = not args.sem_glossario

    if bool(args.video) == bool(args.batch):
        sys.exit("❌ Passe --video OU --batch (exatamente um dos dois).")

    # ── Modo batch: fila de vídeos, uma pasta de saída por vídeo ──
    if args.batch:
        pasta = Path(args.batch)
        if not pasta.is_dir():
            sys.exit(f"❌ Pasta não encontrada: {pasta}")
        videos = sorted(p for p in pasta.iterdir()
                        if p.suffix.lower() in (".mp4", ".mov", ".mkv"))
        if not videos:
            sys.exit(f"❌ Nenhum vídeo (.mp4/.mov/.mkv) em {pasta}")

        total_min = 0.0
        print(f"🎞️  BATCH: {len(videos)} vídeo(s) em {pasta}")
        for v in videos:
            m = _dur_minutos(v)
            total_min += m
            print(f"   • {v.name}  ({m:.0f} min)" if m else f"   • {v.name}  (duração ?)")
        custo = total_min * 0.006 + 0.03 * len(videos)
        print(f"💰 Custo estimado de API: ~US${custo:.2f} "
              f"({total_min:.0f} min de transcrição + {len(videos)} análises)\n")

        downloads = Path.home() / "Downloads"
        ts = __import__("datetime").datetime.now().strftime("%Y%m%d-%H%M%S")
        falhas = []
        for i, v in enumerate(videos, 1):
            print(f"\n{'#' * 60}\n# BATCH {i}/{len(videos)}: {v.name}\n{'#' * 60}")
            out_dir = downloads / f"clipes-{slug(v.stem, 30)}-{ts}"
            try:
                processar_video(v, args, out_dir)
            except SystemExit:
                raise
            except Exception as e:
                # um video corrompido nao pode derrubar a fila inteira
                falhas.append((v.name, str(e)[:200]))
                print(f"❌ Falhou {v.name}: {e}\n   Seguindo pro próximo da fila.")
        if falhas:
            print(f"\n⚠️  BATCH terminou com {len(falhas)} falha(s):")
            for nome, erro in falhas:
                print(f"   • {nome}: {erro}")
        else:
            print(f"\n✅ BATCH completo: {len(videos)} vídeo(s) sem falha.")
        return

    video = Path(args.video)
    if not video.exists():
        sys.exit(f"❌ Vídeo não encontrado: {video}")

    if args.out_dir:
        out_dir = Path(args.out_dir)
    elif args.fase in ("analise", "cortar"):
        # Fases seguintes precisam da pasta da fase anterior (transcript.json /
        # clips_selecionados.json). Sem --out-dir, tenta achar a pasta mais recente
        # deste mesmo video em vez de criar uma pasta nova vazia.
        encontrada = _localizar_out_dir_existente(video)
        if encontrada:
            out_dir = encontrada
            print(f"⚠️  --out-dir não informado: usando a pasta mais recente encontrada para este vídeo: {out_dir}")
        else:
            downloads = Path.home() / "Downloads"
            ts = __import__("datetime").datetime.now().strftime("%Y%m%d-%H%M%S")
            out_dir = downloads / f"clipes-{slug(video.stem, 30)}-{ts}"
            print(f"⚠️  --out-dir não informado e nenhuma pasta anterior encontrada para este vídeo. Criando nova (provavelmente vai faltar arquivo da fase anterior): {out_dir}")
    else:
        downloads = Path.home() / "Downloads"
        ts = __import__("datetime").datetime.now().strftime("%Y%m%d-%H%M%S")
        out_dir = downloads / f"clipes-{slug(video.stem, 30)}-{ts}"

    processar_video(video, args, out_dir)


if __name__ == "__main__":
    main()
