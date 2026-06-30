---
name: fup-inteligente
description: Follow-up sistemático de deals abertos no Pipedrive, um funil por vez, da direita para a esquerda (etapa mais avançada primeiro). Lê contexto Pipedrive + WhatsApp pessoal, sugere mensagem com voz Eric, envia após aprovação, registra atividade e agenda próximo follow-up. Quando deal vira Perdido, SEMPRE cria atividade de retomada futura conforme playbook. TRIGGER quando o usuário pedir "follow-up", "fup do pipe", "vamos rodar o funil X", "deal Y foi perdido" ou similar.
---

# Follow-up Pipedrive — Skill de Follow-up de Funis

---

## Resumo

Follow-up sistemático de deals abertos no Pipedrive, um funil por vez, da direita para a esquerda (etapa mais avançada primeiro). Lê contexto do Pipedrive + WhatsApp pessoal, sugere mensagem com voz Eric, envia após aprovação, registra atividade concluída e agenda próximo follow-up.

Quando um deal é marcado como **Perdido**, a skill SEMPRE cria uma atividade de retomada futura seguindo o protocolo do playbook embutido (ver `playbook/`). A skill pergunta ao Eric a quem atribuir a atividade — a ele mesmo ou a um vendedor específico.

---

## Playbook embutido — referência canônica

A pasta `playbook/` contém cópia dos 5 documentos canônicos do processo comercial. **Sempre consultar daqui** — funciona em qualquer máquina (PC, notebook, VPS, Telegram) sem dependência de OneDrive/internet.

| Arquivo | Quando consultar |
|---|---|
| `Playbook_Vendas_Super_SDR.md` | Cadências de follow-up, fluxos de retomada pós-perda (seções 16.10–16.13), regras de pipeline |
| `Livro_Objecoes_Super_SDR.md` | Antecipar/responder objeções em mensagem |
| `Livro_Objecoes_Contexto_Agente.md` | Objeções específicas para contexto de agente IA |
| `Manual_Duvidas_Tecnicas_Super_SDR.md` | Dúvidas técnicas do produto durante a conversa |
| `Politica_Comercial_Super_SDR.md` | Política comercial (descontos, condições, exceções) |

**Fonte original** (single source of truth): `C:/Users/Eric Luciano/OneDrive/Workspace/Processo Comercial/Playbooks/Documentos MD/`

**Sincronização:** rodar `scripts/sync-playbook.ps1` antes de cada commit no repo `skills` para refletir mudanças do Workspace no `playbook/` da skill. Em VPS/Telegram, o `playbook/` já vem versionado via `git pull`.

---

## Ordem de Prioridade dos Funis

1. Educacional (pipeline 6)
2. Super SDR (pipeline 2)
3. SaaS (pipeline 1)
4. Prospecção (pipeline 7)
5. Parcerias (pipeline 10) — pular por enquanto

Dentro de cada funil: **só deals do Eric** (user_id 17987703).

---

## Ordem de Prioridade dentro do Funil

**Direita para a esquerda** (etapa mais avançada primeiro):

### Educacional (pipeline 6)
- 82 — Formalização
- 56 — Em negociação
- 55 — Proposta enviada
- 60 — Apresentação realizada
- 54 — Apresentação agendada
- 115 — Aguardando agendamento
- 53 — Contato realizado
- 52 — Sem contato

### Super SDR (pipeline 2)
- 81 — Formalização
- 14 — Em negociação
- 12 — Proposta enviada
- 10 — Demo realizada
- 9 — Demo agendada
- 90 — Aguardando agendamento
- 8 — Contato realizado
- 7 — Sem contato

### SaaS (pipeline 1)
- 83 — Formalização
- 21 — Em negociação
- 20 — Proposta enviada
- 61 — Apresentação realizada
- 19 — Apresentação agendada
- 117 — Aguardando agendamento
- 17 — Contato realizado
- 16 — Sem contato

