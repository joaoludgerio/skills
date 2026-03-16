# ChatGuru MCP Server

MCP (Model Context Protocol) server para integração com o ChatGuru WhatsApp. Permite que assistentes AI (Claude Code, Claude Desktop, etc.) enviem mensagens, leiam conversas e gerenciem contatos no ChatGuru.

> **Credenciais são pessoais.** Cada pessoa usa sua própria API Key do ChatGuru. Nenhuma credencial está incluída neste repositório.

## Modos de operação

O ChatGuru MCP opera em dois modos, controlados pela variável `CHATGURU_MODE`:

| Modo | Quem usa | Requer API Key | Ferramentas |
|------|----------|:--------------:|:-----------:|
| **readonly** | Todos | Não | 4 (leitura via Playwright) |
| **full** | Gestores | Sim | 14 (API + Playwright) |

## Funcionalidades

### Modo readonly (Playwright)
- **Leitura**: ler histórico de mensagens, listar chats com filtros avançados
- **Busca**: buscar contatos existentes por telefone (individual ou em lote)

### Modo full (API + Playwright)
Tudo do modo readonly, mais:
- **Mensagens**: enviar texto, arquivos via URL, verificar status de entrega
- **Contatos**: registrar novos chats, atualizar campos customizados, nome e contexto
- **Notas**: adicionar notas internas em conversas
- **Fluxos**: executar diálogos/fluxos automatizados

## Pré-requisitos

- Node.js 18+
- **Modo readonly**: apenas número do Server (peça ao admin)
- **Modo full**: API Key, Account ID, Phone ID e Server (peça ao admin da conta)

## Como usar

### 1. Clonar e instalar

```bash
git clone https://github.com/ericlucianoferreira/chatguru-mcp.git
cd chatguru-mcp
npm install
```

### 2. Login Playwright (obrigatório para ambos os modos)

```bash
CHATGURU_SERVER=17 npm run login
```

Um browser Chromium vai abrir. Faça login no painel do ChatGuru. A sessão é salva em `session.json`.

### 3. Configurar no Claude Desktop

Edite `C:\Users\SeuUsuario\AppData\Roaming\Claude\claude_desktop_config.json`:

**Modo readonly** (sem API key):
```json
{
  "mcpServers": {
    "chatguru": {
      "command": "node",
      "args": ["C:\\MCPs\\chatguru-mcp\\index.js"],
      "env": {
        "CHATGURU_MODE": "readonly",
        "CHATGURU_SERVER": "17"
      }
    }
  }
}
```

**Modo full** (com API key):
```json
{
  "mcpServers": {
    "chatguru": {
      "command": "node",
      "args": ["C:\\MCPs\\chatguru-mcp\\index.js"],
      "env": {
        "CHATGURU_MODE": "full",
        "CHATGURU_API_KEY": "sua_chave_aqui",
        "CHATGURU_ACCOUNT_ID": "seu_account_id_aqui",
        "CHATGURU_PHONE_ID": "seu_phone_id_aqui",
        "CHATGURU_SERVER": "17"
      }
    }
  }
}
```

### 4. Reiniciar o Claude Desktop

Feche e reabra o Claude Desktop para carregar o MCP.

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm start` | Inicia o MCP server |
| `npm run login` | Login no ChatGuru via Playwright |
| `npm run setup` | Setup interativo inicial |

## Ferramentas disponíveis

### Sempre disponíveis (readonly + full)

| Ferramenta | Descrição |
|---|---|
| `chatguru_get_chat_link` | Busca contato pelo telefone (Playwright) |
| `chatguru_batch_get_chat_links` | Busca múltiplos contatos de uma vez (Playwright) |
| `chatguru_read_messages` | Lê histórico de mensagens de uma conversa |
| `chatguru_list_chats` | Lista chats com filtros avançados |

### Apenas no modo full

| Ferramenta | Descrição |
|---|---|
| `chatguru_send_message` | Envia mensagem de texto para um contato |
| `chatguru_send_file` | Envia arquivo via URL |
| `chatguru_get_message_status` | Verifica status de entrega de uma mensagem |
| `chatguru_register_chat` | Registra um novo contato/chat |
| `chatguru_get_chat_status` | Verifica status de registro de um chat |
| `chatguru_update_custom_fields` | Atualiza campos customizados de um contato |
| `chatguru_update_chat_name` | Atualiza o nome de um contato |
| `chatguru_update_context` | Atualiza o contexto/tag de uma conversa |
| `chatguru_add_note` | Adiciona nota interna em uma conversa |
| `chatguru_execute_dialog` | Executa um fluxo/diálogo automatizado |

## Exemplos de uso

**Readonly:**
- "Mostre os chats abertos no ChatGuru"
- "Leia as últimas mensagens do chat com 5581991095702"
- "Busque o contato 5511999887766 no ChatGuru"

**Full:**
- "Envie uma mensagem para 5581991095702: 'Olá, tudo bem?'"
- "Adicione uma nota no chat do João: 'Cliente aguardando retorno'"
- "Execute o fluxo X no chat com 5511999887766"

## Segurança

- Credenciais via variáveis de ambiente — nunca commitadas no repositório
- `.env` está no `.gitignore`
- `session.json` (cache do Playwright) está no `.gitignore`

## Licença

MIT
