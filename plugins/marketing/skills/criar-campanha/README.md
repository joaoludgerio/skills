# /criar-campanha — Campanha de Meta Ads de ponta a ponta

> Cria uma campanha de tráfego pago no Meta Ads do zero ao ar (publicada PAUSADA): estratégia, público, budget, copy, criativos e a estrutura montada na conta, pronta pra você revisar e dar play.

## O que faz

Esta skill assume o papel de "Gestor de Tráfego da Expert Integrado" e leva uma campanha do briefing até estar **criada de verdade dentro da conta do Meta Ads** — mas sempre PAUSADA. Ela cuida de tudo:

- Entende qual dos 4 produtos você quer anunciar e qual o objetivo.
- Sugere o público, a estrutura (campanha/conjuntos) e o budget, já fazendo a conta de viabilidade (quanto pode custar um lead/venda pra valer a pena).
- Escreve toda a copy dos anúncios no tom da Expert (texto, título, descrição, CTA).
- Gera os criativos: imagens (Nano Banana) e, quando faz sentido, vídeo do Eric (via a skill criar-reel).
- Cria a campanha, os conjuntos, os criativos e os anúncios na conta — tudo pausado.
- Entrega um relatório com os IDs e os links diretos do Gerenciador.

## Quando usar

Use quando você quiser subir um anúncio pago. Exemplos de pedido reais:

- "Cria uma campanha do Super SDR"
- "Monta um anúncio da mentoria"
- "Campanha de tráfego pago pros cursos de IA de R$97"
- "Sobe uma campanha no Meta pros Agentes de IA"
- "Quero anunciar o [produto]" / colar um briefing de campanha pronto

## O que você precisa dar

Na conversa, a skill pergunta só o que faltar (no máximo 4 perguntas):

1. **Produto** — Mentoria (high ticket), Super SDR, Agentes de IA pra empresas, ou Cursos de IA (R$97).
2. **Objetivo** — leads, conversas no WhatsApp, vendas diretas ou agendamento.
3. **Budget** — verba diária OU total + período. Se você não souber, ela sugere (padrão honesto de teste: R$50/dia por 7 dias).
4. **Destino** — o link exato da landing/checkout, ou WhatsApp/formulário de lead. (A skill nunca inventa o link — confirme com ela.)

## O que ela entrega

- Uma pasta organizada da campanha (`campanhas/AAAA-MM-DD_produto_tema/`) com a estratégia, a copy, os criativos e o relatório.
- As imagens prontas (.png) e, se o plano pedir, o vídeo do Eric (.mp4).
- A campanha inteira montada na conta do Meta Ads.

**Importante:** a campanha é publicada **PAUSADA**. Nada entra em entrega automaticamente. A skill nunca liga o anúncio — quem dá play é você, no Gerenciador de Anúncios, depois de revisar tudo. É só abrir, conferir e clicar em ativar quando estiver satisfeito.

## Como funciona (passo a passo resumido)

A skill trabalha em fases e **para em 4 checkpoints** pra você aprovar antes de seguir — nada é produzido ou publicado sem o seu "pode seguir":

1. **Briefing** — entende produto, objetivo, budget e destino.
2. **Estratégia** — monta público, estrutura e budget, com a conta de viabilidade. → *você aprova*
3. **Copy** — escreve o texto de cada anúncio. → *você aprova*
4. **Criativos** — gera as imagens (e o vídeo, se for o caso). → *você aprova*
5. **Publicação** — cria a campanha PAUSADA no Meta e entrega o relatório com IDs e links. → *você confere e dá play quando quiser*

## Integrações e ferramentas

- **Meta Ads (MCP oficial do Marketing API)** — cria campanha, conjuntos, criativos e anúncios direto na conta.
- **Nano Banana (MCP)** — gera as imagens estáticas dos criativos (padrão da casa; Canva AI é proibido).
- **criar-reel (skill)** — quando o plano pede vídeo, ela chama essa skill, que entrega o vídeo do Eric pronto (roteiro, voz, lip-sync, B-rolls e legenda).
- **Graph API do Meta** — usada só pra subir a mídia (imagem/vídeo) e obter as referências que o anúncio precisa.

## Pré-requisitos

- Acesso à conta de anúncios da Expert Integrado no Meta (já configurada no MCP). O MCP tem autenticação própria, então criar a estrutura funciona normalmente.
- Para **subir mídia** (imagem/vídeo) é usado um **token do Meta que expira a cada 60 dias**. Se ele estiver vencido, a skill avisa e pede pra você renovar (no Gerenciador de Negócios). Sem o token válido, dá pra contornar promovendo um post que já exista no Instagram/Facebook.
- Os MCPs de Nano Banana e (se for usar vídeo) os da skill criar-reel precisam estar ativos.
- Para campanha de **venda direta** (cursos R$97), o pixel/dataset de compra precisa estar configurado na conta pra otimizar pelo evento certo.

> Observação de segurança: o README não traz chaves, tokens nem IDs sensíveis. Esses valores ficam guardados nos arquivos de configuração da skill e nunca devem ser copiados pra cá.

## Dicas e observações

- A pasta `reference/` é o "cérebro" da skill e vale a leitura se você quiser entender (ou ajustar) as decisões:
  - `produtos.md` — os 4 produtos: público, objetivo, ângulos e lógica de budget de cada um.
  - `budget.md` — metas de CPL/CAC, quanto a verba define a estrutura, e a sugestão padrão de teste.
  - `copy.md` — tom de voz da Expert, palavras proibidas, limites de caracteres e frameworks de copy.
  - `criativos.md` — ângulos de criativo, a receita de prompt de imagem e o fluxo de vídeo.
  - `meta-config.md` — IDs da conta, a sequência de chamadas do Meta e o padrão de nomes (naming).
- **Tudo nasce PAUSADO** — pode rodar a skill tranquilo, ela não vai gastar verba sozinha.
- Regra de ouro do conteúdo: tom Expert (sem hype, dados sempre, "você" e não "tu", português com acentuação) e **nunca prometer resultado específico** — vale pra toda a copy e todo texto que entra num criativo.
- CTA aqui é de **anúncio** ("clique em saiba mais", "link aqui"), nunca CTA orgânico ("comenta X", "manda DM").
- Uma dor por criativo, e o criativo tem que bater com o que a landing entrega.
- Depois de subir a campanha, deixe rodar pelo menos ~7 dias (fase de aprendizado) antes de julgar, cortar ou escalar.
