# Expert MCPs

MCPs (Model Context Protocol) da Expert Integrado para uso com Claude Code.

## MCPs incluídos

| MCP | Descrição |
|-----|-----------|
| **Pipedrive** | Gerenciar deals, pessoas, atividades e notas no CRM |
| **ClickUp** | Gerenciar tarefas, docs e espaços de trabalho |
| **Zoom** | Mensagens, canais e contatos no Zoom Team Chat |
| **Outlook** | E-mails, calendário e contatos via Microsoft 365 |
| **ChatGuru** | Leitura e envio de mensagens via ChatGuru |
| **WhatsApp** | Mensagens no WhatsApp Web via extensão do navegador |

## Pré-requisitos

- [Node.js 18+](https://nodejs.org/) — instale e reinicie o computador
- [Claude Code](https://claude.ai/download) instalado e funcionando

## Instalação (100% via Claude Code)

Todo o processo é feito pelo Claude Code. Você não precisa abrir o CMD.

### Passo 1 — Baixar os MCPs

Abra o Claude Code e peça:

> "Clona o repositório https://github.com/expertintegrado/skills.git em C:\MCPs\expert-mcps"

Se preferir, baixe o zip do Google Drive (pasta `Operações > Ferramentas IA`) e extraia em `C:\MCPs\expert-mcps`.

### Passo 2 — Instalar os MCPs que você precisa

Diga ao Claude Code quais MCPs quer instalar. Exemplos:

> "Instala o MCP do Pipedrive que está em C:\MCPs\expert-mcps\packages\pipedrive. Roda npm install, configura o .env com minha API key [COLE_AQUI] e adiciona no claude_desktop_config.json"

> "Instala os MCPs de Pipedrive e ClickUp da pasta C:\MCPs\expert-mcps\packages"

> "Instala todos os MCPs da pasta C:\MCPs\expert-mcps\packages"

O Claude Code faz tudo: npm install, criação do .env, configuração no `claude_desktop_config.json`.

### Passo 3 — Fornecer suas credenciais

Cada MCP precisa de credenciais pessoais. Veja a tabela abaixo e tenha as suas em mãos:

| MCP | O que você precisa | Onde conseguir |
|-----|--------------------|----------------|
| Pipedrive | `PIPEDRIVE_API_KEY` | Pipedrive > Configurações > Preferências pessoais > API |
| ClickUp | `CLICKUP_API_KEY` | ClickUp > Settings > Apps > API Token |
| Zoom | `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | Pedir ao Eric (credenciais do app) |
| Outlook | `OUTLOOK_CLIENT_ID`, `OUTLOOK_TENANT_ID` | Pedir ao Eric (registro do app Azure) |
| ChatGuru (readonly) | Nenhuma credencial de API | Apenas rodar login do Playwright |
| ChatGuru (full) | `CHATGURU_API_KEY`, `CHATGURU_ACCOUNT_ID`, `CHATGURU_PHONE_ID` | Pedir ao Eric |
| WhatsApp | Nenhuma | Usa extensão do navegador |

### Passo 4 — Autenticação extra (quando necessário)

Alguns MCPs precisam de um passo extra após a instalação:

**Outlook:** Diga ao Claude Code:
> "Roda node auth.js na pasta C:\MCPs\expert-mcps\packages\outlook"

Siga as instruções na tela (copie o código e cole no navegador).

**Zoom:** Diga ao Claude Code:
> "Roda npm run auth na pasta C:\MCPs\expert-mcps\packages\zoom"

Autorize com sua conta Zoom no navegador.

**ChatGuru (modo readonly):** Diga ao Claude Code:
> "Roda node login.js na pasta C:\MCPs\expert-mcps\packages\chatguru com CHATGURU_SERVER=17"

Faça login no ChatGuru quando o navegador abrir.

### Passo 5 — Reiniciar

Feche e reabra o Claude Code (ou Claude Desktop). Os MCPs instalados vão aparecer automaticamente.

## Verificação

Após reiniciar, teste pedindo ao Claude:

> "Lista meus deals abertos no Pipedrive"

> "Mostra meus compromissos de amanhã no Outlook"

> "Quais tarefas tenho no ClickUp?"

Se algo não funcionar, peça ao Claude Code:
> "Verifica se o claude_desktop_config.json está correto e se todos os MCPs em C:\MCPs\expert-mcps\packages estão configurados"

## Atualização

Quando houver atualização, peça ao Claude Code:

> "Atualiza o repositório em C:\MCPs\expert-mcps com git pull e roda npm install nos MCPs que eu uso"

## Estrutura do repositório

```
expert-mcps/
  packages/
    pipedrive/    — Pipedrive CRM
    clickup/      — ClickUp
    zoom/         — Zoom Team Chat
    outlook/      — Microsoft 365 (Outlook)
    chatguru/     — ChatGuru (modo readonly ou full)
    whatsapp/     — WhatsApp Web
  setup.js        — Onboarding interativo (alternativa via terminal)
  package.json
  README.md
```

## ChatGuru — Modos de acesso

| Modo | Quem usa | Ferramentas | Precisa de API key? |
|------|----------|-------------|---------------------|
| **readonly** | Todos da equipe | 4 ferramentas (leitura de chats e mensagens) | Não |
| **full** | Gestores | 14 ferramentas (leitura + envio + registro) | Sim |

Para configurar o modo, peça ao Claude Code:
> "Configura o ChatGuru MCP em modo readonly no meu claude_desktop_config.json"

Ou para modo full:
> "Configura o ChatGuru MCP em modo full com as credenciais [API_KEY], [ACCOUNT_ID], [PHONE_ID]"

## Licença

MIT - Expert Integrado
