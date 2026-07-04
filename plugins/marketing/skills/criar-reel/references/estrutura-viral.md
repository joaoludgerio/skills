# Estrutura viral — padrão dos vídeos que estouraram (Eric Luciano)

Extraído dos 5 Reels de melhor performance (alucinação, MarkItDown/tokens, Conselho de LLMs,
context rot, comandos escondidos) **e comparado contra 3 flops recentes** (844 a 2.328 views)
— análise completa e ATUALIZÁVEL em `padroes-perfil.md` (sincronizado da nuvem via
`viral-pra-reel/scripts/registro_reels.py --file padroes-perfil.md`; aquele arquivo é a fonte
viva e tem prioridade sobre este esqueleto quando os dois divergirem). Combinar sempre com
`voz-eric.md` (tom, blacklist, frases inteiras).

## 1. Hook = dor que o espectador JÁ sente mas nunca nomeou
Nunca abrir com a ferramenta/novidade. Abrir em **segunda pessoa**, acusando um prejuízo que a
pessoa JÁ está sofrendo AGORA (não uma promessa futura nem um ganho abstrato):
- "O Claude mente para você com confiança, todo dia"
- "Se você joga PDF dentro do Claude, você está queimando token à toa"
- "Ele monta um argumento lindo provando que é genial" (bajulação)
- "Começa inteligente e depois vai ficando lento, confuso" (context rot)

Feche a 1ª ou 2ª frase com um gancho de segredo: "e quase ninguém te conta" / "quase ninguém
sabe" / "passou batido".

**Proibido abrir com** (os 3 flops recentes abriram assim, e flopraram):
- Notícia ou desmentido de manchete ("calma, isso é meio exagero", "todo mundo tá falando de X").
- Pergunta hipotética ou formato de teste ("já parou pra pensar se...").
- Conta abstrata de tempo/produtividade ganha no futuro ("você perde 10 minutos por dia").
- Dor de nicho que não é do usuário comum de Claude (dor de designer, de dev avançado, de caso
  de uso de escala) — a diferença entre hit e flop não é o CTA, é o par hook+tema: hit fala do
  prejuízo imediato e universal; flop fala de novidade de ferramenta pra um nicho.

Teste do hook: a pessoa pensa "CARAMBA, isso acontece comigo" nos primeiros 3 segundos.

## 2. Arco narrativo em 4 atos (sempre)
1. **DANO** — você está perdendo algo concreto (dinheiro, tempo, qualidade) sem saber.
2. **DIAGNÓSTICO** — tem um motivo, "e quase ninguém te conta" (frame de insider; essa frase
   ou variação aparece em 3 dos 4 virais). 2-3 frases técnicas com 1 número específico.
3. **SOLUÇÃO NOMEADA** — tem nome, tem cara, parece legítima.
4. **CTA** — com gatilho de escassez de atenção.

## 3. O momento de batismo (o trecho compartilhável)
Nos 4 vídeos existe a virada "**isso tem nome: X**" (alucinação, context rot, viés de
autoria...). Nomear a dor é o que a pessoa repete pros outros. Se o problema não tem nome
estabelecido, usar o nome técnico mais próximo — nunca pular esse beat.

## 4. Solução sempre concreta, com nome próprio e artefato
- Lista numerada ("são seis regras") · ferramenta com origem ("Markitdown, da Microsoft,
  140 mil estrelas") · autoria ("skill do Ole Lehmann em cima do conselho do Karpathy") ·
  comandos reais ("/clear, /rewind").
- Nunca vago. Sempre algo que a pessoa pode pegar e usar HOJE.
- Quando for ferramenta: dizer que é **de graça** (se for) e o **tempo de setup** ("leva 2
  minutos", "cola uma vez e muda pra sempre") — fricção declarada baixa.

## 5. Números que parecem pesquisados (1-2 por vídeo)
"98,5% dos tokens", "precisão cai de 92% para 78%", "140 mil estrelas", "2-3 mil tokens por
página". Específico > redondo. Conferir os fatos antes (regra da etapa 1 da skill), e batizar
o problema/solução com um nome próprio memorável, de preferência apoiado em autoridade externa
(Microsoft, Anthropic, um nome conhecido) — número + nome é o que cria autoridade e
compartilhamento.

## 6. CTA — SEMPRE palavra-chave, NUNCA "salva e me segue" como formato principal
Dado real (5 hits): a palavra-chave rendeu até 8,58% de comentário por view; o único hit que
usou "salva e me segue" rendeu 0,04% (168K views, só 63 comentários) — maior alcance, quase
zero lead. **Regra: sempre CTA de comentar uma palavra**, seguindo esta fórmula:
- A palavra é um **substantivo simples já repetido no vídeo**, ligado ao tema (ex.: "markdown",
  "conselho", "comandos"). Nunca jargão novo ou nome de marca desconhecida (ex.: nunca "SLOP",
  nunca "REMOTION") — a pessoa tem que conseguir digitar de cabeça, sem reler a legenda.
- A entrega prometida é **específica** ("o guia pra instalar hoje", "o passo a passo"), e a
  MESMA frase remove o atrito: "sem terminal, sem código", "o setup leva uns 2 minutos".
- Condicional de desejo, não ordem: "Se você quiser o guia, comenta [palavra]" bate melhor que
  imperativo seco.
- "Seguir/salvar" pode aparecer DEPOIS do CTA de palavra (nunca substituindo), como reforço.

## Duração alvo: 50 a 66 segundos
Faixa observada nos 5 hits: 44,5s a 79,4s; os 2 campeões de comentário por view (8,58% e
6,84%) ficaram em 51,8s e 65,9s. Mirar 50-66s — não 40-60s (ajuste vs. versões antigas deste
arquivo). Isso é o alvo de `cenas.txt` em 900-980 caracteres já usado na skill.

## Template "Insider de IA" (esqueleto do roteiro)
> **[HOOK]** Você [faz X] achando que está [resultado positivo], mas está [dano concreto].
> Quase ninguém te conta.
> **[DIAGNÓSTICO]** [explicação técnica de 2-3 frases com 1 número específico]
> **[BATISMO]** Isso tem nome: [nome técnico].
> **[SOLUÇÃO]** [nome da ferramenta/técnica], [origem/autoria], [de graça/custo]. [como
> funciona em 3-5 passos concretos] [tempo de setup]
> **[CTA]** Se você quiser [entrega específica], comenta [palavra simples do tema] aqui
> embaixo (sem [atrito removido]).

Lembrete: o template dá a ESTRUTURA; a textura da fala continua vindo de `voz-eric.md`
(frases inteiras conectadas, opinião, "na real", nunca telegrama). E antes de escrever,
sempre sincronizar `padroes-perfil.md` (mais recente que este arquivo estático) — ver
`criar-reel/SKILL.md` etapa 2.