### Prospecção (pipeline 7)
- 79 — Reunião agendada
- 116 — Qualificado
- 68 — Pré-Qualificado
- 66 — Conexão iniciada/Em qualificação
- 65 — Tentando contato
- 64 — Lead Mapeado

---

## Fluxo por Deal

### 1. Triagem: esse deal precisa de follow-up AGORA?

Só faz follow-up se:
- **Atividade vencida** (data passou) — PRIORIDADE 1
- **Atividade para hoje** — PRIORIDADE 2
- **Sem atividade pendente** — PRIORIDADE 3 (erro do sistema)

Se tem atividade pendente com data **futura** (ainda não venceu): **pula esse deal**, espera a data.

### 2. Coleta de contexto

**Pipedrive:**
- Ler deal completo (campos personalizados, valor, etapa)
- Ler última atividade (data, descrição, tipo)
- Ler notas recentes
- Ver histórico de movimentação

**WhatsApp pessoal:**
- Ler últimas 30 mensagens com o contato
- Se necessário, ler até 100 mensagens
- Entender o contexto real da conversa
- **WhatsApp > Pipedrive em caso de conflito** (conversa real é fonte de verdade)

### 3. Definir próxima ação e sugerir mensagem

Baseado no contexto (Pipedrive + WhatsApp), definir:
- **Tipo de atividade** (WhatsApp, ligação, reunião, tarefa)
- **Texto da mensagem** (se for WhatsApp)
- **Data do próximo follow-up**

**Antes de redigir a mensagem, consultar o Livro de Objeções (OBRIGATÓRIO sempre que houver objeção no histórico).** Ver seção "Quebra de Objeções — consulta obrigatória" abaixo.

Passar a mensagem pelo `check_message` (voice guide). Se tiver violações, corrigir antes de mostrar.

---

## Quebra de Objeções — consulta obrigatória

A skill **SEMPRE** consulta o Livro de Objeções pra gerar mensagens — não só em lead perdido. Em qualquer follow-up onde o lead expressou hesitação, dúvida, resistência ou silêncio prolongado, a mensagem precisa ancorar na quebra validada do playbook, não em improviso.

### Fontes canônicas

- `playbook/Livro_Objecoes_Super_SDR.md` — objeções gerais do funil Super SDR (preço, timing, autoridade, fit, risco, concorrência). Estrutura por objeção: [DIAGNÓSTICO] / [PROVA] / [AVALIAR] / [CONFIRMAR] + DICA.
- `playbook/Livro_Objecoes_Contexto_Agente.md` — objeções específicas pro contexto de agente IA (medo de robô, perda de controle, qualidade da conversa).
- `playbook/Manual_Duvidas_Tecnicas_Super_SDR.md` — dúvidas técnicas do produto (consultar quando a "objeção" é na verdade dúvida de implementação/integração).

### Fluxo de uso por etapa do funil

| Etapa do deal | Quando consultar |
|---|---|
| Sem contato / Contato realizado | Não consultar — primeiro contato não tem objeção ainda |
| Apresentação agendada / Demo agendada | Consultar SE houve hesitação antes do agendamento (ex: "preciso pensar", "depois falo com sócio") |
| Apresentação realizada / Demo realizada | **OBRIGATÓRIO** — toda demo gera 1-3 objeções. Mapear na nota do deal e usar quebra correspondente |
| Proposta enviada | **OBRIGATÓRIO** — silêncio pós-proposta = objeção implícita (geralmente preço, timing ou autoridade). Usar quebra do tipo mais provável dado o contexto |
| Em negociação | **OBRIGATÓRIO** — toda negociação é objeção ativa. Mensagem deve abordar a objeção declarada, não rodear |
| Formalização | Consultar SE travou em ponto técnico/contratual |
| Lead perdido (lost) | **OBRIGATÓRIO** — ver seção "Lead Perdido" (motivo de perda mapeia direto pra objeção a quebrar) |

### Como identificar a objeção a quebrar

Ordem de prioridade pra extrair a objeção real:

