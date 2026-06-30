# /criar-webinario — Funil completo de live/webinário gratuito

> Pega uma ideia de live gratuita e entrega o funil inteiro pronto pra rodar: landing page com teste A/B + pixel, criativos, campanha no Meta (pausada), sequência de lembretes no WhatsApp e o plano de análise pós-live.

## O que faz
Documenta e executa o processo ponta a ponta de um webinário de tráfego pago — da definição do tema até
a otimização da próxima edição. Foi escrita a partir da 1ª edição real (live "Imposto Invisível",
jun/2026), então cada fase já vem com os **aprendizados que custaram caro** (o erro de pixel que inflou
os leads, a fórmula de criativo que converteu, o que mais derruba presença). Orquestra skills que já
existem (`criar-campanha`, `criar-reel`, Nano Banana) e adiciona os passos próprios do funil.

## Quando usar
- "cria um webinário" / "monta a live"
- "lança a próxima edição da aula gratuita"
- "campanha de webinar"
- colar um briefing de live/webinário

## O que você precisa dar
- **Tema e promessa** da live (o que a pessoa sai sabendo).
- **Oferta do fim da live** (o que gera o agendamento — ex: mentoria, Super SDR).
- **Data, horário e plataforma** (ex: Zoom) e o **link de agendamento** (Calendly/RD).
- **Bônus** exclusivo pra quem está ao vivo (alavanca de presença).

## O que ela entrega (tudo na pasta do webinário)
- `brief.md` — a definição travada.
- `lp-a.html` e `lp-b.html` — duas landing pages pro **teste A/B** (geradas a partir de `templates/lp.html`, mudam só o headline), com pixel; + `confirmacao.html`.
- `criativos/` — vídeos (via `criar-reel`) + estáticos (Nano Banana).
- Campanha no Meta criada e **PAUSADA** (você revisa e dá play).
- `lembretes.md` — sequência de 4 toques no WhatsApp pronta.
- `analise-pos-live.md` — relatório do funil + plano da próxima edição.

## Como funciona (8 fases)
1. **Definição** — tema, oferta, data, links, bônus.
2. **Landing page A/B** — gera 2 variantes a partir dos **templates HTML prontos** em `templates/`
   (`lp.html` + `confirmacao.html` + `pixel-snippet.html`, estrutura de alta conversão) pra hospedar (Cloudflare Pages/Vercel).
3. **Pixel & tracking** — evento de registro EXCLUSIVO do funil (pra não contaminar com outro site).
4. **Criativos** — vídeos e estáticos na fórmula da "cena concreta".
5. **Campanha no Meta** — 2 conjuntos (frio + remarketing), otimizando na conversão certa, pausada.
6. **Lembretes no WhatsApp** — 4 toques (maior alavanca de presença).
7. **Dia da live** — checklist e CTA de agendamento claro.
8. **Pós-live** — relatório do funil e scripts da próxima edição.

## Integrações e ferramentas
- Skills: `criar-reel` (vídeos), `criar-campanha` (campanha base), Nano Banana (estáticos).
- MCPs: **Meta Ads** (`ads_*`), **WhatsApp** (`whatsapp_*`), e a plataforma de inscritos.
- Hospedagem da LP: Cloudflare Pages ou Vercel.

## Pré-requisitos
- As skills acima instaladas e os MCPs de Meta Ads e WhatsApp conectados (cada um com **suas** credenciais).
- Acesso ao Gerenciador de Eventos do Meta pra configurar o pixel/conversão personalizada.
- Voice guide de quem aparece nos criativos (esta skill usa o do Eric por padrão; troque pelo da sua marca).

## Dicas e observações
- **A maior alavanca não custa mídia: presença ao vivo.** A 1ª edição teve 80% de no-show — a sequência
  de lembretes é o que mais recupera gente. Não pule a Fase 6.
- **Cada funil tem o SEU evento de pixel.** Reusar o evento `Lead` genérico entre dois sites contamina os
  números (foi o que inflou os leads na 1ª edição). Leia `references/pixel-e-tracking.md`.
- **Criativo abre com cena concreta**, não pergunta abstrata ("toda segunda alguém perde 3h num
  relatório" converteu 17×mais que "quanto custa sua hora?").
- ⚠️ **Esta skill é específica da Expert Integrado** (ICP "20+ funcionários", pixel/URLs e voz do Eric).
  Ao reusar em outra marca, troque o ICP, o pixel, as URLs e o voice guide. Nenhuma chave/token está aqui.
