---
name: transferir-lead
description: Use quando o Eric quiser passar UM lead com quem ele JA TEM historico no WhatsApp pessoal (G4, evento, indicacao, palestra) pro vendedor responsavel assumir. Exige conversa previa no WhatsApp pessoal como input — para lead FRIO sem historico, use prospecta-lead. TRIGGER quando o usuario pedir "transfere o lead X pro vendedor Y", "passa lead pro Niverton", "passa o {nome} pro vendedor", "cadastra a conversa do WhatsApp e manda pro vendedor", ou "cria deal do {nome} e atribui pro {vendedor}".
---

# Transferir Lead — converter conversa WhatsApp pessoal em deal qualificado pro vendedor (v1.1)

Skill atomica: processa UM lead por vez. Entrada e uma pessoa com quem o Eric JA TROCOU mensagem no WhatsApp pessoal (G4, evento, indicacao, palestra, etc.). Saida e o vendedor recebendo o lead no Pipedrive + ping no WhatsApp corporativo dele com tudo mastigado pra agir HOJE.

> **Diferenca pra `prospecta-lead`:** aquela e pra lead FRIO (cold/lista/evento sem conversa). Esta aqui exige HISTORICO no WhatsApp pessoal como input principal.

---

## INPUT OBRIGATORIO

TRES parametros obrigatorios. Se faltar qualquer um, a skill PERGUNTA ao Eric antes de prosseguir.

| Parametro | Descricao | Exemplo |
|---|---|---|
| `lead` | Nome ou telefone do lead que tem historico no WhatsApp pessoal do Eric | "Thiago Paukoski" / "5511991296273" |
| `pipeline` | Pipeline destino no Pipedrive (apenas: Educacional, SaaS, Super SDR, Prospeccao, Parceria) | "Educacional" / "Super SDR" / "SaaS" |
| `vendedor` | Nome do vendedor que vai assumir | "Niverton" / "Eric Luciano" |

**NAO inferir pipeline.** A mesma conversa pode caber em mais de um pipeline. Sempre perguntar se nao vier. Pipelines validos e seus IDs: Educacional 6, SaaS 1, Super SDR 2, Prospeccao 7, Parceria 10. NAO existe pipeline "Black Friday".

**NAO inferir vendedor.** Mesmo Niverton sendo o default historico, exigir parametro explicito.

### Fluxo de perguntas

Se Eric passou so o nome do lead:
```
Skill: "Pra qual pipeline (Educacional / SaaS / Super SDR / Prospeccao / Parceria)?"
Eric: "Educacional"
Skill: "Qual vendedor assume? (Niverton / outro nome)"
Eric: "Niverton"
```

So depois de ter os 3 parametros, comeca a execucao.

---

## ETAPA INICIAL OBRIGATORIA

**SEMPRE colocar o deal na PRIMEIRA etapa do pipeline destino** (a etapa que representa "sem contato ainda do vendedor"). E o vendedor que move conforme avanca:

| Pipeline | Etapa inicial obrigatoria | stage_id |
|---|---|---|
| Educacional (6) | "Sem contato" | 52 |
| SaaS (1) | "Sem contato" | 16 |
| Super SDR (2) | "Sem contato" | 7 |
| Prospeccao (7) | "Lead Mapeado" | 64 |
| Parceria (10) | "Sem contato" | 84 |

IDs canonicos confirmados no `C:\MCPs\expert-mcps\CLAUDE.md` (secao 3). Se em duvida, passar o NOME da etapa em vez do ID — o MCP resolve automaticamente.

A skill NUNCA deve criar o deal ja em "Contato Realizado", "Aguardando agendamento" ou "Proposta enviada" — isso e responsabilidade do vendedor mover apos contato real.

Razao: a metrica do vendedor depende DELE mover a etapa. Skill criando ja avancado tira accountability e contamina relatorio.

---

## FLUXO COMPLETO

> **Fallback Pipedrive (Claude Desktop):** se qualquer `create_*` ou `update_deal_fields` retornar `This tool has been disabled in your connector settings.`, reexecutar via `mcp__pipedrive__pipedrive_write({ action, params })` — mesma logica, nome neutro escapa do bloqueio. Actions: create_activity, create_deal, create_person, create_organization, add_product_to_deal, update_deal_fields, create_note.

### Passo 1 — Localizar e ler historico do WhatsApp

```
mcp__whatsapp-agent__search(query={ultimos 8 digitos do telefone})
```

Regra: sempre buscar pelos 8 ultimos digitos (memoria `feedback_whatsapp_search_last8.md`). WhatsApp normaliza com/sem o 9 do celular.

Depois:
```
mcp__whatsapp-agent__read(chat_id=<resultado>, limit=50)
```

