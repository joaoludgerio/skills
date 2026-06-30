#!/usr/bin/env python3
"""Setup do voice checker — baixa o modelo ONNX e converte a referencia de voz.

Uso:
  python setup_voice_checker.py                        # so baixa o modelo
  python setup_voice_checker.py --ref seu-audio.mp3   # modelo + referencia
  python setup_voice_checker.py --test bloco.mp4      # testa no arquivo

Paths de saida (fixos pra que verificar_voz.py encontre):
  C:/MCPs/speaker-embed.onnx
  C:/MCPs/eric-voice-ref.wav

IMPORTANTE — qual audio usar como referencia:
  A referencia DEVE ser um audio do ElevenLabs com a voz correta (clone "Eric
  Profissional - Abril-25"), NAO a voz real do Eric. O modelo ERes2Net embeds
  vozes TTS diferente de vozes reais; usar voz real como ref da sim ~0.88 contra
  ElevenLabs correto, mas so 0.11 quando ElevenLabs errou a voz — o limiar de
  0.5 ainda funciona, mas melhor usar ElevenLabs vs ElevenLabs.

  Referencia recomendada: qualquer audio-NN.mp3 de um reel anterior aprovado,
  ex: pirata-prompt-injection/heygen/audio-01.mp3.

  Calibracao real (25/06/2026, ERes2Net VoxCeleb, reel-pirata vs reel-restaurante):
    Voz correta (mesmo reel, mesma sessao):  0.87-0.95
    Voz correta (reels/sessoes diferentes):  0.87-0.95
    Voz errada (ElevenLabs usou clone diff): 0.10-0.18
    Threshold seguro: 0.5 (larga margem)
"""
import argparse
import os
import subprocess
import sys
import urllib.request

MODEL_URL = (
    "https://github.com/k2-fsa/sherpa-onnx/releases/download/"
    "speaker-recongition-models/"
    "3dspeaker_speech_eres2net_sv_en_voxceleb_16k.onnx"
)
MODEL_PATH = r"C:\MCPs\speaker-embed.onnx"
REF_PATH   = r"C:\MCPs\eric-voice-ref.wav"
MODEL_SIZE_MB = 25.3


def download_model():
    if os.path.exists(MODEL_PATH) and os.path.getsize(MODEL_PATH) > 1_000_000:
        print(f"modelo ja existe ({os.path.getsize(MODEL_PATH)/1024/1024:.1f} MB) — pulando download")
        return
    print(f"baixando modelo ERes2Net ({MODEL_SIZE_MB:.0f}MB)...", flush=True)
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)

    def _progress(count, block, total):
        pct = min(count * block * 100 // total, 100)
        if pct % 25 == 0:
            print(f"  {pct}%", flush=True)

    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH, reporthook=_progress)
    size = os.path.getsize(MODEL_PATH)
    if size < 1_000_000:
        sys.exit(f"ERRO: arquivo baixado tem apenas {size} bytes — URL invalida?")
    print(f"OK: {size/1024/1024:.1f} MB -> {MODEL_PATH}")


def convert_ref(src):
    """Converte qualquer audio para WAV 16kHz mono (formato esperado pelo checker)."""
    print(f"convertendo referencia: {src} -> {REF_PATH}", flush=True)
    subprocess.run([
        "ffmpeg", "-y", "-v", "error",
        "-i", src,
        "-ar", "16000", "-ac", "1",
        REF_PATH,
    ], check=True)
    dur = float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "csv=p=0", REF_PATH,
    ]).strip())
    print(f"referencia salva: {REF_PATH} ({dur:.1f}s)")
    if dur < 5:
        print("AVISO: audio muito curto (<5s) — gravar pelo menos 15-20s para melhor calibracao")


def test_model(audio_path):
    """Testa o modelo num arquivo e mostra a similaridade com a referencia."""
    if not os.path.exists(MODEL_PATH):
        sys.exit(f"modelo nao encontrado em {MODEL_PATH} — rodar setup_voice_checker.py primeiro")
    if not os.path.exists(REF_PATH):
        sys.exit(f"referencia nao encontrada em {REF_PATH} — passar --ref <audio> primeiro")

    import numpy as np
    import sherpa_onnx

    cfg = sherpa_onnx.SpeakerEmbeddingExtractorConfig(model=MODEL_PATH, num_threads=4)
    ext = sherpa_onnx.SpeakerEmbeddingExtractor(cfg)

    def embed(path, max_s=30):
        raw = subprocess.run(
            ["ffmpeg", "-v", "error", "-t", str(max_s), "-i", path,
             "-ar", "16000", "-ac", "1", "-f", "s16le", "-vn", "-"],
            capture_output=True, check=True,
        ).stdout
        x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        s = ext.create_stream()
        s.accept_waveform(16000, x)
        s.input_finished()
        e = np.array(ext.compute(s))
        return e / np.linalg.norm(e)

    ref = embed(REF_PATH)
    tgt = embed(audio_path)
    sim = float(np.dot(ref, tgt))
    ok = sim >= 0.5
    print(f"\n{os.path.basename(audio_path)}  sim={sim:.3f}  {'OK (voz correta)' if ok else 'VOZ ERRADA (threshold 0.5)'}")
    print(f"referencia usada: {REF_PATH}")
    print("calibracao (25/06/2026): voz correta 0.87-0.95 | voz errada 0.10-0.18 | threshold 0.5")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", help="audio de referencia do locutor (qualquer formato)")
    ap.add_argument("--test", help="arquivo para testar (mp3/mp4/wav)")
    args = ap.parse_args()

    download_model()

    if args.ref:
        convert_ref(args.ref)

    if args.test:
        test_model(args.test)

    if not args.ref and not args.test:
        print("\nPROXIMO PASSO: passar um audio ElevenLabs aprovado como referencia:")
        print(f"  python setup_voice_checker.py --ref <reel>/heygen/audio-01.mp3")
        print(f"  Use um .mp3 de um reel anterior aprovado (NAO a voz real).")


if __name__ == "__main__":
    main()
