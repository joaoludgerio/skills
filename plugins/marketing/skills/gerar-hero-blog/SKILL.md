---
name: gerar-hero-blog
description: Gera imagem hero pra post(s) do blog expertintegrado.com.br/blog via OpenAI gpt-image-2 (NUNCA gpt-image-1), no estilo editorial azul da marca, converte pra WebP (~60KB) e atualiza heroImage+heroAlt no frontmatter MDX. TRIGGER quando Eric pedir "gera o hero do post X", "cria a imagem de capa", "hero pro blog", ou quando o pipeline de producao de conteudo precisar da imagem de capa de um post.
---

# Gerar Hero — Blog Expert Integrado

Skill que cria a imagem de capa (hero) de um post do blog em `expertintegrado.com.br/blog` (Astro, repo `C:\repos\expertintegrado-blog`), no estilo visual coeso da marca, otimizada pra web, e ja conectada ao frontmatter do post.

Complementa a skill [[agente-draft-blog]] (que escreve o MDX): draft escreve o texto, esta gera a capa.

## Quando ativar
- Eric pede "gera o hero do post X", "cria a imagem de capa", "hero pro blog".
- Um post novo foi escrito (via agente-draft-blog) e precisa de capa.
- Batch: vestir varios posts sem hero de uma vez.

## REGRA INEGOCIAVEL: modelo de imagem
- **SEMPRE `gpt-image-2`. `gpt-image-1` esta PROIBIDO em qualquer circunstancia, nem como fallback** (decisao do Eric, 26/06/2026).
- Se `gpt-image-2` falhar/indisponivel: PARAR e avisar o Eric. Nunca cair pra image-1.
- Custo medido: ~US$0,165 (~R$0,85) por imagem em HIGH 1536x1024 (~5.488 tokens). 100 imagens ~R$88. Brain: nota `3oh96mtgtl1f` e `ph2qohd66nhh`.
- Chave: `OPENAI_API_KEY` (env, ou `op read "op://Agentes Eric/OPENAI_API_KEY/credential"`).

## Antes de gerar por IA: checar as 3 fontes (Brain `xi4pg15yw50a`)
A imagem nao e sempre IA. Ordem de preferencia:
1. **Foto real do Eric** — posts pessoais/reflexao/cases vividos por ele.
2. **Asset original de pasta** — screenshot real de produto, print de demo, foto de evento ja existente.
3. **Gerada por IA** (gpt-image-2) — default pra conceito abstrato/tema sem foto. So cair aqui quando nao houver fonte real adequada.

## Direcao de arte (estilo da marca)
- Flat-vector editorial com leve profundidade/grao, muito espaco negativo, levemente isometrico.
- Paleta TRAVADA: fundo off-white quente `#FBFAF7`, azul eletrico `#2742E8` dominante, periwinkle `#5B73FF` em apoio, charcoal `#17171B` no traço fino.
- **SEM texto, letras, numeros, logos, mockups de UI.** 1 sujeito conceitual central com respiro.
- 1536x1024 paisagem, qualidade `high`.

## Fluxo
1. **Montar o conceito visual** (em ingles, 1 frase) a partir do tema do post — algo concreto e sem texto. Ex: post "IA na rotina do CEO" -> "a CEO's day compressed into a single glowing hour, a refined clock with AI orbs handling scattered tasks".
2. Rodar o script:
   ```
   python scripts/gerar-hero.py --slug <slug-do-post> --concept "<conceito em ingles>"
   ```
   - `--all-missing` gera pra todos os posts sem hero (idempotente, pula PNG/WebP existente).
   - `--alt "<texto>"` opcional; sem ele, gera heroAlt acentuado a partir do titulo.
   - `--blog-dir` opcional (default `C:\repos\expertintegrado-blog`). Se o repo não estiver clonado nesse caminho na máquina atual (ex: máquina do João, onde o repo não existe), NÃO rodar o script achando que vai falhar silenciosamente: primeiro checar se o repo está clonado em outro caminho e passar `--blog-dir <caminho-real>`, ou, se não estiver clonado em lugar nenhum, avisar e parar em vez de tentar gerar a imagem sem ter onde salvar o MDX/frontmatter.
3. O script: gera via gpt-image-2 HIGH -> converte pra WebP q82 (~60KB, -97% vs PNG) -> salva `public/images/<slug>-hero.webp` -> insere/atualiza `heroImage` + `heroAlt` no frontmatter (acentuacao correta).
4. Validar: `npm run build` no repo do blog (0 erros) antes de commit/deploy.

## Notas
- heroAlt e texto EXTERNO (SEO/acessibilidade) -> acentuacao correta do portugues SEMPRE.
- OG social NAO usa o hero: o PostLayout usa a `og/[slug].png` dedicada (1200x630). Nao mexer nisso.
- Deploy de producao do blog: token `Token_Vercel_Produto_Claude_Eric` do 1P (o `VERCEL_API_TOKEN` generico NAO acessa o team do blog).