1. **WhatsApp** (fonte primária) — frase literal do lead na última conversa. Ex: "ficou caro", "preciso falar com meu sócio", "vou avaliar".
2. **Notas do Pipedrive** — resumo escrito pelo vendedor após call (geralmente identifica a objeção).
3. **Motivo de perda** (se já lost) — mapeia direto pra objeção dominante.
4. **Etapa estagnada** — se deal parou em etapa específica, presumir objeção típica da etapa (proposta parada = preço/timing; negociação travada = autoridade/condições).

### Como aplicar a quebra na mensagem

A mensagem do follow-up **não copia** o script do Livro de Objeções na íntegra (script é pra call, mensagem é pra WhatsApp — formatos diferentes). Em vez disso:

1. Identifica a objeção raiz (ver "Como identificar" acima)
2. Lê o bloco correspondente no `Livro_Objecoes_Super_SDR.md`
3. Extrai o **ângulo de quebra** (PROVA + AVALIAR — a parte que muda a perspectiva do lead)
4. Adapta para WhatsApp: 1-3 parágrafos curtos, voz Eric, termina com pergunta aberta (não pedido de reunião)
5. Mantém princípio "[DIAGNÓSTICO] antes de [PROVA]" — sempre validar que entendeu a dor antes de oferecer a quebra

### Exemplos

**Objeção: "ficou caro" (proposta enviada, silêncio 7 dias)**
- Livro de Objeções diz: usar ROI calculator + comparar com custo de SDR humano + parcelamento se for crítico
- Mensagem WhatsApp:
  > Fulano, sei que o investimento parou em "preciso avaliar". Antes de você decidir, queria te mostrar o ROI que a gente calculou pro seu volume: o Super SDR paga ele mesmo em 2,3 meses comparado a contratar 1 SDR humano. Posso te mandar a calculadora preenchida com seus números pra você ver?

**Objeção: "preciso falar com o sócio" (demo realizada, sem retorno)**
- Livro de Objeções diz: oferecer participar da call com o sócio + enviar kit champion + follow-up 48h
- Mensagem WhatsApp:
  > Fulano, você ia falar com o [nome do sócio] sobre a gente. Pra facilitar essa conversa, posso participar de uma call de 20min com vocês dois — eu tiro as dúvidas técnicas direto e vocês decidem juntos. Que dia da próxima semana funciona?

### Regra de transparência na nota da atividade

Ao registrar a atividade no Pipedrive, incluir no campo `note` (HTML) a linha:

```
<b>Objeção quebrada:</b> [nome da objeção] — fonte: Livro de Objeções Super SDR §[seção]
```

Isso permite ao vendedor que abre a atividade entender qual ângulo a skill já tentou e não repetir a mesma quebra se o lead voltar com a mesma objeção.

### 4. Aprovação do Eric (PASSO OBRIGATÓRIO)

**Template de apresentação do lead (sempre igual):**

```
**Nome do Lead** — Empresa
🔗 <https://expertintegrado.pipedrive.com/deal/{id}>

**Funil:** Educacional > Proposta enviada
**Valor:** R$ 24.000
**Fechamento:** {data ou "sem"}

**Contexto:** {resumo 2-3 linhas do que aconteceu}
📱 https://wa.me/{numero_telefone}

**Mensagem sugerida:**
> "{texto completo da mensagem}"

**Próxima atividade:** {tipo} em {data} — {descrição do que fazer}
```

**Regras de formatação:**
- Link Pipedrive SEMPRE dentro de `<>` (suprime preview/link embedding no Telegram)
- **Contexto:**, **Mensagem sugerida:** e **Próxima atividade:** em negrito
- Link WhatsApp (📱) logo abaixo do contexto, ANTES da mensagem
- Mensagem sugerida: `>` sem pular linha entre o label e a citação
- Pular uma linha entre citação e próxima atividade
- Funil formatado como: **Funil:** Nome > Etapa (sem pipe/divisor)
- Descrição da próxima atividade deve ser clara (o que fazer se não responder)

**Botões inline no Telegram:**
- ✅ **Enviar** (callback: `fup_enviar:{deal_id}`) — verde, primary
- ✏️ **Alterar** (callback: `fup_alterar:{deal_id}`) — azul, secondary

