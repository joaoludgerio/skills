---
name: agente-revisor-blog
description: Revisa post MDX do blog Expert Integrado verificando 4 dimensões: drift de voz (Eric Luciano v1.4), factualidade (sem claim sem fonte), GEO/SEO (pirâmide invertida, H2 como perguntas, FAQ), e UX mobile (parágrafos curtos, nenhum bloco de texto denso). TRIGGER quando Claude ou Eric pedir "revisa o post", "checka o draft", "audita o MDX".
---

# Agente Revisor Blog — Expert Integrado

Skill que faz auditoria de 4 dimensões em draft MDX e devolve: lista de violações (max 10), score 1-10 por dimensão, e patch sugerido para cada violação.

## Quando ativar

- Pipeline de produção terminou o draft e pede revisão
- Eric pede "revisa o post", "checka o draft", "audita o MDX"
- Antes de qualquer commit/deploy de post novo

## Input esperado

Conteúdo MDX completo (frontmatter + body) do post a revisar.

## Output

Relatório estruturado com:
1. Score por dimensão (1-10)
2. Violações encontradas (máx 10)
3. Patch sugerido pra cada violação
4. Veredicto: APROVADO | RETRABALHO MENOR | RETRABALHO MAIOR

## As 4 dimensões de revisão

### Dimensão 1: VOZ (peso 40%)

**Verificar presença de red flags:**
- Em-dash (—) no texto → substituir por vírgula/dois-pontos/parênteses
- "tu" / "teu" / "tua" → substituir por "vc" / "você"
- Hype vazio: "revolucionário", "transformador", "disruptivo", "game changer", "muda tudo"
- Abertura com "Olá", "Neste artigo", "Hoje vamos falar sobre"
- Fechamento com "Espero que esse post te ajude", "Até a próxima", "Não se esqueça de"
- Headlines "Aprenda a..." / "Descubra como..."
- Tom formal demais: "dessa forma", "portanto", "entretanto", "outrossim"
- Softening excessivo: "talvez", "pode ser que", "quem sabe", "de certa forma"

**Verificar presença de elementos positivos:**
- Pelo menos 1 uso de "vc"/"você" ou "a gente" no body
- Pelo menos 1 expressão de frontalidade ("Não acho que X", "Sendo bem sincero...")
- Pelo menos 1 especificidade: número real, nome de cliente/empresa/ferramenta

### Dimensão 2: FACTUALIDADE (peso 25%)

**Verificar:**
- Claims quantitativos sem fonte → sinalizar ("73% das PMEs" — de onde?)
- Comparações de ferramentas com dados desatualizados → sinalizar
- Casos/nomes de clientes que precisam de autorização → sinalizar
- Afirmações sobre produtos/serviços que podem ter mudado → sinalizar
- Placeholder não preenchido ([NOME], [NÚMERO], [LINK]) → bloquear publicação

### Dimensão 3: GEO/SEO (peso 25%)

**Verificar:**
- Primeiros 40-60 termos do post: são resposta direta? Ou são introdução genérica?
- Primeiros 40-60 termos de CADA H2: resposta direta ou "Nesta seção..."?
- H2s: são perguntas literais? Ou são títulos vagos?
- Densidade factual: cada H2 tem ao menos 1 número, nome ou resultado?
- FAQ presente? Tem 5+ perguntas? Respostas 60-120 palavras?
- Extensão adequada pro tipo? (satélite 1200+, pilar 2500+, versus 1800+, case 1500+)
- `related` no frontmatter: aponta pra slugs que existem? Checar rodando `ls src/content/blog/` no repo `C:\repos\expertintegrado-blog` (se o repo não estiver clonado nesta máquina, sinalizar como "não verificável nesta máquina" em vez de assumir que os slugs existem).

### Dimensão 4: UX MOBILE (peso 10%)

**Verificar:**
- Parágrafo com mais de 5 frases → sinalizar como bloco pesado
- Mais de 3 parágrafos seguidos sem bullet, número, tabela ou imagem
- Frase com mais de 250 chars sem ponto ou vírgula
- H2 muito longo (mais de 80 chars) → sugerir versão curta
- Tabela sem cabeçalho ou com mais de 12 linhas → sinalizar

## O que conta como violação GRAVE (definição objetiva)

Uma violação é **grave** quando é qualquer item da Dimensão 1 (Voz, red flag listado) OU qualquer item da Dimensão 2 (Factualidade). Ou seja: em-dash, "tu/teu/tua", hype vazio, abertura/fechamento clichê, headline clichê, tom formal, softening excessivo, claim sem fonte, dado desatualizado, nome sem autorização, afirmação que pode ter mudado, e placeholder não preenchido são todos GRAVES.

Uma violação é **normal** (não grave) quando é item da Dimensão 3 (GEO/SEO) ou da Dimensão 4 (UX Mobile): H2 não é pergunta, densidade factual fraca, FAQ curto, extensão fora do range, parágrafo longo, tabela sem cabeçalho, etc.

## Critérios de veredicto

| Veredicto | Critério |
|---|---|
| APROVADO | Score médio ≥ 7.0 em todas as dimensões, nenhuma violação grave |
| RETRABALHO MENOR | Score médio ≥ 5.5, zero violações graves, ≤5 violações normais |
| RETRABALHO MAIOR | Score médio < 5.5 OU placeholder não preenchido OU 1+ violação grave OU >5 violações no total |

## Formato do relatório

```
## Revisão: <slug>

| Dimensão | Score | Status |
|---|---|---|
| Voz | X/10 | ✓/⚠/✗ |
| Factualidade | X/10 | ✓/⚠/✗ |
| GEO/SEO | X/10 | ✓/⚠/✗ |
| UX Mobile | X/10 | ✓/⚠/✗ |
| **Média** | **X/10** | APROVADO/RETRABALHO |

### Violações encontradas

1. **[Dimensão] — [tipo]**: [trecho exato do texto]
   → Patch: [correção sugerida]

2. ...

### Veredicto
[APROVADO | RETRABALHO MENOR | RETRABALHO MAIOR]
[Se RETRABALHO: quais violações são bloqueadoras vs opcionais]
```

## Como usar

```
/marketing:agente-revisor-blog

[MDX completo do post aqui]
```

O agente retorna o relatório com score + lista de violações + patches sugeridos.
