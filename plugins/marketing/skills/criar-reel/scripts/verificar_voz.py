#!/usr/bin/env python3
"""Verificacao de locutor das cenas do HeyGen (anti voz-trocada).

Defeito conhecido: o HeyGen as vezes ignora o voice_id e gera a cena com outra
voz (tipicamente feminina generica). Pitch/MFCC caseiros NAO separam — usar
embedding de locutor real (sherpa-onnx + modelo ERes2Net).

Calibracao (10/06/2026, reel-radar): cenas com a voz do Eric = sim 0.70-0.92;
cenas com a voz errada = sim 0.19-0.23. Threshold default 0.5.

Requisitos: pip install sherpa-onnx; modelo em C:/MCPs/speaker-embed.onnx;
referencia da voz em C:/MCPs/eric-voice-ref.wav (16k mono, ~20s do Eric).

Uso:
  python verificar_voz.py <cena1.mp4> [...] [--threshold 0.5] [--ref ...] [--model ...]

Saida: "<arquivo>\tsim=X.XXX\tOK|VOZ_ERRADA" por linha. Exit 1 se alguma errada.
"""
import argparse
import os
import subprocess
import sys

import numpy as np

SR = 16000
DEFAULT_MODEL = "C:/MCPs/speaker-embed.onnx"
DEFAULT_REF = "C:/MCPs/eric-voice-ref.wav"


def _load_pcm(path, max_s=30):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-t", str(max_s), "-i", path,
         "-ar", str(SR), "-ac", "1", "-f", "s16le", "-vn", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


class VoiceChecker:
    def __init__(self, model=DEFAULT_MODEL, ref=DEFAULT_REF):
        import sherpa_onnx
        cfg = sherpa_onnx.SpeakerEmbeddingExtractorConfig(model=model, num_threads=4)
        self._ext = sherpa_onnx.SpeakerEmbeddingExtractor(cfg)
        self._ref = self._embed(ref)

    def _embed(self, path):
        x = _load_pcm(path)
        s = self._ext.create_stream()
        s.accept_waveform(SR, x)
        s.input_finished()
        e = np.array(self._ext.compute(s))
        return e / np.linalg.norm(e)

    def similarity(self, path):
        return float(np.dot(self._ref, self._embed(path)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--threshold", type=float, default=0.5)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--ref", default=DEFAULT_REF)
    args = ap.parse_args()

    vc = VoiceChecker(args.model, args.ref)
    bad = 0
    for f in args.files:
        sim = vc.similarity(f)
        ok = sim >= args.threshold
        if not ok:
            bad += 1
        print(f"{os.path.basename(f)}\tsim={sim:.3f}\t{'OK' if ok else 'VOZ_ERRADA'}", flush=True)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