Quando Eric clica **Enviar**:
1. Enviar mensagem via whatsapp-agent
2. Executar o **Protocolo de Registro Anti-Vencida** (seção 5) — concluir a vencida, registrar o envio como CONCLUÍDA verificada, criar a próxima pendente futura, rodar a invariante
3. Avançar para o próximo deal

Quando Eric clica **Alterar**:
1. NÃO fazer nada
2. Aguardar instrução do Eric (texto, novo prazo, etc.)
3. Re-apresentar com as alterações pedidas

Eric aprova clicando no botão. Sem botão = sem envio.

### 5. Execução (após aprovação) — Protocolo de Registro Anti-Vencida

**Enviar mensagem:**
- Via `whatsapp-agent` (WhatsApp pessoal do Eric)
- Voice guide obrigatório

**Registrar no Pipedrive — ordem e verificação OBRIGATÓRIAS:**

> **Regra de ouro:** atividade de REGISTRO (algo que JÁ aconteceu) nunca pode ficar pendente. Atividade PENDENTE só existe com data futura. Violação disso = atividade vencida fantasma poluindo a lista do Eric.

**Passo 1 — Concluir a atividade que disparou o follow-up** (a vencida/de hoje encontrada na triagem):
- `update_activity(activity_id, done: true)`
- Fazer ANTES de criar qualquer atividade nova. Se a triagem achou mais de uma vencida, concluir todas.

