# 02 — Sistema visual

O editor já traz **kits tipográficos** e **paletas** prontos. Recomende com base no arquétipo, sempre com 1 alternativa.

## Kits tipográficos (use o nome EXATO no campo `kit` do projeto)

| Kit | Título | Corpo | Quando usar |
|---|---|---|---|
| `Sora + Inter` | Sora (geométrica) | Inter | Default. Moderno, versátil, serve quase tudo. |
| `Editorial (Playfair)` | Playfair Display (serifa) | Inter | Autoridade, premium, conteúdo "editorial". |
| `Impacto (Archivo)` | Archivo Black | Inter | Ganchos fortes, provocação, listas. |
| `Tech (Space Grotesk)` | Space Grotesk | Inter | Tecnologia, IA, produto, dado. |
| `Amigável (Poppins)` | Poppins | Inter | Tom leve, próximo, lifestyle. |
| `Clássico (Baskerville)` | Libre Baskerville | Inter | Tradicional, jurídico, luxo discreto. |

## Paletas (use o objeto inteiro no campo `theme`)

| Nome | Vibe | bg / bg2 / fg / accent |
|---|---|---|
| `Expert Dark` | escuro premium, energia | `#1b1b1b` / `#2a2350` / `#ffffff` / `#fe7b02` |
| `Expert Azul` | confiança, corporativo | `#575ecf` / `#3a3fa6` / `#ffffff` / `#ffd166` |
| `Midnight` | executivo, luxo | `#0d1b2a` / `#1b2838` / `#f4f6fb` / `#e0b84c` |
| `Scale` | educacional tech | `#103a4f` / `#0a2433` / `#eafaff` / `#2dd4ff` |
| `Traction` | técnico, SaaS | `#0a0a0a` / `#101a3a` / `#ffffff` / `#005afd` |
| `Super SDR` | dado, performance | `#0d1526` / `#142c52` / `#eaf2ff` / `#00d6a4` |
| `Creme` | quente, clean | `#fcfbf8` / `#f1ece1` / `#1b1b1b` / `#fe3f21` |
| `Branco limpo` | minimalista | `#ffffff` / `#eef0f4` / `#15161c` / `#575ecf` |
| `Rosa pop` | criativo, jovem | `#f858bc` / `#a8276f` / `#ffffff` / `#ffe14d` |

> Se a marca tem cores próprias, use-as: monte o objeto `theme` com os hex da pessoa (`name` livre). Mantenha **contraste alto** entre `fg` e `bg` — texto tem que ler de boa no celular.

## Árvore de decisão rápida
- Premium / autoridade → `Editorial (Playfair)` + `Midnight`
- IA / tech / produto → `Tech (Space Grotesk)` + `Scale` ou `Super SDR`
- Provocação / lista forte → `Impacto (Archivo)` + `Expert Dark` ou `Traction`
- Próximo / leve → `Amigável (Poppins)` + `Creme` ou `Rosa pop`
- Não sei / versátil → `Sora + Inter` + `Expert Dark`

## Formato
- **4:5 (retrato, `"45"`)** — default. Ocupa mais feed, melhor pra texto.
- **1:1 (quadrado, `"11"`)** — quando o feed da pessoa é todo quadrado.

Sempre explique a escolha em uma linha: *"Fui de Playfair + Midnight porque seu arquétipo é Especialista — passa autoridade sem gritar."*
