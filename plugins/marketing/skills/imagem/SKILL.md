---
name: imagem
description: Gera e edita imagens do Eric ou da Expert Integrado. DOIS backends: OpenAI gpt-image-2 (primário) e Gemini 2.5 Flash Image (fallback). SEMPRE usa foto real como referência quando envolve o Eric. TRIGGER quando Eric pedir "gera imagem", "edita foto", "cria imagem com minha cara", "coloca eu de..." ou descrever edição visual envolvendo ele ou a marca.
---

# Imagem — Geração e Edição com Identidade

**Credenciais:** `OPENAI_API_KEY` (primário) + `GEMINI_API_KEY` (fallback)
**Assets:** repo `https://github.com/ericlucianoferreira/agent-assets` → `fotos/eric/catalogo.json`

---

## QUANDO USAR

**TRIGGER:**
- "gera imagem", "edita foto", "cria imagem"
- "coloca eu de pirata/rock/ninja/etc"
- "thumbnail pra YouTube"
- "banner pro site"
- Qualquer pedido de imagem envolvendo o Eric ou a marca Expert

**NUNCA:**
- Gerar imagem do Eric SEM foto real de referência
- Usar geração sem referência pra simular o Eric — gera pessoa genérica
- Salvar imagens geradas por padrão — só entregar, a menos que Eric peça pra salvar

---

## PRIMEIRA PERGUNTA (se não estiver óbvio)

Quando Eric pedir imagem, SEMPRE confirmar o formato antes de gerar:

```
Qual formato?
- **Story** (1080x1920) — Instagram Stories, Reels
- **YouTube** (1280x720) — thumbnails, banners
- **Quadrado** (1024x1024) — feed Instagram, LinkedIn
- **4x5** (1024x1280) — feed Instagram retrato
- **Horizontal** (1536x1024) — sites, banners largos
```

Se o contexto já deixa claro (ex: "thumbnail pro YouTube"), não perguntar.

---

## BANCO DE FOTOS DO ERIC

**Repo:** `https://github.com/ericlucianoferreira/agent-assets` (privado)
**Catálogo:** `fotos/eric/catalogo.json`

Sempre que envolver o Eric:
1. Ler o catálogo (tags: casual, formal, palestra, identidade)
2. Escolher a foto mais apropriada pro contexto
3. Usar como referência no backend escolhido
4. Nunca gerar o Eric do zero — sempre editar a partir de foto real

---

## PALETA DE CORES

### Expert Integrado (material institucional)
| Cor | Hex | Uso |
|-----|-----|-----|
| Azul principal | `#575ECF` | primário, CTAs, destaques |
| Laranja | `#FE7B02` | acentos, energia |
| Vermelho | `#FE3F21` | alertas, urgência |
| Rosa | `#F858BC` | detalhes, diferenciação |
| Fundo escuro | `#1b1b1b` | backgrounds, hero sections |
| Fundo claro | `#FCFBF8` | backgrounds claros |
| Texto | `#c5c1b9` / `#dcdad5` | texto secundário |

### Super SDR (produto)
| Cor | Hex | Uso |
|-----|-----|-----|
| Azul | `#3c83f6` | primário |
| Verde neon | `#00d6a4` / `#33ffcf` | sucesso, métricas positivas |
| Dourado | `#e7b008` / `#f99e1f` | premium, destaque |
| Fundo escuro | `#0d1526` / `#142c52` | backgrounds |

### Pessoal (não-Expert)
Livre. Escolher cores que combinam com o contexto do pedido.

**Regra:** quando for material Expert/Super SDR, SEMPRE usar a paleta acima. Quando for pessoal, cores livres.

---

## BACKENDS

### Backend 1 — OpenAI gpt-image-2 (PRIMÁRIO)

**Quando usar:** sempre, a menos que Eric peça outro ou falhe.

**Script:** `~/.claude/skills/imagem/scripts/image_gen.py` (lê OPENAI_API_KEY do env ou 1Password automaticamente)

**Python no Windows:** `C:/Users/ericl/AppData/Local/Programs/Python/Python313/python.exe`
**Temp no Windows:** `C:/tmp/` (não usar `/tmp/` — não existe no Windows)

