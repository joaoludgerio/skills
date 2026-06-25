---
name: video
description: Gera vídeos com avatar do Eric via HeyGen + voz ElevenLabs (mesmos perfis da skill /voz). Credenciais mínimas necessárias: HEYGEN_API_KEY + ELEVENLABS_API_KEY. Fluxo: humanizar script → ElevenLabs TTS → hospedar áudio (HeyGen Asset API ou Supabase) → HeyGen type:audio → poll → URL. TRIGGER quando Eric pedir "gera vídeo", "cria vídeo com meu avatar", "HeyGen" ou descrever vídeo para um avatar.
---

# HeyGen — Geração de Vídeo com Avatar + Voz ElevenLabs

**Credenciais mínimas:** `HEYGEN_API_KEY` + `ELEVENLABS_API_KEY`
**Supabase é opcional** — existe apenas como fallback de hospedagem de áudio.

Fluxo completo: humanizar script → gerar áudio ElevenLabs → hospedar áudio em URL pública → gerar vídeo HeyGen → aguardar → retornar URL.

---

## QUANDO USAR

**TRIGGER:**
- "gera vídeo com meu avatar dizendo X"
- "cria um vídeo pra [contexto]"
- "HeyGen" em qualquer contexto
- "vídeo vertical/horizontal para [destino]"

**NUNCA:**
- `character.type: "talking_photo"` — sempre `"avatar"`
- `voice.type: "text"` ou `"elevenlabs"` — sempre `"audio"` (áudio pré-gerado ElevenLabs)

---

## CONFIRMAÇÃO ANTES DE GERAR

SEMPRE mostrar antes de disparar:

```
Avatar: [nome]
Perfil de voz: [perfil]
Orientação: [vertical 720x1280 | horizontal 1280x720]
Script humanizado: "[texto]"

Confirma?
```

Exceção: Eric pediu com script pronto e avatar explícito → pode disparar direto.

---

## CATÁLOGO DE AVATARES

| Avatar | avatar_id | Orientação | Quando usar |
|--------|-----------|------------|-------------|
| `eric-escritorio` | `2ee17d055d9d429e98d30bf3aa93bdb8` | vertical | DEFAULT — reels, stories, apresentações |
| `eric-podcast` | `f20410707a9a4df391d712921ede3f12` | vertical | Conteúdo conversacional |
| `eric-stand` | `3373f8bee71c43f39e155b7c0f95832b` | vertical | Apresentações formais, palestras |
| `eric-youtube` | `ecc84da168f7497d97d2216f1a7cf11f` | **horizontal** | YouTube (dimension 1280x720) |
| `eric-roqueiro` | `f3b1d81e134b46449e67f1ce9d84cdae` | vertical | Conteúdo descontraído |

**Default:** `eric-escritorio`.

---

## PERFIS DE VOZ (idênticos à skill /voz)

| Perfil | voice_id (ElevenLabs) | Settings (stab/sim/style/speed) | Quando usar |
|--------|----------------------|--------------------------------|-------------|
| `eric-casual` | `HSqIMKW3FHpkAcy8JJLM` | 0.45 / 0.75 / 0.30 / 0.95 | DEFAULT — conteúdo dia a dia, tom próximo |
| `eric-casual-animado` | `HSqIMKW3FHpkAcy8JJLM` | 0.25 / 0.75 / 0.55 / 1.0 | Empolgação, lançamento, energia alta |
| `eric-profissional` | `ASKPogZ3ZKeHiPbzqJws` | 0.40 / 0.85 / 0.55 / 1.0 | B2B sério, decisor sênior |
| `eric-prospeccao` | `p8rbNftT5qUb7Gkn7i3S` | 0.40 / 0.80 / 0.40 / 1.0 | Vídeos de prospecção em massa |

**Modelo ElevenLabs:** `eleven_turbo_v2_5` — único aprovado.
**Default:** `eric-casual`.

---

## HUMANIZAÇÃO DO SCRIPT

Mesmas regras da skill `/voz`. Aplicar **antes** de passar o texto para ElevenLabs.

**Quando aplicar:**
- `eric-casual` / `eric-casual-animado`: humanização **forte**
- `eric-profissional` / `eric-prospeccao`: humanização **leve** (só R drop em infinitivos longos)

**Regras forte:**
- `para` → `pra`
- `você` → `cê`
- `está` → `tá` / `estou` → `tô`
- Verbos infinitivos longos (>3 sílabas): drop do R (`falar` → `falá`, `dizer` → `dizê`, `fazer` → `fazê`)
- Exceções (não dropar R): `ser, ter, ver, ler, ir, vir, sair`

**Regras leve:**
- `para` → `pra`
- Drop do R só em infinitivos longos
- Manter `você`, `está`, `estou`

---

## FLUXO COMPLETO

### Passo 1 — Humanizar script

Aplicar humanização (forte ou leve conforme perfil) no texto original antes de qualquer chamada de API.

### Passo 2 — Gerar áudio ElevenLabs

Usar arquivo para o payload (evita bug de encoding UTF-8 com acentos):

```bash
cat > /tmp/el-payload.json << 'EOF'
{
  "text": "SCRIPT_HUMANIZADO",
  "model_id": "eleven_turbo_v2_5",
  "voice_settings": {
    "stability": STAB,
    "similarity_boost": SIM,
    "style": STYLE,
    "use_speaker_boost": true
  }
}
EOF

curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/VOICE_ID" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/el-payload.json \
  -o /tmp/heygen-audio.mp3
```

