# Landing page do webinário — HTML, A/B e hospedagem

A skill (você) **gera as landing pages em HTML** a partir dos templates em `templates/`. Duas variantes
pra teste A/B.

## Templates prontos (em `templates/`)
- `lp.html` — landing page completa (estrutura de alta conversão, estilo dark+âmbar da marca).
- `confirmacao.html` — página de obrigado; é **onde dispara o evento de registro** do pixel.
- `pixel-snippet.html` — o pixel comentado + passo a passo da conversão personalizada.

Pra gerar uma edição: copiar os templates, trocar os tokens `{{ASSIM}}`, e gerar **`lp-a.html`** e
**`lp-b.html`** mudando o `{{HEADLINE}}` (a variável do A/B) **e** o `{{VARIANTE}}` do hidden input
(`"a"` no lp-a.html, `"b"` no lp-b.html). Se o `{{VARIANTE}}` ficar igual nos dois arquivos, as duas
LPs carimbam a mesma variante quando a URL não traz `?lp=` e o A/B fica sem medição.

## Estrutura da LP (baseada em boas práticas — fontes no fim)
**Acima da dobra** (o que decide o scroll, ~80% só lê o headline):
- **Headline de BENEFÍCIO**, não de tópico ("Tire X horas da sua operação", não "Webinar de IA").
  Clareza ganha de esperteza. *É a variável que o A/B testa.*
- **Detalhes do evento**: data, hora (com fuso), duração (ideal ≤1h), plataforma (ao vivo no Zoom).
- **CTA contrastante** ("Garanta sua vaga", "Quero participar") — botão âmbar no fundo escuro.
- **Régua de ICP** visível ("pra donos/diretores com +20 funcionários").
- **Formulário** já acima da dobra.

**Meio**: o que vai aprender (3-4 bullets), pra quem é, quem é o Eric (credibilidade), o bônus de quem
está ao vivo.

**Fim**: prova social (depoimentos + contagem), CTA repetido, urgência honesta (vaga limitada/bônus).

**Sempre**: mobile-first (50%+ do tráfego é celular), CTA fixo no mobile, copy escaneável.

## Formulário — quanto MENOS campo, mais conversão
Cada campo a mais derruba a conversão (referências citam até **-50% por campo**). A 1ª edição tinha 7
campos (nome, WhatsApp, empresa, cargo, nº func., conhecimento IA, objetivos) — **exagero**.
- **Manter só o essencial:** nome + WhatsApp + **nº de funcionários** (o único qualificador de ICP que
  vale a fricção). O resto (cargo, objetivos) coletar DEPOIS, no WhatsApp ou na call.
- O `lp.html` já vem com esse formulário enxuto.

## Hospedagem
- **Cloudflare Pages** (preferido — grátis, rápido, João já usa Cloudflare) ou **Vercel**. Fluxo:
  gera HTML → deploy → URL pública por variante (ex: `/lp-a`, `/lp-b`).
- O formulário (`action={{ENDPOINT}}`) aponta pro backend/serviço que grava o lead; no sucesso
  redireciona pra `confirmacao.html` **levando os UTMs e a variante** na URL.

## Como rodar e MEDIR o A/B (a forma confiável de saber o vencedor)
1. **Duas URLs**, uma por variante.
2. **Teste A/B nativo do Meta (split test):** pega um público só, divide em dois grupos que NÃO se
   sobrepõem, manda cada grupo pra uma URL, e dá o vencedor com significância. Isola a LP como única
   variável (mesmo público, mesmo criativo).
3. **Métrica certa = taxa de conversão** (inscrições ÷ visitantes da LP), por variante — NÃO o número
   bruto. Pixel mede visitante (`PageView`) e inscrição (`InscricaoWebinar`).
4. **Marcar a variante** (`?lp=a`/`?lp=b`) — o template já grava no lead e no evento do pixel. Assim dá
   pra comparar downstream: qual variante traz quem **comparece e agenda**, não só quem inscreve.
5. **Não concluir cedo:** ~50-100 conversões por variante. Com ~70 inscritos/edição, testar **uma
   variável grande por vez** (o headline).

## Benchmarks de conversão (referência pós-live)
- LP de webinar converte em média **~22%** (vs ~10% de LP em geral). Tráfego frio de ads: **~30%**.
  Topo de mercado: até **~51%**. Use pra saber se a sua LP está boa ou precisa de A/B mais agressivo.

## O que vale testar (em ordem de impacto)
1. Headline / gancho. 2. Imagem/vídeo do topo. 3. Texto do botão. 4. Nº de campos do formulário.

## Fontes (pesquisa jun/2026)
- HubSpot — 25 Webinar Landing Page Examples (2025)
- aevent — 12 Webinar Landing Page Best Practices
- ProperExpression — Webinar Landing Page: Marketer's Guide
- easywebinar / landerlab — benchmarks de conversão de LP de webinar