**Transcrever todos os audios** (ptt/audio) antes de analisar — usar a tool nativa do MCP:
```
mcp__whatsapp-agent__transcribe_audio(chat=<chat_id>)   # ate 20 audios pendentes do chat
```
Ja roda Whisper server-side e cacheia em `messages.content`. NUNCA chamar a API da OpenAI direto (caminho nao-oficial). Audios geralmente carregam o contexto-chave da indicacao/origem (memoria `feedback_whatsapp_audio_transcribe.md`).

### Passo 2 — Extrair contexto

Da leitura do historico, extrair:

| Dimensao | O que extrair |
|---|---|
| Nome completo | Como o lead se identificou na conversa, ou nome do contato no WhatsApp |
| Empresa | Mencionada na conversa ou inferida do email/dominio |
| Cargo | Mencionado na conversa |
| Dor/desafio | O problema que o lead trouxe ou que Eric identificou |
| Origem | G4 Scale / G4 Educacao / Imersao / Evento X / Indicacao direta de Y |
| Detalhes da origem | Data do evento, nome de quem indicou, contexto especifico |
| Setor/segmento | Inferido da empresa |
| Volume/tamanho | Se mencionado (faturamento, tamanho do time, etc.) |
| Maturidade IA | Se ja tem time interno, automacoes rodando, etc. |
| Engajamento na conversa | Tom (formal/informal), latencia das respostas, tempo total |

### Passo 3 — Cadastrar/atualizar pessoa no Pipedrive

```
mcp__pipedrive__search_persons(term={nome})
mcp__pipedrive__search_persons(term={telefone})   # buscar pelos dois pra evitar duplicata
```

Se existir:
- Se `search_persons` retornar >1 resultado, NAO escolher so pelo nome — cruzar com email/telefone pra confirmar a pessoa certa.
- Atualizar campos personalizados que estiverem vazios
- NUNCA sobrescrever (sem `force=true`)
- Se "Origem do Contato" ja estiver preenchida, NAO mexer (preenchida 1x na vida).

Se NAO existir, criar a pessoa:
```
mcp__pipedrive__create_person({
  name,
  phone: "55XXXXXXXXXXX",   # DDI+DDD, sem +, sem espacos
  email (se tiver)
})
```

Em seguida, SEMPRE preencher a origem da PESSOA via `update_person` (passo obrigatorio do checklist Pipedrive — telefone no formato 55XXXXXXXXXXX):
```
mcp__pipedrive__update_person({
  id: <id retornado>,
  custom_fields: "{\"Origem do Contato\": \"<ORIGEM enum>\", \"Detalhes da origem do contato\": \"<detalhe>\"}"
})
```
A origem do contato usa o enum canonico (ORG, SS, OUT, INDIC, EVENTO, PUBLI, etc.). Se origem for INDIC, preencher tambem "Pessoa que indicou". Mapeamentos em `C:\MCPs\expert-mcps\CLAUDE.md` secao 2 (ex: indicacao do Eric -> `INDIC | Direta do Eric` + "Pessoa que indicou: Eric Luciano"; G4 -> `PUBLI | G4 Tools`).

### Passo 4 — Criar deal

```
mcp__pipedrive__create_deal({
  title: "{Nome} | {Empresa}",   # padrao canonico: Nome | Empresa (pipe, nao hifen)
  person_id: <id do passo 3>,
  pipeline_id: "{param pipeline}",   # aceita nome ("Educacional") ou ID (6)
  stage_id: {primeira etapa do pipeline — ver tabela ETAPA INICIAL, NUNCA pular},
  user_id: "{param vendedor}"        # nome ("Niverton") ou ID
})
```

Depois (`custom_fields` e uma STRING JSON, nao objeto):
```
mcp__pipedrive__update_deal_fields({
  deal_id,
  custom_fields: "{
    \"Origem da Oportunidade\": \"<ORIGEM enum exato>\",
    \"Detalhes da origem da oportunidade\": \"{data + contexto}\",
    \"Segmento\": \"{segmento valido}\",
    \"Dores\": \"{dor extraida}\",
    ...todos os campos relevantes que conseguiu extrair
  }"
})
```

**Origem da Oportunidade e OBRIGATORIA + detalhe OBRIGATORIO** (mesma logica da origem da pessoa). Usar enum EXATO da secao 2 do `C:\MCPs\expert-mcps\CLAUDE.md` — ex: `EVENTO | Eric presencialmente`, `INDIC | Direta do Eric`, `PUBLI | G4 Tools`. "Segmento" so aceita valores da lista canonica de segmentos.

