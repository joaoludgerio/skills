# Metas de CPL por produto/objetivo (calibragem dos guardrails)

> Um guardrail único NÃO serve: cada produto tem economia própria. Um lead de webinário a R$60
> pode ser ótimo; uma conversa de WhatsApp a R$13 é cara. Os guardrails do relatório usam ESTA
> tabela — não um número global. Atualize aqui quando os custos/tickets mudarem.

| Produto / objetivo | Métrica | 🟢 Bom (escalar) | 🟡 Aceitável | 🔴 Ruim (matar) | Tipo de resultado (Meta) |
|---|---|---|---|---|---|
| **Webinário / Live** (OUTCOME_LEADS) | CPL | < R$40 | R$40–80 | > R$80 | `Website leads` |
| **Mentoria** (OUTCOME_SALES) | custo/reunião | < R$200 | R$200–400 | > R$400 | `invitee_meeting_scheduled` |
| **Super SDR / WhatsApp** (CONVERSAS) | CPL (conversa) | < R$5 | R$5–12 | > R$12 | conversas iniciadas |
| **Cursos R$97** (OUTCOME_SALES web) | CPA | < R$16 | R$16–32 | > R$32 | `omni_purchase` |

## Como o relatório usa esta tabela

Para cada anúncio, identifique o **tipo de resultado** que ele gera (vem no campo `results`/
`cost_per_result`, ex: "Website leads", "invitee_meeting_scheduled") e use a linha correspondente.
Se o objetivo da campanha não estiver na tabela, **não invente limite** — reporte o número e marque
"⚪ sem meta definida" no lugar de kill/scale.

### Regras derivadas (substituem o número fixo do playbook)
- 🔴 **Matar — CPL ruim:** CPL/custo > limite **Ruim** do produto, **e** já gastou ≥ 1× esse limite
  (senão ainda está aprendendo).
- 🔴 **Matar — sem resultado:** 0 conversões após gastar o valor do limite **Ruim** do produto
  (ex: webinário com R$80 gastos e 0 lead; mentoria com R$400 e 0 reunião).
- 🟢 **Escalar:** CPL/custo < limite **Bom** do produto **e** volume mínimo de resultados
  (webinário ≥ 10 leads; mentoria ≥ 3 reuniões; WhatsApp ≥ 10 conversas) → sugerir +20%
  (ou +30% se estiver bem abaixo do Bom). Nunca sugerir mais de +30% de uma vez.

### Regras universais (valem pra qualquer produto — vêm do playbook)
- 🔴 CTR < 0,5% **após** 1.000 impressões → matar.
- 🔴 Frequência > 3,0 → matar (saturação).
- Nunca sugerir matar mais de 5 anúncios de uma vez sem destacar.
- Todo motivo cita o número que disparou a regra.

> Esta tabela já é a fonte de verdade dos **limites por produto** e das **regras universais**
> (seção acima), tudo que a skill precisa pra rodar. O playbook completo (`playbooks/trafego-meta-ads.md`,
> contexto e histórico estendidos) não faz parte deste plugin; ele vive no repo separado
> `joaoludgerio/expert-automacoes-marketing`, pra quem quiser aprofundar.