**Fluxo para foto do Eric:**
```bash
# 1. Baixar foto de referência do agent-assets
# usar raw: a Contents API zera o .content inline pra arquivos >1MB → base64 -d gera arquivo vazio (erro "invalid_image_file" no OpenAI)
gh api repos/ericlucianoferreira/agent-assets/contents/fotos/eric/ARQUIVO.jpg \
  -H "Accept: application/vnd.github.raw" > C:/tmp/eric_ref.jpg

# 2. Gerar/editar
PYTHON="C:/Users/ericl/AppData/Local/Programs/Python/Python313/python.exe"
"$PYTHON" ~/.claude/skills/imagem/scripts/image_gen.py edit \
  --model gpt-image-2 \
  --image C:/tmp/eric_ref.jpg \
  --prompt "DESCRIÇÃO_TÉCNICA_DA_EDIÇÃO" \
  --out C:/tmp/imagem-gerada.jpg \
  --output-format jpeg \
  --force \
  --quality high
```

**Geração sem referência (banners, ilustrações SEM rosto):**
```bash
PYTHON="C:/Users/ericl/AppData/Local/Programs/Python/Python313/python.exe"
"$PYTHON" ~/.claude/skills/imagem/scripts/image_gen.py generate \
  --model gpt-image-2 \
  --prompt "DESCRIÇÃO_TÉCNICA" \
  --out C:/tmp/imagem-gerada.jpg \
  --size 1024x1024 \
  --force \
  --quality high
```

**Características:**
- ~3min por imagem
- Requer `OPENAI_API_KEY`
- Excelente preservação de identidade em edits
- Tamanhos: 1024x1024, 1536x1024, 1024x1536, auto

### Backend 2 — Gemini 2.5 Flash Image (FALLBACK)

**Quando usar:** se OpenAI falhar, ou se Eric pedir explicitamente "usa Gemini".

```python
import google.generativeai as genai
import base64

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.5-flash-image")

with open("foto_referencia.jpg", "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode()

response = model.generate_content(
    [{"inline_data": {"mime_type": "image/jpeg", "data": img_b64}},
     "DESCRIÇÃO TÉCNICA DA EDIÇÃO"],
    generation_config={"response_modalities": ["IMAGE", "TEXT"]}
)

for part in response.candidates[0].content.parts:
    if hasattr(part, 'inline_data') and part.inline_data:
        with open("saida.jpg", "wb") as f:
            f.write(part.inline_data.data)
```

**Características:**
- ~15s por imagem
- Requer `GEMINI_API_KEY`
- Bom em preservar identidade
- Modelo: `gemini-2.5-flash-image`

### Override manual

Se Eric disser "usa Gemini", "usa OpenAI", ou "usa Flash" — seguir a preferência dele, independente da ordem padrão.

---

## FLUXO COMPLETO

### Com foto do Eric (edição)

1. **Confirmar formato** (se não óbvio)
2. **Escolher foto** do catálogo conforme contexto (tag "identidade" pra edições fiéis)
3. **Montar prompt técnico** — descrever a edição de forma clara e objetiva
4. **Gerar** com backend primário (OpenAI)
5. **Se falhar** → tentar fallback (Gemini)
6. **Entregar** ao Eric

### Sem foto (geração livre)

1. **Confirmar formato**
2. **Montar prompt técnico**
3. **Gerar** com backend primário
4. **Se falhar** → fallback
5. **Entregar**

---

## CREDENCIAIS

| Var | Backend | Fonte (1Password) |
|-----|---------|-------------------|
| `OPENAI_API_KEY` | gpt-image-2 | `op read "op://Agentes Eric/OPENAI_API_KEY/credential"` |
| `GEMINI_API_KEY` | Gemini Flash Image | `op read "op://Agentes Eric/GEMINI_API_KEY/credential"` |

---

## FALLBACKS

- **OpenAI 401/429**: key inválida ou rate limit → tentar Gemini
- **Gemini modelo não encontrado**: listar modelos disponíveis com `genai.list_models()`
- **Ambos falham**: avisar Eric com o erro específico
- **Identidade ruim** (não parece o Eric): tentar outra foto do catálogo ou trocar backend

---

## HISTÓRICO

- **v1.0 (13/05/2026)**: skill criada. Dois backends (OpenAI primário, Gemini fallback). Catálogo de fotos via repo agent-assets. Paleta Expert e Super SDR. Formatos nomeados (story, YouTube, quadrado, 4x5, horizontal). Testada com Eric pirata nos dois backends.
- **v1.1 (13/05/2026)**: script `image_gen.py` criado em `~/.claude/skills/imagem/scripts/` (antes referenciava path de VPS inexistente no Windows). SKILL.md atualizado com Python path correto do Windows e temp folder `C:/tmp/`.