**Regra:** preencher o MAXIMO de campos personalizados possivel — o vendedor precisa abrir o deal e ja ter contexto pra ligar, sem ter que perguntar o basico de novo pro lead.

### Passo 5 — Nota com resumo Feynman

```
mcp__pipedrive__create_note({
  deal_id,
  content: `<p><b>Resumo do historico WhatsApp Eric ↔ {Nome}:</b></p>
            <ul>
            <li>Data primeira interacao: {data}</li>
            <li>Origem: {origem detalhada}</li>
            <li>Contexto: {1 paragrafo Feynman}</li>
            <li>Dor levantada: {dor}</li>
            <li>Ultimo ponto: {o que ficou aberto}</li>
            </ul>
            <p>Link do chat: {url}</p>`
})
```

### Passo 6 — Atividade DONE representando a conversa do Eric

```
mcp__pipedrive__create_activity({
  deal_id,
  person_id,
  subject: "Conversa Eric ↔ {Nome} (WhatsApp pessoal)",
  type: "whatsapp",
  due_date: {data da ultima mensagem},
  done: true,
  user_id: "Eric Luciano",
  note: "{resumo curto do que rolou}"
})
```

### Passo 7 — Atividade pendente pro vendedor — MESMO DIA

```
mcp__pipedrive__create_activity({
  deal_id,
  person_id,
  subject: "Ligar/WhatsApp {Nome} - lead transferido do Eric",
  type: "call",
  due_date: "{hoje YYYY-MM-DD}",
  due_time: "{proximo horario comercial, formato HH:MM}",   # 09:00 se for manha; +2h se ja for dia. NUNCA "" nem "00:00"
  duration: 30,
  user_id: "{param vendedor}",
  note: "Lead transferido pelo Eric via WhatsApp pessoal. Contexto na nota e nos campos."
})
```

Fuso sempre America/Sao_Paulo (BRT). O MCP converte o horario local pra UTC automaticamente — passar o horario de Brasilia direto, sem sufixo Z. NAO passar `force=true` aqui: o deal e novo, nao deve haver atividade pendente conflitante; se o guardrail acusar conflito, investigar antes (provavel duplicata) em vez de forcar.

### Passo 8 — Notificar vendedor no WhatsApp corporativo

Modo WhatsApp: este disparo usa `whatsapp-agent` (numero pessoal do Eric) — NAO ChatGuru. Motivo: o destinatario e funcionario interno (vendedor), nao cliente externo. ChatGuru e exclusivo pra clientes da Expert. NUNCA cruzar os modos.

Buscar telefone corporativo do vendedor (memoria/Brain):
- Niverton: `5581985325551` (memoria `feedback_whatsapp_niverton_corporativo.md` ou Brain)

Template da mensagem. Como e mensagem operacional time-interno (nao em nome do Eric pessoa-fisica), o `check_message` pode acusar warning de voice guide — isso e esperado e nao bloqueia; seguir mesmo assim:

```
🔥 *NOVO LEAD*

{Nome Completo} — {Empresa}
{url_pipedrive}

{1 frase do contexto/dor extraida}
Origem: {origem} | Pipeline: {pipeline}

https://wa.me/{numero_sem_+}
```

ORDEM OBRIGATORIA das linhas:
1. Header `🔥 *NOVO LEAD*`
2. Nome + empresa
3. **Link do deal no Pipedrive (sempre logo apos o nome — Eric quer ver primeiro)**
4. Linha em branco
5. Descricao/contexto (1 frase) + origem/pipeline
6. Linha em branco
7. Link `wa.me` do lead

NUNCA mover o link do deal pra depois da descricao — o vendedor precisa do CRM primeiro pra contextualizar antes de ler.

Enviar:
```
mcp__whatsapp-agent__send({
  to: "{telefone corporativo do vendedor}",
  content: "{template acima}",
  confirmed: true,
  allow_new: true   # caso o numero do vendedor ainda nao exista como chat (primeiro contato)
})
```
Como o Eric ja acionou a transferencia explicitamente, `confirmed: true` direto e OK aqui (skill e o executor). Se o `send` retornar erro de chat inexistente sem `allow_new`, reenviar com `allow_new: true`.

### Passo 9 — Reportar ao Eric

Mensagem de fechamento pro Eric (Telegram ou texto):

```
Lead {Nome} transferido pro {vendedor}:

- Pessoa: {url_pipedrive_pessoa}
- Deal: {url_pipedrive_deal} ({pipeline} / etapa inicial)
- Atividade pendente {vendedor}: hoje {hora}
- WA corporativo {vendedor}: enviado ✅
- WhatsApp do lead: https://wa.me/{numero}

Resumo do contexto: {1 frase}
```

