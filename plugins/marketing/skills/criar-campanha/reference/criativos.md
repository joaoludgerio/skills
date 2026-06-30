# Criativos — imagens (Nano Banana) e vídeo (criar-reel)

Padrão da casa: **Nano Banana MCP é o método padrão de imagem** (memória `criativos-html-nao-canva`).
Canva AI é **proibido**. HTML/CSS+Playwright só como último fallback se o Nano Banana falhar.

## Regras gerais de criativo

- **Uma dor por criativo** — nunca várias.
- **Congruência:** o que o criativo promete, a landing entrega.
- Headline/gancho no topo; máx. 5-7 palavras na headline visual; incluir um **dado numérico** quando der.
- Todo texto que entra na imagem: **português acentuado correto** (VÍDEO, CÓDIGO, É, VOCÊ, NÃO,
  ATENÇÃO…). Memória `thumbs-portugues-acentuacao` — nunca tirar acento "pra evitar encoding". Se sair
  malformado, regerar.
- Estilo visual Expert: dark, moderno, profissional. Fundo escuro (#0A0A0A) com azul (#5B7BF7) de
  destaque, igual ao site do Eric. Transmitir autoridade em IA, sem visual amador.

## Ângulos por produto (escolha 1 por criativo)

Puxe da lista em `produtos.md`. Resumo:
- **Mentoria:** autoridade Eric / salto de patamar / círculo de empresários / IA como alavanca de decisor.
- **Super SDR:** custo SDR humano vs IA (R$67 vs R$480) / lead esfriando fora do horário / CRM furado /
  case PSP (23 contratos em 60 dias) / 4 SDRs → 1.
- **Agentes IA:** imposto invisível / custo da tarefa manual / processo que trava crescimento.
- **Cursos R$97:** resultado rápido por R$97 / "usar IA de verdade" / ROI imediato.

---

## Imagens estáticas — Nano Banana

Tool: `mcp__nanobanana-mcp__gemini_generate_image` (Nano Banana Pro por padrão; se quota falhar, flash).

**Specs Meta:**
- Feed quadrado: **1080x1080** (use `set_aspect_ratio` 1:1)
- Feed vertical: **1080x1350** (4:5)
- Stories/Reels: **1080x1920** (9:16)
- Texto cobrindo no máx. ~20% da área (regra antiga do Meta, ainda boa prática); deixar margem de
  segurança nas bordas (não colar texto onde a UI do Reels/Stories sobrepõe).

**Prompt de 5 componentes** (escreva o prompt em inglês para a cena, mas o TEXTO que aparece na peça
em PT-BR acentuado):
1. **Sujeito/cena** — o que aparece (Eric, mockup de WhatsApp, gráfico de custo, empresário etc.)
2. **Texto na peça** — headline exata em português acentuado, entre aspas, dizendo onde fica
3. **Estilo** — dark, moderno, tech, profissional; paleta #0A0A0A + #5B7BF7
4. **Composição/formato** — aspect ratio, hierarquia (headline topo, dado no centro, CTA embaixo)
5. **Mood** — autoridade, credibilidade, sem clipart, sem cara de banco de imagem

Gere uma peça por ângulo do plano. Salve cada uma em `campanhas/<...>/criativos/` com nome
descritivo (ex: `super-sdr_custo-reuniao_1080x1350.png`). Confira o texto renderizado antes de aprovar.

---

## Vídeo — skill `criar-reel`

Quando o plano da Fase 1 pedir vídeo, **não reinvente** — chame a skill `criar-reel`, que já produz
o vídeo do Eric pronto pra postar (roteiro na voz do Eric, fala via ElevenLabs, lip-sync HeyGen,
B-rolls, legenda amarela queimada).

Como usar:
1. Passe pra `criar-reel` a **pauta/ângulo** do criativo de vídeo (ex: "custo de um SDR humano vs
   Super SDR, com o case PSP"), deixando claro que é **anúncio** (CTA de ad: "clique em saiba mais",
   não "comenta").
2. A skill entrega o `.mp4`. **Copie/mova** o arquivo final pra `campanhas/<...>/criativos/`.
3. Para ad, vídeo ideal: **30-60s**, gancho nos **3 primeiros segundos**, legenda queimada, CTA verbal
   + o botão do anúncio cobre o CTA clicável.

> Vídeo é caro/demorado (HeyGen + ElevenLabs + Kling). Gere vídeo só quando o plano pedir e o João
> aprovar no Checkpoint 1. Para a maioria dos testes, comece com estáticos e adicione vídeo no que escalar.

## Quantos criativos?

Veja `budget.md` — o nº de criativos escala com a verba. Regra base: **2-4 estáticos** por conjunto
no teste; vídeo entra quando há verba pra alimentar o aprendizado de mais de um formato.
