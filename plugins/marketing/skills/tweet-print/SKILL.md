---
name: tweet-print
description: Gera imagem PNG estilo "tweet print" (mockup de post do X/Twitter) para postar no Instagram, LinkedIn ou outras redes. Aceita texto com palavras em negrito (markdown **word**), avatar real, selo verificado, tema claro/escuro/branco, formato feed/retrato/story e modo carrossel nativo. TRIGGER quando o usuario pedir "tweet print", "fake tweet", "post tipo tweet", "post estilo X", "post estilo Twitter", "mockup de tweet", "imagem de tweet pro feed", "carrossel de tweets", "transforma esse texto em tweet print", "post de Instagram tipo tweet", "post estilo print viral", "viraliza essa frase", "transforma em meme estilo tweet", ou similar.
---

# Tweet Print — Mockup de Post do X/Twitter

Skill para transformar uma frase / piada / insight em **imagem PNG estilo tweet print** pronta pra postar no Instagram (feed, story ou carrossel), LinkedIn, etc.

Visual de referencia: foto circular do autor + nome com selo verificado + handle + texto grande com palavras-chave em negrito. Inspirado em prints de tweet que viram conteudo de feed.

---

## ANATOMIA DO POST

| Elemento | Default | Customizavel |
|----------|---------|--------------|
| Avatar | inicial estilizada (gradiente azul) | `--avatar /caminho/foto.jpg` |
| Nome | "Eric Luciano" | `--name "Outro Nome"` |
| Handle | "@ericluciano" | `--handle "@outro"` |
| Selo verificado | sim (azul) | `--no-verified` para esconder |
| Texto | obrigatorio | `--text "..."` (use `**word**` pra negrito) |
| Tema | `light` (creme #f5f3ee) | `--theme dark` (preto X) ou `--theme white` (branco puro) |
| Formato | `1080x1080` (feed) | `--format 1080x1350` (retrato) ou `--format 1080x1920` (story) |
| Tamanho da fonte | auto (varia 40-64px conforme texto) | `--font-size 56` |
| Output | `./tweet-print.png` | `--output /caminho/saida.png` |

---

## QUANDO USAR

- Usuario pediu para criar um post de Instagram em estilo tweet print
- Usuario tem uma frase de impacto, piada, ou insight curto que merece formato visual
- Usuario quer fazer um carrossel de varios "tweets" relacionados
- Usuario referencia um post viral em formato similar e quer replicar a estetica

**NAO usar quando:**
- Usuario quer postar texto puro (sem virar imagem)
- Usuario quer outro tipo de design visual (cartao, infografico, etc.)
- Usuario quer postar de fato no Instagram (essa skill SO GERA a imagem; postagem e fluxo separado via Make/API)

---

## FLUXO DE EXECUCAO

### 1. Coletar inputs do usuario

Antes de gerar, alinhar com o usuario:

- **Texto** completo (quais palavras vao em negrito? marcar com `**`)
- **Autor:** confirmar `--name` e `--handle` de quem assina o post. Esta skill e do plugin de marketing e e usada por varios colaboradores; os defaults sao "Eric Luciano"/"@ericluciano". Se quem pede NAO for o Eric, passar `--name`/`--handle` da pessoa certa pra nao estampar o nome errado.
- **Tema:** claro (creme), branco puro, ou escuro (X preto)
- **Formato:** feed quadrado (`1080x1080`), retrato (`1080x1350`) ou story (`1080x1920`)
- **Avatar:** caminho da foto OU usar inicial estilizada
- **Carrossel:** se for varios slides, listar texto de cada um

Se o usuario nao especificar, usar defaults: nome/handle do Eric, tema `light`, formato `1080x1080`, avatar inicial (ou `TWEET_PRINT_DEFAULT_AVATAR` se setado), selo verificado ativo.

### 2. Garantir dependencias instaladas

Na primeira execucao em uma maquina. O `generate.py`, o `requirements.txt` e os comandos abaixo presumem que voce esta DENTRO da pasta da skill — sempre rodar a partir do diretorio da skill (`cd` no path completo `plugins/marketing/skills/tweet-print`) ou usar o caminho absoluto pro `generate.py`, ja que o cwd do agente nao e garantido:

```bash
pip install -r requirements.txt
playwright install chromium
```

Se ja estiver instalado, pular.

### 3. Executar o gerador

Single tweet:

```bash
python generate.py \
  --text "Se **Matrix** fosse lancado hoje, o **Neo** se chamaria **Claudio**." \
  --name "Eric Luciano" \
  --handle "@ericluciano" \
  --avatar "C:/Users/Eric Luciano/OneDrive/Imagens/Perfil profissional/Avatar.jpg" \
  --theme light \
  --format 1080x1080 \
  --output "./tweet-claudio.png"
```

Carrossel (modo nativo — gera N PNGs numerados em uma so chamada):

```bash
python generate.py \
  --texts "**1/** primeira tese" "**2/** segunda tese" "**3/** punchline final" \
  --avatar "C:/caminho/foto.jpg" \
  --output-prefix "./meu-carrossel"

# Gera: ./meu-carrossel-01.png, ./meu-carrossel-02.png, ./meu-carrossel-03.png
```

### Avatar default por usuario

Para cada colaborador setar sua propria foto uma vez e nao precisar passar `--avatar` toda vez, definir env var:

**Windows (PowerShell, persistente):**
```powershell
[Environment]::SetEnvironmentVariable("TWEET_PRINT_DEFAULT_AVATAR", "C:\Users\seu-user\foto.jpg", "User")
```

**Mac/Linux (bashrc/zshrc):**
```bash
export TWEET_PRINT_DEFAULT_AVATAR="/Users/seu-user/foto.jpg"
```

A skill usa essa variavel se `--avatar` nao for passado. Se a variavel nao existir e `--avatar` nao for passado, usa inicial estilizada como fallback.

### 4. Mostrar o resultado

Apos gerar, mostrar o caminho do arquivo como link clicavel e oferecer ajustes:

- Trocar foto / handle / tema
- Refazer com texto ajustado
- Gerar variantes (story, retrato)
- Adicionar slide extra ao carrossel

---

## REGRAS DE NEGRITO

O usuario marca palavras com `**dois asteriscos**`. Exemplos:

- `"Se **Matrix** fosse hoje o **Neo** seria **Claudio**"` → 3 palavras em bold
- `"essa decisao **muda tudo**"` → 2 palavras em bold (frase inteira)
- `"sem negrito mesmo"` → texto sem grifos

**Boas praticas:**
- Bold nas palavras-chave da punchline (substantivos, marcas, numeros)
- 2-4 termos em bold maximo (mais que isso polui)
- Bold no que voce quer que o leitor leia se passar voando

---

## DECISOES DE DESIGN PADRAO

| Decisao | Valor | Por que |
|---------|-------|---------|
| Fonte | Inter (Google Fonts) | Visualmente igual a Chirp do X, gratuita, mesma referencia do Rafael Milagre |
| Cor de fundo `light` | `#f5f3ee` (creme) | Da cara de "post organico", nao "screenshot" |
| Cor do nome / texto | `#0f1419` | Preto suave do X (nao puro) |
| Cor do handle | `#8a8a8a` italico | Mesma estetica de prints virais |
| Selo verificado | sempre azul `#1d9bf0` | Padrao X |
| Avatar circular | 120px | Proporcao de print real |
| Letter-spacing | -1.5px no texto | Compactacao tipica do X |

---

## TROUBLESHOOTING

**Texto cortado na borda direita:**
- Aumentar formato (`1080x1350`) ou reduzir font-size manualmente
- Ou marcar menos palavras em negrito (bold ocupa mais largura)

**Avatar aparece quadrado:**
- Verificar extensao do arquivo (.jpg, .png, .webp)
- Imagem com pessoa mal centralizada: pre-cortar em quadrado antes

**Fonte saiu diferente (mais Segoe UI / Helvetica):**
- Inter nao carregou. Checar conexao de internet
- Se rodando offline, fazer fallback para `--theme dark` que disfarca melhor a fonte

**Erro `Playwright nao instalado`:**
- Rodar `pip install playwright && playwright install chromium`

---

## PROXIMOS PASSOS POSSIVEIS (V3)

- Embarcar fonte Inter local (offline)
- Exportar tambem como JPG (menor)
- Adicionar timestamp / data fake para autenticidade
- Adicionar contadores de like/RT/views (estilo print real)
- Suporte a multiplas linhas com `\n` literal
- Modo "Threads" da Meta (visual diferente do X)
- Modo "LinkedIn" (mockup de post do LinkedIn em vez do X)
- Pre-cropping automatico de avatar nao-quadrado (face detection)
