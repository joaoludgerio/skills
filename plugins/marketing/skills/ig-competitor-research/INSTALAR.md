# ig-competitor-research — instalar e testar (guia rápido)

Skill de Claude Code que descobre o que está viralizando no Instagram do seu nicho e gera um
relatório HTML com os posts de maior performance: hook, formato, transcrição e por que viralizou.

Catálogo: https://skills.ericluciano.com.br (categoria "Lab pessoal").

---

## 1. Pré-requisitos (instala uma vez)

- **Python 3** (`python --version`)
- **FFmpeg** no PATH (`ffmpeg -version`)
- **Bibliotecas Python:** `pip install -U openai-whisper`
- **Token do Apify** na variável de ambiente `APIFY_TOKEN`
  - Cria conta grátis em https://apify.com → Settings → API & Integrations → copia o token
  - Windows (PowerShell): `setx APIFY_TOKEN "seu_token_aqui"` (fecha e reabre o terminal depois)

> Custo: ~US$ 0,10–0,15 por pesquisa no Apify (cabe no free tier de US$ 5/mês). Whisper roda local = grátis.

## 2. Instalar a skill

**Opção A — manual (recomendada, funciona em qualquer máquina):**
1. Descompacta o `ig-competitor-research.zip`.
2. Move a pasta `ig-competitor-research` pra dentro de `~/.claude/skills/`
   (no Windows: `C:\Users\SEU_USUARIO\.claude\skills\ig-competitor-research\`).
3. Reinicia o Claude Code.

**Opção B — via plugin (se você tiver acesso ao repo `ericlucianoferreira/skills`):**
```
/plugin marketplace add ericlucianoferreira/skills
/plugin install lab@ericluciano
```

## 3. Usar

No Claude Code, é só pedir em linguagem natural:

> roda o IG competitor research nesses perfis: @perfil1 @perfil2 @perfil3

Ou edita a lista fixa em `competitors.txt` (1 @ por linha) e roda sem argumento.

O que acontece: ele scrapeia os perfis, pega os posts da semana, rankeia por **outlier score**
(quanto o post superou a mediana do próprio perfil), transcreve os Reels com Whisper, analisa o
visual de cada post e abre um `report.html` com tudo.

## 4. Rodar direto pelo script (opcional, sem Claude)

```bash
# coleta + ranking + transcrição
python scripts/research.py @perfil1 @perfil2 --dias 7 --top-total 15

# gera o relatório (depois que o Claude preencher analysis.json — ver SKILL.md)
python scripts/build_report.py output/<pasta-gerada>
```

Flags úteis: `--dias N` (janela, default 7), `--no-transcribe` (rápido, sem Whisper),
`--whisper-model base|small` (default small).

---

Dúvida ou erro? Manda print do terminal que a gente resolve.
