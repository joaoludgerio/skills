# Tech Stack & Ferramentas

## Ferramentas do Dia a Dia
- **ClickUp** — Gestao de tarefas e projetos
- **Pipedrive** — CRM (deals, pipeline, contatos)
- **Zoom** — Reunioes e chat interno
- **Outlook / Microsoft 365** — Email e calendario
- **ChatGuru** — Atendimento WhatsApp empresarial

## Automacao e Produto
- **N8N** — Plataforma principal de automacao
- **WhatsApp API Oficial** — Canal principal Super SDR
- **Manychat** — Integracao Instagram Direct
- **ChatGuru** — Plataforma de atendimento WhatsApp (parceiro)

## MCPs Configurados no Claude
MCPs sao conexoes que permitem ao Claude acessar suas ferramentas diretamente.

| MCP | O que faz |
|-----|-----------|
| Pipedrive | Deals, contatos, atividades, notas do CRM |
| ClickUp | Tarefas, documentos, time tracking |
| Zoom | Mensagens, canais e contatos do Zoom |
| Outlook | E-mail, calendario e contatos Microsoft 365 |
| ChatGuru | WhatsApp empresarial (ler e enviar mensagens, notas, contexto) |

Os MCPs disponiveis variam por colaborador conforme o que foi configurado na sua maquina. A lista acima sao os MCPs corporativos da Expert; nem todos estarao ativos no seu Claude.

## Roteamento — Qual ferramenta usar quando
| Voce pede... | O Claude usa |
|--------------|-------------|
| CRM, deals, pipeline, atividades | Pipedrive |
| Tarefas, projetos, time tracking | ClickUp |
| E-mail, agenda, compromissos | Outlook |
| Mensagens, canais do Zoom | Zoom |
| WhatsApp empresarial (conversas, envio) | ChatGuru |

## WhatsApp — atencao ao modo

- "Manda no ChatGuru" / "responde no ChatGuru" → enviar pelo MCP ChatGuru (WhatsApp corporativo da Expert).
- "Me passa o link de WhatsApp do fulano" → entregar apenas `https://wa.me/{numero}`, sem disparar mensagem.
- Nunca disparar mensagem quando o pedido foi so pelo link.