### Passo 3 — Hospedar áudio em URL pública

O HeyGen precisa de uma URL pública pra baixar o MP3. Duas opções — usar a que estiver disponível no ambiente:

#### Opção A — HeyGen Asset Upload (preferido, só usa HEYGEN_API_KEY)

```bash
AUDIO_URL=$(curl -s -X POST "https://upload.heygen.com/v1/asset" \
  -H "X-Api-Key: $HEYGEN_API_KEY" \
  -F "file=@/tmp/heygen-audio.mp3;type=audio/mpeg" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['url'])")
echo "Audio URL: $AUDIO_URL"
```

#### Opção B — Supabase Storage (fallback, requer SUPABASE_SERVICE_ROLE_KEY)

```bash
FILENAME="heygen-$(date +%s).mp3"

# Upload
curl -s -X POST \
  "https://gmpurkzxtvzqlvkqwjkp.supabase.co/storage/v1/object/whatsapp-audio/heygen/$FILENAME" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: audio/mpeg" \
  --data-binary @/tmp/heygen-audio.mp3

# Signed URL (1h — suficiente pro HeyGen processar)
SIGNED=$(curl -s -X POST \
  "https://gmpurkzxtvzqlvkqwjkp.supabase.co/storage/v1/object/sign/whatsapp-audio/heygen/$FILENAME" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"expiresIn": 3600}')
AUDIO_URL="https://gmpurkzxtvzqlvkqwjkp.supabase.co$(echo $SIGNED | python3 -c "import sys,json; print(json.load(sys.stdin)['signedURL'])")"
echo "Audio URL: $AUDIO_URL"
```

### Passo 4 — Gerar vídeo HeyGen

```bash
cat > /tmp/heygen-payload.json << EOF
{
  "title": "[OC] Título do vídeo",
  "video_inputs": [{
    "character": {
      "type": "avatar",
      "avatar_id": "AVATAR_ID",
      "avatar_style": "normal"
    },
    "voice": {
      "type": "audio",
      "audio_url": "$AUDIO_URL",
      "input_text": "SCRIPT_HUMANIZADO"
    },
    "background": {"type": "color", "value": "#0A0E1A"}
  }],
  "dimension": {"width": 720, "height": 1280}
}
EOF

curl -s "https://api.heygen.com/v2/video/generate" \
  -H "X-Api-Key: $HEYGEN_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/heygen-payload.json
# → capturar .data.video_id
```

**Importante:** `input_text` é obrigatório junto com `audio_url`. Sem ele, HeyGen retorna "word time metadata is missing" e o vídeo falha.

### Passo 5 — Aguardar processamento

```bash
until [ "$(curl -s "https://api.heygen.com/v1/video_status.get?video_id=VIDEO_ID" \
  -H "X-Api-Key: $HEYGEN_API_KEY" | grep -o '"status":"[^"]*"' | grep -v processing)" != "" ]
do sleep 5
done
curl -s "https://api.heygen.com/v1/video_status.get?video_id=VIDEO_ID" \
  -H "X-Api-Key: $HEYGEN_API_KEY"
```

Retorna `"status": "completed"` com `video_url` (S3 assinada, ~24h).

### Passo 6 — Retornar ao Eric

```
Vídeo pronto!
URL: [video_url]
Duração: [duration]s
```

---

## CREDENCIAIS

| Var | Obrigatório | Fonte canônica (1Password) |
|-----|-------------|---------------------------|
| `HEYGEN_API_KEY` | ✅ sempre | `op read "op://Agentes Eric/HEYGEN_API_KEY/credential"` |
| `ELEVENLABS_API_KEY` | ✅ sempre | `op read "op://Agentes Eric/ELEVENLABS_API_KEY/credential"` |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ só se usar Opção B | `op read "op://Agentes Eric/SUPABASE_SERVICE_ROLE_KEY_WHATSAPP/credential"` |

---

## FALLBACKS

- **ElevenLabs 401**: API key rotacionada — buscar no 1Password.
- **HeyGen Asset Upload falha**: usar Opção B (Supabase) ou verificar endpoint `upload.heygen.com`.
- **Supabase upload falha**: verificar service role key ou tentar path diferente.
- **HeyGen `status: "failed"`**: retornar `error.message`, não tentar de novo automaticamente.
- **Timeout >5min**: avisar Eric e retornar `video_id` para checar depois.

---

## HISTÓRICO

- **v1.0 (12/05/2026)**: HeyGen native TTS (`type: "text"`). Vozes HeyGen catalogadas.
- **v2.0 (12/05/2026)**: migrada para ElevenLabs → Supabase → HeyGen `type: "audio"`. Perfis e humanizador alinhados com skill `/voz`. Validado em teste A/B — aprovado pelo Eric.
- **v2.1 (12/05/2026)**: adicionado `input_text` obrigatório junto com `audio_url` no passo 4. Sem ele, HeyGen retorna "word time metadata is missing for the script". Diagnosticado pelo OpenClaw, confirmado por teste no PC.
- **v2.2 (12/05/2026)**: Passo 3 reestruturado — HeyGen Asset Upload como Opção A (só HEYGEN_API_KEY), Supabase rebaixado pra Opção B (fallback). Credenciais mínimas: HEYGEN_API_KEY + ELEVENLABS_API_KEY. Supabase não é mais dependência obrigatória.
