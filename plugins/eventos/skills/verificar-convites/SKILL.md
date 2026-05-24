---
name: verificar-convites
description: Verificar respostas dos convites enviados via WhatsApp para eventos do Eric (Expert Integrado). Lê as conversas dos convidados, classifica como confirmou/recusou/sem resposta, e atualiza status no MCP expert-integrado. TRIGGER quando Eric pedir para verificar respostas, checar convites, ver quem confirmou o evento, ou validar confirmações.
---

# Verificar Respostas de Convites — Expert Integrado

Skill para ler respostas no WhatsApp dos convidados de um evento e atualizar status no MCP expert-integrado.

---

## CONTEXTO

- Após disparar convites (via skill `convidar-evento`), Eric pede verificação periódica
- Participantes com status `convite_enviado` precisam ser checados
- O sistema pode ter auto-confirmado via botão/link, mas Eric quer **confirmação manual** validando a intenção real pela conversa
- Categorias finais: `confirmado`, `recusado`, `sem_resposta`

## PROTOCOLO DE EXECUÇÃO

### Passo 0: Coletar parâmetros
- **evento_id** do MCP expert-integrado
- Quem verificar: default = todos com `convite_enviado` E `convidado_por = "Eric Luciano"`
- Eric pode pedir pra verificar um subconjunto específico

### Passo 1: Listar participantes a verificar
```
mcp__expert-integrado__list_participantes(evento_id=...)
```
Filtrar pelo `convidado_por` desejado (ex: "Eric Luciano") e re-verificar TODOS os status, não só `convite_enviado`/`em_avaliacao`. Já houve caso de status errado (`recusou` que na verdade era `aceitou_convite`) — o skill precisa varrer tudo pra detectar inconsistências.

Auto-confirmação por botão (`status_presenca = "confirmado"` sem mensagem na conversa) também entra na verificação.

### Passo 2: Para cada participante, ler conversa no WhatsApp
```
mcp__whatsapp-agent__read(phone=telefone, limit=30)
```

Se o MCP retornar áudios já transcritos (campo `transcript`), usar o texto direto. Download/transcrição de áudio é responsabilidade do MCP, não dessa skill.

### Passo 3: Classificar resposta

Analisar as últimas mensagens **do convidado** (não as minhas):

| Classificação | Sinais |
|---------------|--------|
| **confirmado** | "vou", "confirmo", "tô dentro", "beleza", "pode ser", "vamos sim", apertou botão E não recusou depois |
| **recusado** | "não consigo", "não vou", "não dá", "obrigado mas...", "tenho outro compromisso", "fica pra próxima" |
| **sem_resposta** | Não respondeu nada desde o disparo |
| **em_avaliacao** | Fez pergunta, pediu detalhes, está conversando mas sem decisão final, "acho que dá", "vou tentar", logística pendente — **atualizar status para `em_avaliacao` no MCP e reportar pro Eric responder** |

### Passo 4: Verificar leitura (quando relevante)
Se `sem_resposta`, checar se a pessoa leu:
```
mcp__whatsapp-agent__status(message_id=...)
```
Útil pra Eric decidir se faz follow-up.

### Passo 5: Atualizar status no MCP

**Confirmou:**
```
mcp__expert-integrado__update_status_convite(
  participante_id=...,
  novo_status="aceitou_convite"
)
```

**Recusou:**
```
mcp__expert-integrado__update_status_convite(
  participante_id=...,
  novo_status="recusou"
)
```

Valores válidos de novo_status: pendente_envio, convite_enviado, em_avaliacao, aceitou_convite, confirmado, recusou.

**Em avaliação (em conversa, sem decisão final):**
```
mcp__expert-integrado__update_status_convite(
  participante_id=...,
  novo_status="em_avaliacao"
)
```
Reportar pro Eric pra ele decidir o follow-up.

**Sem resposta:** não alterar, apenas reportar.

### Passo 5.5: Registrar desfecho no Pipedrive

A atividade "Convite enviado, imersão, ..." já foi criada concluída na hora do envio (skill `convidar-evento`). Aqui registramos o **desfecho** baseado na resposta do lead.

**Pré-requisito:** achar o `person_id` do lead no Pipedrive (search_persons pelos últimos 8 dígitos do telefone, ou pelo nome). Se não existe, criar.

**Confirmou:** criar atividade pendente "Reunião Geral - Imersão" pra dia do evento + nota.
```
mcp__pipedrive__create_activity(
  subject="Reunião Geral - Imersão '<nome do evento>' <Xª edição>",
  type="reuniao_geral",  # ou tipo equivalente do Pipedrive
  due_date="<YYYY-MM-DD do evento>",
  person_id=<id>,
  user_id="Eric Luciano",
  note="<contexto da confirmação, ex: 'Confirmou via msg em LID, demonstrou interesse em parceria comercial'>"
)
mcp__pipedrive__create_note(
  person_id=<id>,
  content="Confirmou presença na imersão <data>. Última msg dele: \"<texto literal>\"."
)
```

