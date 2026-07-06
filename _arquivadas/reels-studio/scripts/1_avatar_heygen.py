"""Etapa 1 - Gera o APRESENTADOR: avatar HeyGen falando o script.

O avatar (configurado em config/avatar.json) fala o roteiro do reels. Por padrao
usa a voz nativa do HeyGen (so precisa HEYGEN_API_KEY). Opcionalmente usa uma voz
ElevenLabs (voz clonada) - nesse caso gera o audio, hospeda no HeyGen e manda o
avatar dublar.

Uso:
    python 1_avatar_heygen.py "roteiro do reels..." [saida.mp4]
    python 1_avatar_heygen.py --arquivo roteiro.txt [saida.mp4]

Requer HEYGEN_API_KEY (e ELEVENLABS_API_KEY se a voz for elevenlabs).
(Etapa que usa API paga. Nao foi testada nesta maquina - sem chave HeyGen.)
"""
import os
import sys
import json
import time
import uuid
import urllib.request
import urllib.error

sys.path.insert(0, os.path.dirname(__file__))
import config as C

C.exigir("HEYGEN_API_KEY")
AVATAR = C.carregar_avatar()

# le o roteiro (string direta ou --arquivo)
args = sys.argv[1:]
if args and args[0] == "--arquivo":
    with open(args[1], encoding="utf-8") as f:
        SCRIPT = f.read().strip()
    saida_arg = args[2] if len(args) > 2 else None
else:
    SCRIPT = (args[0] if args else "").strip()
    saida_arg = args[1] if len(args) > 1 else None

if not SCRIPT:
    raise SystemExit("Passe o roteiro do reels (string ou --arquivo roteiro.txt).")

SAIDA = saida_arg or os.path.join(C.OUTPUT_DIR, "avatar.mp4")
os.makedirs(os.path.dirname(SAIDA) or ".", exist_ok=True)

avatar_id = AVATAR["avatar_id"]
voz = AVATAR.get("voz", {"tipo": "heygen"})
dim = AVATAR.get("dimensao", {"width": 720, "height": 1280})
fundo = AVATAR.get("fundo", {"type": "color", "value": "#0A0E1A"})

HEAD = {"X-Api-Key": C.HEYGEN_API_KEY, "Content-Type": "application/json"}


def http(url, data=None, headers=None, method="GET", timeout=120):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers or HEAD, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def montar_voz():
    """Voz nativa HeyGen (default) ou ElevenLabs (opcional)."""
    if voz.get("tipo") == "elevenlabs":
        C.exigir("ELEVENLABS_API_KEY")
        audio_url = gerar_audio_elevenlabs()
        return {"type": "audio", "audio_url": audio_url, "input_text": SCRIPT}
    # padrao: TTS nativo do HeyGen
    v = {"type": "text", "input_text": SCRIPT, "voice_id": voz.get("voice_id", "")}
    if voz.get("velocidade"):
        v["speed"] = voz["velocidade"]
    return v


def gerar_audio_elevenlabs():
    """Gera o MP3 no ElevenLabs e hospeda no HeyGen Asset (retorna URL publica)."""
    cfg = voz
    corpo = {
        "text": SCRIPT,
        "model_id": cfg.get("modelo", "eleven_turbo_v2_5"),
        "voice_settings": cfg.get("settings", {"stability": 0.45, "similarity_boost": 0.75, "style": 0.3, "use_speaker_boost": True}),
    }
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{cfg['voice_id']}",
        data=json.dumps(corpo).encode(),
        headers={"xi-api-key": C.ELEVENLABS_API_KEY, "Content-Type": "application/json"},
        method="POST")
    mp3 = os.path.join(os.environ.get("TEMP", "/tmp"), f"voz_{uuid.uuid4().hex}.mp3")
    with urllib.request.urlopen(req, timeout=300) as r:
        with open(mp3, "wb") as f:
            f.write(r.read())
    # upload no HeyGen Asset (so usa HEYGEN_API_KEY)
    with open(mp3, "rb") as f:
        dados = f.read()
    req2 = urllib.request.Request(
        "https://upload.heygen.com/v1/asset",
        data=dados,
        headers={"X-Api-Key": C.HEYGEN_API_KEY, "Content-Type": "audio/mpeg"},
        method="POST")
    with urllib.request.urlopen(req2, timeout=300) as r:
        resp = json.load(r)
    return resp["data"]["url"]


# 1) dispara a geracao do video
payload = {
    "title": "[reels-studio] avatar",
    "video_inputs": [{
        "character": {"type": "avatar", "avatar_id": avatar_id, "avatar_style": "normal"},
        "voice": montar_voz(),
        "background": fundo,
    }],
    "dimension": dim,
}
print("Disparando HeyGen...", flush=True)
resp = http("https://api.heygen.com/v2/video/generate", data=payload, method="POST")
video_id = resp.get("data", {}).get("video_id")
if not video_id:
    raise SystemExit("HeyGen nao retornou video_id: " + json.dumps(resp)[:400])
print("video_id:", video_id, flush=True)

# 2) aguarda processar
url_status = f"https://api.heygen.com/v1/video_status.get?video_id={video_id}"
video_url = None
for _ in range(120):  # ate ~10 min
    time.sleep(5)
    st = http(url_status)
    status = st.get("data", {}).get("status")
    if status == "completed":
        video_url = st["data"]["video_url"]
        break
    if status == "failed":
        raise SystemExit("HeyGen falhou: " + json.dumps(st.get("data", {}).get("error", {})))
    print("  status:", status, flush=True)

if not video_url:
    raise SystemExit(f"Tempo esgotado. Cheque depois com video_id={video_id}")

# 3) baixa o mp4
with urllib.request.urlopen(urllib.request.Request(video_url), timeout=300) as r:
    with open(SAIDA, "wb") as f:
        f.write(r.read())
print("OK ->", SAIDA)
