---
name: agente-publisher-blog
description: Publica post MDX aprovado no blog expertintegrado.com.br/blog. Puxa o repo, salva arquivo em src/content/blog/, faz git commit+push, roda deploy manual na Vercel e confirma que o post novo está no ar, salva nota no Expert Brain, e atualiza cross-links nos posts relacionados. TRIGGER quando Claude ou Eric pedir "publica o post", "faz o deploy do artigo", "sobe o post" após revisão aprovada.
---

# Agente Publisher Blog — Expert Integrado

Skill que executa pipeline completo de publicação: arquivo → git → Vercel → Brain → cross-links.

## Quando ativar

- Draft foi aprovado pelo `agente-revisor-blog`
- Eric pede "publica o post", "faz o deploy do artigo", "sobe o post"
- Pipeline batch terminou batch de revisão com APROVADO

## Pré-requisito

Post deve ter sido revisado pelo `agente-revisor-blog` com veredicto APROVADO ou RETRABALHO MENOR. Nunca publicar com RETRABALHO MAIOR.

## Input esperado

1. `slug`: identificador do post
2. MDX aprovado (conteúdo completo)
3. `related`: lista de slugs dos posts relacionados (pra cross-link inverso)

## Pipeline de publicação

### Passo 0: Atualizar o repo local

```bash
cd C:\repos\expertintegrado-blog
git pull --ff-only
```

Dono trabalha multi-máquina: sempre puxar antes de editar arquivo (post novo e posts relacionados), senão o commit pode divergir ou sobrescrever mudança feita em outra máquina.

### Passo 1: Salvar arquivo MDX

```
Salvar em: C:\repos\expertintegrado-blog\src\content\blog\<slug>.mdx
```

Verificar que:
- Frontmatter está completo (title, description, pubDate, pillar, tipo, status: published)
- Import do InlineCta presente se usado
- Sem placeholders não preenchidos

### Passo 2: Git commit + push

```bash
cd C:\repos\expertintegrado-blog
git add src/content/blog/<slug>.mdx
git commit -m "feat(blog): post <slug>

Publish: <título curto>
Pillar: <pillar>
Tipo: <tipo>"
git push
```

Verificar que o push foi bem-sucedido antes de continuar.

### Passo 3: Deploy manual na Vercel

O blog NÃO tem auto-deploy no push. É preciso rodar o deploy manualmente:

```bash
cd C:\repos\expertintegrado-blog
npx vercel deploy --prod --yes --token "<token>"
```

Token: item 1Password `Token_Vercel_Produto_Claude_Eric` (`op read "op://Agentes Eric/Token_Vercel_Produto_Claude_Eric/credential"` ou equivalente). Não usar `VERCEL_API_TOKEN` genérico, ele não acessa o team do blog.

**Verificar que o post NOVO está no ar (não só que o site responde 200, isso dá falso positivo porque o build antigo também responde 200):**

```bash
curl -sL -o /dev/null -w "%{http_code}" --max-time 30 https://expertintegrado.com.br/blog/<slug>
```

Isso sozinho não prova nada se o slug ainda não existir no build anterior e o deploy falhar silenciosamente. Por isso, confirmar TAMBÉM um dos dois:
- Grep do slug no sitemap: `curl -sL --max-time 30 https://expertintegrado.com.br/sitemap.xml | grep <slug>` (se aparecer, o build novo está publicado).
- Ou abrir a página via Playwright e checar que o `<title>` renderizado bate com o título do post novo (não com um post antigo).

Se depois de ~2min do deploy o slug não aparecer no sitemap nem a página bater o título esperado: NÃO reportar sucesso. Reportar "deploy não confirmado" e investigar `vercel logs` antes de tentar de novo.

### Passo 4: Atualizar cross-links nos posts relacionados

Para cada slug em `related`:

1. Ler arquivo `src/content/blog/<slug-relacionado>.mdx`
2. Verificar se o frontmatter `related` já inclui o novo slug
3. Se não inclui: adicionar o novo slug ao array `related`
4. Salvar arquivo atualizado
5. Commit individual: `fix(blog): cross-link bidirecional <slug-relacionado> ↔ <slug-novo>`

Após todos os cross-links:
```bash
git push
```

### Passo 5: Salvar nota no Expert Brain

```
mcp__expert-brain__save_note(
  title: "Post publicado: <título>",
  kind: "fact",
  domains: ["marketing", "ai-applied"],
  body: "Post #X do blog Expert Integrado publicado em 2026-MM-DD.
URL: https://expertintegrado.com.br/blog/<slug>
Pillar: <pillar> | Tipo: <tipo>
Keyword alvo: <kw>
Posts relacionados: <lista de slugs>
Cross-links atualizados: <lista>",
  tldr: "Blog post '<título>' publicado em expertintegrado.com.br/blog/<slug>"
)
```

### Nota sobre index de publicados

Não existe um passo de "atualizar outputs/blog-publicados-2026.md no repo expert-brain": o Expert Brain é um MCP (grafo de conhecimento em Cloudflare), não um repositório git, não tem arquivo pra editar. O registro do post publicado é a própria nota salva no Passo 5 (`mcp__expert-brain__save_note`); ela já funciona como índice de publicados (consultável via `mcp__expert-brain__recall`). Não há passo 6.

## Relatório de publicação

Ao final, reportar:

```
✓ Publicado: <slug>
URL: https://expertintegrado.com.br/blog/<slug>
Git: <commit hash>
Vercel: OK (slug confirmado no sitemap / título confere)
Brain: nota <id>
Cross-links: <lista de slugs atualizados>
```

## Como usar

```
/marketing:agente-publisher-blog

Slug: <slug>
Related: [<slug1>, <slug2>, ...]

[MDX completo aprovado aqui]
```

O agente executa o pipeline completo e reporta resultado.

## Tratamento de erros

| Erro | Ação |
|---|---|
| Git pull falha (conflito) | Investigar conflito, resolver antes de editar qualquer arquivo |
| Git push falha | Investigar conflito, resolver, retomar do push |
| Slug não aparece no sitemap após deploy | Checar `vercel logs`, checar frontmatter do MDX, rodar deploy de novo |
| Deploy falha (build error) | Checar erros de build (import inválido, sintaxe MDX) via `vercel logs` |
| Brain timeout | Tentar novamente (Brain D1 eventually consistent) |
| Arquivo relacionado não existe | Skip cross-link, registrar no relatório como pendente |
