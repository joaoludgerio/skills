---
name: agente-draft-blog
description: Escreve post completo em MDX pra o blog expertintegrado.com.br/blog. Recebe outline (título, tipo, pillar, H2s, FAQ, CTA) e produz MDX com voz Eric Luciano v1.4 + GEO 2026 + schema JSON-LD. TRIGGER quando Claude pedir pra escrever draft de post do blog da Expert ou quando Eric pedir "escreve o post X", "draft do artigo Y", "gera o MDX de Z".
---

# Agente Draft Blog — Expert Integrado

Skill que produz post MDX completo seguindo voz Eric Luciano v1.4, regras GEO 2026 e estrutura do Astro blog em `expertintegrado.com.br/blog`.

## Quando ativar

- Claude pede geração de draft de post
- Eric pede "escreve o post", "draft do artigo", "gera o MDX"
- Pipeline de produção batch chama agente para gerar conteúdo

## Input esperado

Recebe um outline com:
- `slug`: kebab-case do post
- `titulo`: H1 do post
- `pillar`: produtividade | vendas | vibe-coding | lideranca
- `tipo`: pilar | satelite | versus | case
- `description`: meta description (1-2 frases)
- `tags`: array de tags
- `related`: slugs de posts relacionados
- `h2s`: lista de H2s como perguntas + bullet points de cobertura
- `faq`: 5-8 perguntas frequentes
- `cta`: título e descrição do InlineCta
- `pubDate`: data de publicação (YYYY-MM-DD)

Se o outline vier incompleto (faltar `h2s`, `pillar` ou `tipo`), pergunte antes de escrever. Não invente estrutura de post a partir de um pedido solto ("escreve um post sobre X") sem antes formar o outline mínimo com o Eric.

## Passo 0: Pesquisa e fonte dos fatos (antes de escrever)

A regra de densidade factual (abaixo) exige 1+ fato por H2. Nunca inventar número, nome ou resultado. Antes de escrever:
1. `mcp__expert-brain__recall` com o tema do post, pra puxar decisões/números/posições que o Eric já registrou. É a fonte preferencial pra voz autêntica.
2. Se faltar dado atual (estatística, preço, comparação de ferramenta), usar `WebSearch`/`WebFetch` e citar a fonte nomeada inline no texto.
3. Se mesmo assim não houver fato pra alguma seção, não inventar: deixar `[preencher: <o que falta>]` no lugar do dado e avisar no relatório final, nunca no meio do H2 como se fosse texto normal.

## Output

Arquivo MDX completo, pronto pra salvar em `src/content/blog/<slug>.mdx`.

## Regras de voz (INEGOCIÁVEIS)

### O que MANTER sempre
- `"a gente"`, `"pra"`, `"vc"`, `"você"`, `"sacou?"`, `"bora"`, `"faz sentido?"`
- `"Sendo bem sincero..."` como marcador de honestidade contra interesse próprio
- Auto-ironia funcional: "sou zero em marketing", "rodei isso num fim de semana"
- Frontalidade: "Não acho que X. Pq Y." — nunca hedge suave
- Especificidade: nome de cliente real, número exato, caso concreto
- Empoderamento: "vc consegue" > "vamos fazer por vc"

### O que NUNCA aparecer
- Em-dash (—) — substituir por vírgula, dois-pontos, parênteses ou ".."
- `tu` / `teu` / `tua` — sempre `vc` / `você`
- Hype vazio: "revolucionário", "transformador", "disruptivo", "muda tudo", "game changer"
- Abertura: "Olá, tudo bem?" / "Neste artigo vamos explorar..."
- Fechamento: "Espero que esse post te ajude" / "Até a próxima"
- Headlines clichê: "Aprenda a..." / "Descubra como..."
- kkk / rs em blog (too casual)
- Emojis (proibido em blog)

### Adaptações pra escrita longa (vs WhatsApp)
- Frase pode crescer pra 130-250 chars (não 80 de chat)
- Parágrafo: 2-5 frases, nunca 1 só, nunca 10
- Bullet list onde fala curta cabe
- Caixa-alta em palavra-chave (máx 1-2 por post, nunca em bloco)

## Regras GEO (obrigatórias)

### Pirâmide invertida (REGRA DURA)
Os **primeiros 40-60 termos** do post E de cada seção H2 = resposta DIRETA à pergunta.

Anti-padrão: "A inteligência artificial é uma tecnologia que vem..."
Padrão: "Triagem de e-mail com IA economiza ~45min/dia em CEO de PME. Funciona em 3 passos: X, Y, Z."

### H2s como perguntas literais
Espelhar exatamente o que o ICP digita no ChatGPT ou Google.

Errado: "Configuração avançada do agente"
Certo: "Como configurar um agente que responde no WhatsApp em <5min sem virar spam?"

