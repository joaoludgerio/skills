# 05 — Formato do projeto e injeção no editor

Este é o passo que transforma a copy em arquivo entregável. **Leia com atenção — o JSON precisa bater exatamente com o que o editor lê.**

## O objeto do projeto

```json
{
  "fmt": "45",
  "kit": "Sora + Inter",
  "theme": {"name":"Expert Dark","bg":"#1b1b1b","bg2":"#2a2350","fg":"#ffffff","accent":"#fe7b02","grad":true},
  "handle": "@perfildapessoa",
  "showPag": true,
  "showSeta": true,
  "slides": [
    {"tipo":"capa","kicker":"","titulo":"O gancho que para o dedo","corpo":"","cta":"Arraste →","align":"left"},
    {"tipo":"conteudo","kicker":"PONTO 1","titulo":"Uma ideia por slide","corpo":"Texto de apoio curto.","cta":"","align":"left"},
    {"tipo":"cta","kicker":"","titulo":"Curtiu? Salva esse post","corpo":"Me segue pra mais.","cta":"Salvar · Seguir","align":"center"}
  ]
}
```

### Campos globais
| Campo | Valores | Nota |
|---|---|---|
| `fmt` | `"45"` (retrato 1080×1350) ou `"11"` (quadrado 1080×1080) | default `"45"` |
| `kit` | nome EXATO do kit (ver `02-sistema-visual.md`) | ex: `"Tech (Space Grotesk)"` |
| `theme` | objeto `{name,bg,bg2,fg,accent,grad}` | use uma paleta pronta ou cores da marca |
| `handle` | `@` da pessoa (vai no rodapé) | string vazia esconde |
| `showPag` | `true`/`false` | mostra `1/N` no rodapé |
| `showSeta` | `true`/`false` | seta "arraste" nos slides não-finais |

### Campos do slide
| Campo | Valores |
|---|---|
| `tipo` | `"capa"` (1º slide, título grande) · `"conteudo"` (meio) · `"cta"` (fechamento) |
| `kicker` | rótulo curto de topo (vira MAIÚSCULA), ou `""` |
| `titulo` | texto principal (a fonte encolhe sozinha pra caber) |
| `corpo` | texto de apoio, ou `""` |
| `cta` | pílula de chamada (geralmente só na capa "Arraste →" e no `cta` final), ou `""` |
| `align` | `"left"` (default) ou `"center"` |
| `foto` | caminho do arquivo da imagem, dataURL, ou ausente/`null` (sem foto) |
| `fotoModo` | `"fundo"` (foto cobre o slide + overlay — bom pra capa) ou `"lado"` (foto na metade direita) |

> A fonte do título e do corpo **ajusta o tamanho automaticamente** pra caber. Mas texto curto fica melhor — não conte com isso pra enfiar parágrafo.

> **Foto:** se `foto` for um caminho de arquivo (ex: `"C:/.../Avatar.jpg"`), o `montar.py` lê e embute como dataURL — por isso, **com foto, prefira sempre o `montar.py`** (a injeção manual exige que você mesmo converta a imagem). No modo `fundo`, o overlay usa a cor de fundo do tema, então o texto continua legível sobre a foto.

## Como gerar o arquivo de entrega

1. **Leia** o template `assets/editor-carrossel.html` (não modifique o original).
2. **Injete** o projeto: insira esta linha imediatamente ANTES da tag `<script>` principal (a que começa com o comentário `/* ===... Estado`), ou logo após a abertura do `<body>`:

   ```html
   <script>window.CARROSSEL = { ...o objeto do projeto... };</script>
   ```

   O editor lê `window.CARROSSEL` no boot e já abre preenchido. Se o objeto não existir, ele abre com o exemplo padrão (não quebra).

3. **Salve** o resultado como `<slug>-carrossel.html` na pasta do projeto da pessoa (ex: `Downloads/` ou a pasta que ela indicar). Use um slug curto em kebab-case (`3-erros-carrossel.html`).

4. **Avise** a pessoa:
   > "Pronto. Abre o arquivo `<slug>-carrossel.html` no navegador (duplo clique). Ajusta o que quiser nos painéis e clica em **Exportar PNGs (.zip)** — ele baixa um zip com 1 imagem por slide, prontas pro Instagram."

## Alternativa: importar JSON
Se preferir não gerar o HTML, a pessoa pode abrir o `editor-carrossel.html` direto e usar **Importar JSON** — basta entregar o `.json` do projeto. Mas o caminho padrão (HTML pré-montado) é mais suave.

## Validação rápida antes de entregar
- [ ] `kit` é um nome exato da lista? (senão cai no fallback)
- [ ] `theme` tem os 5 campos de cor + `grad`?
- [ ] Slide 1 é `capa`, último é `cta`?
- [ ] Toda a copy com acentuação correta?
- [ ] JSON é válido (sem vírgula sobrando, aspas certas)?