**Recusou:** criar nota com motivo (sem nova atividade).
```
mcp__pipedrive__create_note(
  person_id=<id>,
  content="Recusou imersão <data>. Motivo: <citação literal>. Tom: <positivo/neutro/negativo>. Próxima ação sugerida: <ex: 'reabordar próxima edição', 'follow-up em 30d', 'arquivar'>."
)
```

**Em avaliação:** criar nota registrando dúvida/objeção, sem nova atividade.
```
mcp__pipedrive__create_note(
  person_id=<id>,
  content="Em avaliação imersão <data>. Pergunta/objeção: <texto>. Aguardando resposta do Eric."
)
```

**Sem resposta (silencioso):** nada extra. A atividade do envio já registra o touchpoint. Reportar pro Eric decidir se faz follow-up.

**Por que separar atividade vs nota:**
- Atividade: representa um EVENTO acionável e auditável (envio, reunião agendada).
- Nota: representa CONTEXTO/decisão sem ação subsequente (recusa, dúvida).
- Não inflar histórico de atividades com "recusa" — vira nota.

**Quando NÃO registrar:** se `convidado_por != "Eric Luciano"` (outro convidador é dono do touchpoint).

### Passo 6: Relatório pro Eric

Tabela:

| Nome | Classificação | Leu? | Última mensagem dele | Ação |
|------|---------------|------|----------------------|------|
| ... | confirmado | ✓ | "tô dentro" | atualizado pra aceitou_convite |
| ... | em_andamento | ✓ | "tem estacionamento?" | PRECISA SUA RESPOSTA |
| ... | sem_resposta | ✗ | — | — |

Separar em blocos:
- **Confirmados** (atualizados)
- **Recusados** (atualizados)
- **Em andamento** (precisam resposta do Eric)
- **Sem resposta** (candidatos a follow-up)

---

## FECHAR CICLO DE RESPOSTA (regra de comportamento)

**Objetivo:** nenhum lead fica no vácuo. NÃO é dogma "Eric sempre manda a última msg literal" — é "ninguém pode ficar sem fechamento".

Ao varrer respostas, pra cada conversa decidir se o ciclo está aberto ou fechado:

| Situação | Ciclo | Ação sugerida ao Eric |
|----------|-------|----------------------|
| Lead mandou pergunta, recusa pela 1ª vez, confirmação, áudio explicando algo, dúvida real | **ABERTO** | Sugerir resposta substantiva pra Eric mandar |
| Lead respondeu "ok", "valeu", "obrigado", "beleza" depois que Eric já respondeu | **FECHADO** | Reação 👍❤️🙏 OU silêncio. NÃO forçar mais texto |
| Eric já agradeceu/anotou + lead já agradeceu | **FECHADO** | Nada |
| Lead recusou, Eric ainda não respondeu | **ABERTO** | Sugerir "tranquilo, fica pra próxima, abraço" |
| Lead confirmou, Eric ainda não respondeu | **ABERTO** | Sugerir "show, te vejo lá / equipe entra em contato" |

**Regra de bolso:** se a próxima msg do Eric soaria forçada/redundante ("desliga você primeiro, não, desliga você"), NÃO mandar. Reação ou silêncio com ciclo fechado é melhor que texto vazio.

**Se `react` falhar (erro Z-API):** cair pro fallback de texto curto equivalente ("Combinado!", "Anotado!", "Tranquilo, obrigado!"). NÃO deixar a thread sem fechamento se o lote inteiro recebeu fechamento.

## REGRAS IMPORTANTES

1. **NUNCA responder automaticamente** ao convidado — apenas ler, classificar e SUGERIR resposta pro Eric (Eric envia)
2. **Em caso de dúvida na classificação**, marcar como `em_andamento` e pedir ao Eric
3. **Respeitar tom do convidado** — se a pessoa está negociando data/detalhes, NÃO é recusa
4. **Confirmação por botão sem mensagem**: se o sistema marcou `status_presenca = confirmado` automaticamente mas a pessoa não escreveu nada, reportar como "auto-confirmou (precisa validação)"
5. **Paralelizar leituras** quando possível (múltiplos agents)
6. **Não alterar status_presenca se já estava como `confirmado` via botão** sem reação do usuário — apenas reportar
7. **Acentuação correta** em qualquer texto que for mostrado ao Eric
8. **Consistência de fechamento dentro do lote** — se 9 de 10 leads do mesmo grupo (ex: recusados) receberam mensagem de fechamento, o 10º também recebe. Não criar exceção sem motivo claro