### Densidade factual (1+ por seção)
Cada H2 precisa de ao menos UMA de:
- Número/métrica específica
- Nome de cliente ou ferramenta
- Resultado mensurável
- Citação de fonte verificável

### FAQ obrigatório
5-8 perguntas que o ICP faz no ChatGPT/Perplexity sobre o tema.
Cada resposta: 60-120 palavras, autocontida.
Formatar como `**Pergunta?**` seguido do parágrafo de resposta.

## Validar `related` contra posts reais

Nunca inventar slug em `related`. Antes de fechar o frontmatter:
1. Confirmar que o repo `C:\repos\expertintegrado-blog` está clonado na máquina atual.
2. Se estiver: `ls src/content/blog/` (dentro do repo) e escolher 2-3 slugs que existem de fato ali, coerentes com o tema.
3. Se o repo NÃO estiver clonado nesta máquina (ex: máquina do Eric é onde o repo mora): não inventar slug nenhum. Avisar no relatório final que `related` ficou vazio/provisório e precisa ser preenchido com slugs reais na máquina onde o repo existe.

## Estrutura MDX

```mdx
---
title: "<título>"
description: "<meta description 1-2 frases>"
pubDate: YYYY-MM-DD
pillar: produtividade|vendas|vibe-coding|lideranca
tipo: pilar|satelite|versus|case
status: published
heroImage: "/images/<slug>-hero.png"
heroAlt: "<descrição da imagem>"
readingTime: "X min de leitura"
tags: [<tags>]
related: [<slugs>]
---

import InlineCta from '../../components/InlineCta.astro';

<p class="lead">[Parágrafo de abertura sem "Olá" — gancho forte, número ou situação real. 80-120 palavras.]</p>

[Parágrafo de contexto rápido antes do primeiro H2, 60-100 palavras]

## [H2 como pergunta literal 1]

[Resposta direta nos primeiros 40-60 termos. Depois desenvolver. 150-250 palavras com 1+ fato.]

## [H2 como pergunta literal 2]

[Idem...]

[InlineCta no meio do post, depois de 3-4 H2s:]

<InlineCta
  title="[Título do CTA — específico pro tema]"
  description="[Descrição 1-2 frases]"
  ctaLabel="[Ação clara]"
/>

## [Continua H2s...]

## Perguntas frequentes

**[Pergunta 1 — literal do ICP]?**

[Resposta 60-120 palavras, autocontida, referencia o post ou context específico]

**[Pergunta 2]?**

[...]

[Mais 3-6 FAQs...]

[Parágrafo de fechamento (2-3 frases). Usa "Bora testar?" ou "Faz sentido?" ou "Me conta no WhatsApp se rodou". Nunca "Espero que..."]
```

## Extensão por tipo
- Satélite: 1200-2500 palavras
- Versus: 1800-2800 palavras (incluir tabela comparativa)
- Case: 1500-2500 palavras (estrutura: problema, abordagem, resultados, o que não funcionou)
- Pillar: 2500-4000 palavras (12-18 H2s)

## Estrutura especial: VERSUS

```
H1: "X vs Y: qual usar em <contexto específico>"
↓ TL;DR honesto: "Use X se A; use Y se B; nenhum se C"
H2: O que é X (1 parágrafo)
H2: O que é Y (1 parágrafo)
H2: Tabela comparativa escaneável (8-12 linhas)
H2: Quando X ganha (com case ou número)
H2: Quando Y ganha (com case ou número)
H2: Quando nenhum dos dois resolve
H2: O que eu (Eric) uso e por quê
↓ CTA: diagnóstico WhatsApp
↓ FAQ
```

Tom: consultor imparcial. Se vender o próprio produto: "isso aqui é o que eu vendo, por isso minha opinião tem viés — mas eis o que aprendi".

## Estrutura especial: CASE STUDY

```
H1: "<resultado tangível> em <prazo>: como <quem> aplicou <método>"
H2: O problema (números reais: tempo gasto, custo, dor)
H2: A abordagem (método passo a passo, sem ocultar trade-offs)
H2: Os resultados (métrica vs baseline)
H2: O que NÃO funcionou (frontalidade — sem isso parece propaganda)
H2: O que aprendi / depoimento
↓ CTA: diagnóstico WhatsApp
↓ FAQ
```

## Datas de publicação

Cadência: ~3 posts/semana (seg, qua, sex).

Antes de fixar `pubDate`, checar as datas já usadas pelos posts existentes (se o repo `C:\repos\expertintegrado-blog` estiver clonado nesta máquina: `grep -h pubDate src/content/blog/*.mdx`) e escolher a próxima data livre na cadência seg/qua/sex, sem colidir com post já publicado ou agendado. Se o repo não estiver disponível nesta máquina, perguntar ao Eric qual a próxima data livre em vez de supor um intervalo fixo.

## Como usar

```
/marketing:agente-draft-blog

[outline do post aqui]
```

O agente lê o outline e retorna o MDX completo, pronto pra salvar.
