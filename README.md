# Expert MCPs

MCPs (Model Context Protocol) da Expert Integrado para uso com Claude Code.

## MCPs incluidos

| MCP | Descricao |
|-----|-----------|
| **Pipedrive** | Gerenciar deals, pessoas, atividades e notas no CRM |
| **ClickUp** | Gerenciar tarefas, docs e espacos de trabalho |
| **Zoom** | Mensagens, canais e contatos no Zoom Team Chat |
| **Outlook** | E-mails, calendario e contatos via Microsoft 365 |
| **ChatGuru** | Leitura e envio de mensagens via ChatGuru |
| **WhatsApp** | Mensagens no WhatsApp Web via extensao do navegador |

## Instalacao

### Pre-requisitos

- [Node.js 18+](https://nodejs.org/)
- [Claude Code](https://claude.ai/download) instalado

### Setup

1. Clone o repositorio:
```bash
git clone https://github.com/expertintegrado/skills.git
cd skills
```

2. Execute o setup interativo:
```bash
node setup.js
```

3. O setup vai:
   - Perguntar quais MCPs voce quer instalar
   - Coletar as credenciais necessarias de cada um
   - Rodar `npm install` em cada pacote selecionado
   - Configurar o Claude Code automaticamente

4. Reinicie o Claude Code.

### Instalacao via Claude Code

Tambem e possivel pedir ao Claude Code:

> "Instala os MCPs da Expert Integrado a partir da pasta [caminho]"

## Atualizacao

```bash
git pull
node setup.js
```

O setup preserva MCPs ja configurados e atualiza apenas os selecionados.

## Estrutura

```
expert-mcps/
  packages/
    pipedrive/    — Pipedrive CRM
    clickup/      — ClickUp
    zoom/         — Zoom Team Chat
    outlook/      — Microsoft 365 (Outlook)
    chatguru/     — ChatGuru
    whatsapp/     — WhatsApp Web
  setup.js        — Onboarding interativo
  package.json
  README.md
```

## Credenciais necessarias

| MCP | Credenciais |
|-----|-------------|
| Pipedrive | `PIPEDRIVE_API_KEY` |
| ClickUp | `CLICKUP_API_KEY` |
| Zoom | `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` |
| Outlook | `OUTLOOK_CLIENT_ID`, `OUTLOOK_TENANT_ID` + executar `node auth.js` |
| ChatGuru | `CHATGURU_API_KEY`, `CHATGURU_ACCOUNT_ID`, `CHATGURU_PHONE_ID` (modo full) |
| WhatsApp | Nenhuma — usa extensao do navegador |

## Licenca

MIT - Expert Integrado