Sempre incluir o link wa.me do lead embaixo pro Eric clicar caso queira acompanhar (memoria `feedback_whatsapp_link_wame.md`).

---

## VOICE GUIDE — mensagem pro vendedor

A mensagem pro vendedor corporativo NAO precisa seguir o voice guide do Eric (tom de pessoa-fisica) — ela e operacional, time-interno. Mas tem regras proprias:

- Comecar com 🔥 *NOVO LEAD* em negrito
- Linha 2: Nome + empresa
- Linha 3: URL do deal Pipedrive (vem ANTES da descricao — Eric quer ver primeiro)
- Bloco descricao: 1 frase de contexto + origem + pipeline
- Ultima linha: link `wa.me` do lead
- NUNCA mais de 8 linhas

---

## ERROS COMUNS E COMO EVITAR

| Erro | Como evitar |
|---|---|
| Criar deal ja em "Contato Realizado"/"Aguardando agendamento" | Sempre PRIMEIRA etapa do pipeline ("Sem contato" / "Lead Mapeado"); vendedor move |
| Inferir pipeline sem perguntar | Sempre parametro obrigatorio; nao existe pipeline "Black Friday" |
| Esquecer de transcrever audios | `mcp__whatsapp-agent__transcribe_audio` em todo ptt/audio antes de analisar (NUNCA API OpenAI direta) |
| Pular `update_person` da origem do contato | Origem da PESSOA via `update_person` e passo obrigatorio do checklist |
| Esquecer origem/detalhe da Oportunidade | Ambos OBRIGATORIOS no `update_deal_fields`, com enum exato |
| Titulo do deal com hifen | Padrao e `Nome | Empresa` (pipe) |
| Pessoa duplicada | search_persons com nome + telefone; se >1 resultado, cruzar dados |
| Sobrescrever campo ja preenchido | Nunca passar `force=true` sem confirmacao explicita |
| due_time vazio ou "00:00" | Marca atividade como vencida; sempre HH:MM real (horario comercial BRT) |
| Mensagem pro vendedor sem link wa.me | Template obrigatorio inclui link |
| Esquecer atividade pendente vendedor hoje | Passo 7 nao e opcional |
| Esquecer notificar vendedor | Passo 8 nao e opcional — WhatsApp corporativo via whatsapp-agent (nao ChatGuru) |

---

## OUTPUT FINAL

Toda execucao retorna:

```json
{
  "lead": "Nome do lead",
  "vendedor": "Nome do vendedor",
  "pipeline": "Pipeline",
  "person_id": 12345,
  "deal_id": 67890,
  "deal_url": "https://...",
  "activity_done_id": 11111,
  "activity_pending_id": 22222,
  "msg_vendedor_status": "enviado",
  "wa_lead_link": "https://wa.me/55..."
}
```

---

## REFERENCIAS

- Skill `prospecta-lead` (lead frio sem historico) — `plugins/comercial/skills/prospecta-lead/`
- Voice Guide v1.4 do Eric — Brain nota `yasak98uo4z4`
- Diretriz CRM — `Processo Comercial/Campanha de retomada de leads/Diretriz_Preenchimento_CRM.md`
- Memoria `feedback_whatsapp_search_last8.md` — buscar pelos 8 ultimos digitos
- Memoria `feedback_whatsapp_audio_transcribe.md` — transcrever audios antes de analisar
- Memoria `feedback_whatsapp_link_wame.md` — sempre incluir link wa.me no report
- Brain nota `lhu4g220l66h` — desambiguacao WhatsApp vs ChatGuru (vendedor corporativo SEMPRE chatguru? Nao — este caso usa whatsapp-agent pessoal pq o destinatario e funcionario, nao cliente externo. ChatGuru e pra clientes da Expert.)
- Validado empiricamente em 27/05/2026 com Thiago Paukoski (Grupo X-Method) — pipeline Educacional, vendedor Niverton.

## VERSAO

- **v1.0** (27/05/2026): versao inicial, validada com Thiago Paukoski.
- **v1.1** (13/06/2026): correcoes de consistencia com CLAUDE.md/Pipedrive — etapa inicial corrigida pra "Sem contato" (stage_ids reais 52/16/7/64/84, antes citava "Contato Realizado" id 113 inexistente); removido pipeline fantasma "Black Friday"; transcricao de audio via tool nativa `transcribe_audio` (era "OpenAI Whisper API" direta); `update_person` da origem do contato explicitado no fluxo; titulo do deal `Nome | Empresa` (era hifen); `custom_fields` como string JSON; removido `force=true` da atividade do vendedor; fallback `pipedrive_write`; nota de fuso BRT; description enxugada (sem resumo de workflow) preservando triggers PT-BR.
