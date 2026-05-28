---
name: calendly-link
description: Gera um link de agendamento único (single-use) do Calendly para enviar ao lead. O lead escolhe o próprio horário; o link expira após um uso. TRIGGER quando o usuário pedir "cria link do Calendly", "gera link de agendamento", "link único pro lead", "manda link de diagnóstico", ou similar.
---

# Calendly — Gerar Link Único

Cria um link de agendamento single-use para enviar ao lead via WhatsApp ou e-mail.

---

## FLUXO

### Passo 1: Identificar o tipo de evento

Chamar `mcp__calendly__calendly_list_event_types` para listar os tipos disponíveis.

Apresentar ao usuário de forma compacta:

```
Qual tipo de evento?
1. Diagnóstico de IA e Automação (60min)
2. Apresentação de Projeto (60min)
3. Reunião geral (30min)
4. Reunião geral (60min)
... (outros)
```

Se o contexto já indicar claramente o tipo (ex: "link de diagnóstico" → Diagnóstico de IA e Automação), usar sem perguntar.

### Passo 2: Gerar o link

Chamar `mcp__calendly__calendly_create_scheduling_link` com:
- `event_type_uri`: URI do tipo escolhido
- `max_uses`: 1 (padrão — single-use)

### Passo 3: Retornar

Responder com:
- O link curto (ex: `https://calendly.com/d/xxx-yyy-zzz`)
- Qual tipo de evento
- Instrução: "o link expira após um agendamento"
- Sugestão de mensagem curta pra mandar no WhatsApp:

```
Oi [Nome], tudo bem? Segue o link pra você escolher o melhor horário pra gente conversar:
[link]
Após agendar, você recebe a confirmação com o link Zoom automaticamente.
```

---

## REGRAS

- Nunca criar mais de 1 link por lead na mesma interação, a menos que o usuário peça
- O link não tem data de expiração por tempo — só expira após uso
- Se o usuário quiser enviar no WhatsApp, perguntar se quer que o agente envie via `mcp__whatsapp-agent__send` ou só copiar o link