**Passo 2 — Criar o registro do envio, em 2 chamadas (create → update):**
- 2a) `create_activity` (ou `pipedrive_write/create_activity`): tipo WhatsApp, responsável Eric (17987703), `due_date` = data REAL do evento, descrição = texto enviado, vínculo deal_id + person_id. Pode passar `done: true` na criação (suportado desde 12/06/2026), MAS:
- 2b) **SEMPRE** confirmar com `update_activity(novo_id, done: true)` em seguida. O retorno "Atividade X concluída" é a prova de que não nasceu pendente.
- **Por quê 2 chamadas:** até 12/06/2026 o MCP descartava `done` na criação silenciosamente (Bug #6 do pipedrive-mcp) — atividades retroativas nasciam pendentes e, como a data era passada, viravam VENCIDAS na hora. O par create→update funciona em qualquer versão do MCP e é autoverificável. Não confiar em "Atividade criada!" sem o sufixo "(CONCLUÍDA)".

**Passo 3 — Criar a próxima atividade PENDENTE:**
- Tipo conforme aprovação, responsável Eric (17987703), descrição = o que fazer se não responder
- `due_date` SEMPRE futura (>= amanhã). Se a data calculada já passou ou é hoje, usar o próximo dia útil. NUNCA passar `due_time` vazio ou "00:00".

**Passo 4 — Invariante final (rodar SEMPRE, por deal tocado):**
- `list_deal_activities(deal_id, done: 0)` deve retornar **EXATAMENTE 1 atividade, com data futura**
- Mais de 1 pendente → concluir as excedentes (lixo de ciclos anteriores)
- Alguma pendente com data passada → concluir e recriar com data futura
- Zero pendente → o Passo 3 falhou; criar agora

**Invariante do funil: 1 deal aberto = exatamente 1 atividade pendente, sempre futura.** Deal aberto com 0 pendentes é deal órfão; com 2+ é deal duplicado; com pendente vencida é registro mal feito.

### 6. Próximo deal

Seguir para o próximo deal na ordem de prioridade. Apresentar com o mesmo template + botões.

### 7. Batch efficiency

Se múltiplos leads forem simples (mesma situação, contexto leve), podem ser apresentados em sequência rápida. Mas cada um ainda precisa de botão Enviar/Alterar individual.

---

## Critérios de Data do Próximo Follow-up

Recomendação baseada na etapa e no contexto:
- **Sem contato / Contato realizado:** 1-2 dias
- **Aguardando agendamento:** 2-3 dias
- **Apresentação agendada:** esperar até a data da reunião
- **Apresentação realizada:** 1 dia
- **Proposta enviada:** 2-3 dias
- **Em negociação:** 1-2 dias
- **Formalização:** 1 dia

Sempre sugerir data ao Eric na aprovação. Ele ajusta se quiser.

---

## Lead Perdido — Atividade de Retomada OBRIGATÓRIA

**Regra geral:** todo deal marcado como Perdido (status `lost`) precisa ter uma atividade futura de retomada criada no Pipedrive. **Sem exceção.** Lead perdido sem atividade de retomada = lead que vai virar zumbi no CRM.

A skill detecta o evento "lead perdido" em 2 situações:
1. **Detecção ativa** durante o follow-up: o Eric responde no Telegram pedindo pra marcar como perdido (ex: "marca como perdido — não respondeu mais", "esse aqui já era").
2. **Auditoria passiva** durante o sweep do funil: deal aparece com status `lost` mas sem nenhuma atividade pendente futura → criar retroativamente.

### Fluxo de criação da atividade de retomada

#### Passo 1 — Confirmar motivo de perda

Antes de marcar o deal como perdido (ou ao detectar um já perdido sem atividade), confirmar o **motivo de perda** (`lost_reason`). Motivos canônicos do Pipedrive (do Playbook seção 8):

- Parou de responder
- Fora do orçamento
- Adiou contratação
- Contratou outra empresa
- Mudança de prioridade
- Internalizou
- Não é o que buscava
- Ferramenta incompatível
- Desqualificado

Se o Eric não informou o motivo, perguntar antes de seguir.

#### Passo 2 — Mapear motivo → cadência → prazo

Tabela canônica (Playbook seções 16.10–16.13):

| Motivo de perda | Cadência | Dias até 1ª retomada |
|---|---|---|
| Parou de responder | Cadência 6 — Reativação 30d | **+30 dias** |
| Fora do orçamento | Cadência 6 — Reativação 30d | **+30 dias** |
| Adiou contratação | Cadência 6 — Reativação 30d | **+30 dias** |
| Mudança de prioridade | Cadência 6 — Reativação 30d | **+30 dias** |
| Contratou outra empresa | Cadência 7 — Reativação Tardia | **+90 dias** |
| Internalizou | Cadência 7 — Reativação Tardia | **+90 dias** |
| Não é o que buscava | Cadência 7 — Reativação Tardia | **+90 dias** |
| Desqualificado | Cadência 8 — Check-in 180d | **+180 dias** |
| Ferramenta incompatível | Cadência 8 — Check-in 180d | **+180 dias** |

A data é calculada a partir da data de marcação como perdido (hoje, na maioria dos casos). Se cair em fim de semana, mover pra próxima segunda útil.

#### Passo 3 — PERGUNTAR ao Eric a quem atribuir

**OBRIGATÓRIO antes de criar a atividade.** A skill NUNCA decide sozinha o responsável da retomada. Apresentar no Telegram:

```
🔴 Lead Perdido — {Nome} ({Empresa})
Motivo: {motivo de perda}
Cadência: {Cadência 6/7/8} — retomada em {data calculada}

A quem atribuir a atividade de retomada?
```

Botões inline:
- 👤 **Eric** (callback: `retomada_atribuir:{deal_id}:eric`)
- 👩 **Kesia** (callback: `retomada_atribuir:{deal_id}:kesia`) — user_id 23969736
- 👨 **Niverton** (callback: `retomada_atribuir:{deal_id}:niverton`) — user_id 23506911
- ✏️ **Outro vendedor** (callback: `retomada_atribuir:{deal_id}:outro`) — abre input livre

Sem clique = sem criação. Não criar atividade com responsável "default".

#### Passo 4 — Criar a atividade de retomada

Após o clique do Eric:

```python
POST /v1/activities body={
    'subject': 'Retomada pós-perda — {Cadência N}: {primeiro toque do playbook}',
    'type': 'whatsapp',          # canal padrão da cadência (Playbook 16.10–16.12)
    'deal_id': DEAL_ID,
    'person_id': PERSON_ID,
    'org_id': ORG_ID,
    'user_id': USER_ID_ESCOLHIDO,
    'due_date': DATA_CALCULADA,  # +30 / +90 / +180
    'done': 0,
    'note': NOTA_HTML            # ver template abaixo
}
```

**NUNCA passar `due_time`** — atividade de retomada não tem horário específico (deixar o vendedor escolher no dia). Passar `due_time=""` ou `"00:00"` marca como vencida à meia-noite.

#### Passo 5 — Nota HTML da atividade

A nota da atividade deve conter:
1. Mensagem sugerida pronta para o primeiro toque da cadência
2. Resumo do contexto do lead (por que perdeu, o que disse na última conversa)
3. Roadmap completo da cadência (todos os 5 toques)
4. Objeções esperadas baseadas no motivo de perda (consultar `playbook/Livro_Objecoes_Super_SDR.md`)

Template:

```html
<b>📩 PRIMEIRO TOQUE — {data calculada} (Cadência {N})</b><br><br>

{mensagem do primeiro toque, personalizada — ver Passo 6}<br><br>

<hr>

<h3>🎯 ESTRATÉGIA DE RETOMADA — {Cadência N}</h3>

<b>📊 RESUMO DO LEAD</b><br>
{2-3 linhas: nome, empresa, valor da proposta, etapa quando perdeu, motivo}<br><br>

<b>🌡️ MOTIVO DA PERDA: {motivo}</b><br>
{1 linha sobre o que aconteceu — o que o lead disse, contexto}<br><br>

<b>📅 ROADMAP DA CADÊNCIA</b><br>
{tabela com os 5 toques: dia, canal, ação — copiada do playbook}<br><br>

<b>⚠️ OBJEÇÕES ESPERADAS:</b><br>
1. <b>"{objeção típica do motivo}"</b> → {resposta sugerida do Livro de Objeções}<br>
2. <b>"{objeção 2}"</b> → {resposta}<br><br>

<b>📌 CONTEXTO ADICIONAL:</b><br>
• Última conversa: {data, resumo}<br>
• Histórico de propostas: {valores, etapas anteriores}<br>
• Ferramentas que usa: {lista}<br>
• Link WhatsApp: {wa.me/...}<br>
```

#### Passo 6 — Gerar mensagem do primeiro toque

Consultar `playbook/Playbook_Vendas_Super_SDR.md` seção da cadência mapeada (16.10 / 16.11 / 16.12) e usar a coluna "Ação" do **Dia 0** como base. Adaptar com:

- Nome do lead
- Empresa
- Ângulo específico baseado no motivo (ex: "Fora do orçamento" em 2026 → mencionar mudança de preço/condição comercial; "Contratou outra empresa" em 2026 → "como está a experiência com a solução que adotaram?")
- Voz do Eric (passar pelo `check_message` do voice guide se estiver disponível)

**Princípio:** o vendedor que abrir a atividade na data marcada deve conseguir copiar e colar a mensagem direto, sem ter que pesquisar nada.

### Passo 6.5 — Limpar atividades pendentes do deal (ANTES de marcar perdido)

`list_deal_activities(deal_id, done: 0)` e concluir (`update_activity done: true`) **todas** as pendentes EXCETO a retomada recém-criada. Inclui vencidas antigas, checkpoints de ciclos anteriores e qualquer registro que ficou aberto.

**Invariante de deal perdido: exatamente 1 atividade pendente = a retomada futura.** Deal lost com atividades vencidas penduradas continua aparecendo na lista de atrasadas do Eric — é exatamente o lixo que esse passo elimina. (Caso real: deal Bruno Lima 10954 ficou lost com 2 vencidas de maio até a auditoria de 12/06.)

### Passo 7 — Marcar deal como perdido no Pipedrive

Só DEPOIS da atividade de retomada ter sido criada com sucesso E das pendentes antigas terem sido concluídas:

```python
PUT /v1/deals/{deal_id} body={
    'status': 'lost',
    'lost_reason': motivo
}
```

Ordem importa: se marcar perdido primeiro e a criação da atividade falhar, o deal vira zumbi sem retomada — exatamente o problema que essa regra quer evitar.

### Passo 8 — Confirmar pro Eric

Resposta final no Telegram:

```
✅ Lead {Nome} marcado como perdido (motivo: {motivo})
📅 Retomada agendada: {data} ({Cadência N})
👤 Atribuído a: {nome do responsável}
🔗 https://expertintegrado.pipedrive.com/activities/list/...
```

---

### IDs dos vendedores conhecidos (Pipedrive user_id)

- Eric Luciano: `17987703`
- Kesia Nandi: `23969736`
- Niverton Menezes: `23506911`

Outros nomes: resolver via `mcp__pipedrive__list_users` se necessário (perguntar nome parcial e confirmar com o Eric).

---

## Edge Cases

- **Registro retroativo ("eu já mandei mensagem pra ele, só registra"):** caso FREQUENTE — Eric responde a apresentação dizendo que já agiu manualmente. Ler o WhatsApp pra confirmar o conteúdo/data real, depois aplicar o Protocolo Anti-Vencida da seção 5 integralmente: registro com a data real do evento + create→update done + próxima pendente futura + invariante. Registro retroativo que fica pendente vira atividade vencida na hora (data passada).
- **Deal sem telefone no contato:** perguntar ao Eric como contatar
- **Contato sem histórico no WhatsApp:** pular leitura do WhatsApp, usar só Pipedrive
- **Múltiplos deals do mesmo contato (ambos abertos):** perguntar ao Eric (raro)
- **Deal que parece morto (sem resposta há 30+ dias):** sinalizar ao Eric, sugerir lost — ao confirmar lost, **acionar fluxo "Lead Perdido — Atividade de Retomada OBRIGATÓRIA"** acima
- **Deal já marcado como Perdido mas sem atividade futura:** durante o sweep do funil, listar todos esses pro Eric com motivo de perda e propor criação retroativa da retomada (mesmo fluxo do Passo 1 em diante)
- **Deal perdido sem `lost_reason` preenchido:** perguntar ao Eric qual motivo aplicar antes de criar a retomada (sem motivo a skill não consegue mapear a cadência)
- **Deal perdido com motivo fora da lista canônica:** mapear para "Desqualificado" (+180d) como fallback conservador e sinalizar ao Eric pra revisar

---

## Modelo pra Subagente

Se o Eric pedir pra delegar isso pra um subagente (cron ou spawn):
- Modelo: `zai/glm-5-turbo`
- Ferramentas: Pipedrive MCP + WhatsApp Agent MCP + voice guide
- Não enviar sem aprovação (subagente mostra, Eric aprova aqui no Telegram principal)

---

*Skill v1.2 — Atualizada em 12/06/2026.*

**Changelog:**
- v1.2 (12/06/2026): + Protocolo de Registro Anti-Vencida na seção 5 (ordem obrigatória: concluir vencida → registro via create→update done verificado → pendente futura → invariante "1 pendente futura por deal"). Causa: Bug #6 do pipedrive-mcp — `create_activity` descartava `done` silenciosamente e registros retroativos nasciam pendentes/vencidos. + Passo 6.5 no fluxo LOST: concluir todas as pendentes antigas antes de marcar perdido (invariante de deal perdido: só a retomada pendente). + edge case "registro retroativo" (Eric já agiu manualmente).
- v1.1 (20/05/2026): + tratamento OBRIGATÓRIO de Lead Perdido com atividade de retomada (motivo → cadência → data). + pergunta de atribuição da retomada (Eric/Kesia/Niverton/outro). + consulta obrigatória ao Livro de Objeções em TODO follow-up (não só lost) com mapa por etapa do funil. + playbook embutido em `playbook/` (auto-contido, funciona em qualquer máquina). + script `scripts/sync-playbook.ps1` pra sincronizar do Workspace.
- v1.0 (15/05/2026): versão inicial do follow-up de funis.
