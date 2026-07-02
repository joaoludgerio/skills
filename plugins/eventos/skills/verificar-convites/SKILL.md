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

**ATENÇÃO:** `status_presenca = "confirmado"` é o DEFAULT de cadastro do sistema — todo participante nasce assim. NÃO é sinal de auto-confirmação. Confirmação real por botão aparece no `status` do convite (`confirmado`), não no `status_presenca`.

### Passo 2: Para cada participante, ler conversa no WhatsApp
```
mcp__whatsapp-agent__read(chat=telefone, limit=30)
```
O parâmetro é `chat` (aceita nome, telefone ou chat_id) — NÃO existe parâmetro `phone`.

Se o MCP retornar áudios já transcritos (campo `transcription`), usar o texto direto. Download/transcrição de áudio é responsabilidade do MCP, não dessa skill.

**ATENÇÃO LIDs:** Eric às vezes responde leads num chat LID separado (formato `XXXXXXXX@lid`) que não aparece no read por número. Se a leitura por telefone só trouxer mensagens antigas, rodar `mcp__whatsapp-agent__inbox(since=<últimas 48h>)` ou `search(query=<nome do lead>)` pra achar o LID, então `read(chat=<LID@lid>, limit=30)`.

### Passo 3: Classificar resposta

Analisar as últimas mensagens **do convidado** (não as minhas):

| Classificação | Sinais |
|---------------|--------|
| **confirmado** | "vou", "confirmo", "tô dentro", "beleza", "pode ser", "vamos sim", apertou botão E não recusou depois |
| **recusado** | "não consigo", "não vou", "não dá", "obrigado mas...", "tenho outro compromisso", "fica pra próxima" |
| **escolheu_dia** | Em edição com 2 datas (ex: 28/29 jul), respondeu qual dia prefere ("28", "dia 29", "pode ser terça") — **executar o fluxo PÓS-ESCOLHA da skill `convidar-evento`**: mover pro evento do dia certo se preciso, `gerar_convite_pdf`, enviar PDF + msg do botão, status → `aceitou_convite` |
| **sem_resposta** | Não respondeu nada desde o disparo |
| **em_avaliacao** | Fez pergunta, pediu detalhes, está conversando mas sem decisão final, "acho que dá", "vou tentar", logística pendente — **atualizar status para `em_avaliacao` no MCP e reportar pro Eric responder** |

### Passo 4: Distinguir "não respondeu" de "respondeu noutro chat"
Para os `sem_resposta`, confirmar que a pessoa realmente não respondeu (e não que a resposta veio num chat LID separado — ver atenção LIDs no Passo 2):
```
mcp__whatsapp-agent__inbox(waiting_on="eric", since=<data do disparo>)
```
Se o lead aparecer em `waiting_on="eric"`, ele respondeu e o ciclo está ABERTO — reclassificar.

Observação: o whatsapp-agent NÃO expõe confirmação de leitura (read receipt). `mcp__whatsapp-agent__status` só checa se o WhatsApp está conectado, não diz se uma mensagem foi lida. Não inventar status de leitura — reportar `sem_resposta` como candidato a follow-up e deixar o Eric decidir.

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

**Pré-requisito:** achar o `person_id` do lead no Pipedrive.
```
mcp__pipedrive__search_persons(term=<últimos 8 dígitos do telefone>)
# se não achar, tentar pelo nome; se ainda assim não existir, criar:
mcp__pipedrive__create_person(
  name=<nome>,
  phone=<telefone 55XXXXXXXXXXX, só dígitos>,
  owner_id="Eric Luciano"
)
# depois, 1x na vida (NUNCA sobrescrever se já tiver valor):
mcp__pipedrive__update_person(
  person_id=<id>,
  custom_fields='{"Origem do Contato": "INDIC | Direta do Eric"}'
)
```

**Confirmou:** criar atividade pendente "Reunião Geral - Imersão" pra dia do evento + nota.
```
mcp__pipedrive__create_activity(
  subject="Reunião Geral - Imersão '<nome do evento>' <Xª edição>",
  type="apresentacao",  # key da API; nome visível "Reunião Geral". NÃO usar "reuniao_geral" (não é tipo válido)
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

| Nome | Classificação | Última mensagem dele | Ação |
|------|---------------|----------------------|------|
| ... | confirmado | "tô dentro" | atualizado pra aceitou_convite |
| ... | em_avaliacao | "tem estacionamento?" | PRECISA SUA RESPOSTA |
| ... | sem_resposta | — | candidato a follow-up |

Separar em blocos:
- **Confirmados** (atualizados pra `aceitou_convite`)
- **Recusados** (atualizados pra `recusou`)
- **Em avaliação** (`em_avaliacao` — precisam resposta do Eric)
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

**Quem executa o fechamento:** esta skill NÃO dispara mensagem automaticamente (ver Regra 1). O agente PROPÕE o fechamento (texto sugerido ou reação) e só executa após Eric confirmar. Reação rápida (`mcp__whatsapp-agent__react`) e texto curto vão pelo whatsapp-agent (WhatsApp PESSOAL do Eric) — nunca por outro canal.

**Se `react` falhar (erro Z-API):** sugerir o fallback de texto curto equivalente ("Combinado!", "Anotado!", "Tranquilo, obrigado!"). NÃO deixar a thread sem fechamento se o lote inteiro recebeu fechamento.

## REGRAS IMPORTANTES

1. **NUNCA responder automaticamente** ao convidado — apenas ler, classificar e SUGERIR resposta pro Eric (Eric envia)
2. **Em caso de dúvida na classificação**, marcar como `em_avaliacao` e pedir ao Eric
3. **Respeitar tom do convidado** — se a pessoa está negociando data/detalhes, NÃO é recusa
4. **Confirmação por botão sem mensagem**: se o `status` do convite mudou pra `confirmado` via botão do PDF mas a pessoa não escreveu nada, reportar como "auto-confirmou (precisa validação)". NÃO usar `status_presenca = confirmado` como sinal — é default de cadastro (vale pra todo mundo)
5. **Paralelizar leituras** quando possível (múltiplos agents)
6. **Não alterar status_presenca se já estava como `confirmado` via botão** sem reação do usuário — apenas reportar
7. **Acentuação correta** em qualquer texto que for mostrado ao Eric
8. **Consistência de fechamento dentro do lote** — se 9 de 10 leads do mesmo grupo (ex: recusados) receberam mensagem de fechamento, o 10º também recebe. Não criar exceção sem motivo claro
