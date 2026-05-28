---
name: calendly-agendar
description: Agenda uma reunião no Calendly de forma totalmente automática para um convidado. Tenta via API primeiro; se falhar, usa Playwright para navegar no Calendly e completar o agendamento clicando no slot real. TRIGGER quando o usuário pedir "agenda a call", "marca reunião com o lead", "agenda o diagnóstico de [nome]", "agendar automaticamente no Calendly", ou similar.
---

# Calendly — Agendar Automaticamente

Fluxo completo de agendamento: coleta dados do lead, escolhe tipo de evento e slot, tenta via API e usa Playwright como fallback para clicar e confirmar no browser.

---

## FLUXO

### Passo 1: Coletar dados do convidado

Extrair do contexto ou perguntar ao usuário:

| Campo | Obrigatório | Obs |
|---|---|---|
| Nome completo | Sim | |
| E-mail | Sim | |
| WhatsApp | Sim | Campo "WhatsApp" do formulário |
| Empresa | Sim | Campo "Nome da Empresa" |
| Observações | Não | Contexto da conversa, dores, origem |

Se o contexto já tiver esses dados (deal Pipedrive, conversa WhatsApp, etc.), usar sem perguntar.

### Passo 2: Escolher tipo de evento

Chamar `mcp__calendly__calendly_list_event_types`.

Se não óbvio pelo contexto, apresentar opções e aguardar escolha.
Padrão para leads de prospecção: **Diagnóstico de IA e Automação (60min)**.

### Passo 3: Escolher slot

Chamar `mcp__calendly__calendly_list_available_slots` com `start_date` = hoje e `end_date` = +7 dias.

Apresentar os próximos 5 slots disponíveis em horário de Brasília e perguntar qual o usuário prefere (ou se o lead já escolheu um horário específico, buscar o slot mais próximo desse horário).

### Passo 4: Tentar agendamento via API

Chamar `mcp__calendly__calendly_schedule` com todos os dados.

**Se `success: true` e `method: "direct_api"`:**
- Agendamento confirmado via API
- Retornar: URI do evento, horário BRT, link Zoom (buscar via `calendly_get_event` se não retornado)
- Registrar nota no Pipedrive se deal existir

**Se `success: false` e `method: "prefill_url"`:**
- API falhou (erro de location/scope) — ir para Passo 5 (Playwright)

### Passo 5: Fallback via Playwright

Usar o `prefill_url` retornado pelo `calendly_schedule` que já tem nome, e-mail, WhatsApp, empresa e observações pré-preenchidos.

Construir a URL de slot direto para o Calendly (formato que pré-seleciona a data):
- A URL base do evento + params de prefill já inclui os dados do invitee
- O slot específico precisa ser selecionado navegando pelo calendário

#### 5a. Abrir o Calendly no browser

```
mcp__playwright__browser_navigate(url: prefill_url)
```

Aguardar o calendário carregar (`mcp__playwright__browser_wait_for` com seletor `.calendar` ou similar).

Tirar snapshot para ver o estado atual:
```
mcp__playwright__browser_snapshot()
```

#### 5b. Navegar até a data correta

O calendário do Calendly mostra o mês atual. Se o slot escolhido for em outro mês, clicar no botão "próximo mês".

Identificar o botão da data correta no snapshot e clicar:
```
mcp__playwright__browser_click(element: "dia [X] de [mês]")
```

#### 5c. Clicar no horário

Após clicar na data, os horários aparecem no lado direito ou abaixo. Identificar o horário correto e clicar:
```
mcp__playwright__browser_click(element: "[HH:MM]")
```

#### 5d. Avançar para o formulário

Clicar em "Próximo" ou "Next" se houver:
```
mcp__playwright__browser_click(element: "Próximo")
```

#### 5e. Verificar e preencher o formulário

Os campos de nome e e-mail já devem estar preenchidos via URL params. Verificar via snapshot.

Se algum campo estiver vazio, preencher:
```
mcp__playwright__browser_fill_form(fields: {
  "name": "[nome]",
  "email": "[email]",
  "WhatsApp": "[telefone]",
  "Nome da Empresa": "[empresa]"
})
```

#### 5f. Confirmar o agendamento

Tirar snapshot antes de submeter para confirmar que tudo está correto.

Clicar no botão de confirmação:
```
mcp__playwright__browser_click(element: "Confirmar Evento" ou "Schedule Event")
```

#### 5g. Verificar resultado

Tirar screenshot e snapshot da página de confirmação.

**Se confirmação bem-sucedida:**
- Extrair horário e link Zoom da página de confirmação
- Reportar ao usuário com os detalhes

**Se aparecer erro de CAPTCHA ou "Esta reserva não pode ser concluída":**
- Reportar o bloqueio ao usuário
- Oferecer o `prefill_url` para Eric abrir manualmente (1 clique para confirmar)
- Sugerir alternativa: `calendly-link` para enviar ao próprio lead escolher horário

---

## REGRAS

- Nunca inventar horários — sempre usar slots retornados por `calendly_list_available_slots`
- Se o lead já disse "pode ser quinta às 10h", confirmar com Eric antes de agendar
- Após agendamento confirmado (API ou Playwright), registrar atividade no Pipedrive se deal existir:
  - Tipo: `diagnostico`
  - Título: `Diagnóstico agendado — [Nome] | [Empresa]`
  - Data/hora: slot agendado
  - Nota: link Zoom + origem do agendamento
- Não criar atividade Pipedrive se o agendamento veio do Calendly (integração nativa cria automaticamente)
- Horários sempre exibidos em Brasília (BRT, UTC-3)
