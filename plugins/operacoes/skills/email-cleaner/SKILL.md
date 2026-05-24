---
name: email-cleaner
description: "Limpa a inbox do Outlook do Eric usando regras canônicas + classificação por LLM com leitura do conteúdo. Move pra pastas semânticas em vez de deletar (exceto phishing comprovado). Use quando o Eric pedir 'limpa minha inbox', 'tô com email acumulado', 'organiza meu Outlook', 'varre os não lidos', ou similar."
argument-hint: "[--dry-run] [--max=N]"
allowed-tools: Bash, Read, Edit
---

Skill que limpa a inbox do Outlook do Eric com princípio **"ler antes de deletar"**.

## Princípios

1. **Ler antes de deletar** — só deleta phishing comprovado e propaganda 100% genérica. Resto vai pra pasta semântica.
2. **Reversibilidade > velocidade** — mover pra pasta sempre prefere a deletar.
3. **Aprender com decisões** — toda decisão manual do Eric vira regra em `rules.json`.
4. **Cliente reclamando = checar ClickUp antes** — antes de propor resposta a cliente externo, recall no Brain (`ona1g1cgyqz3`) + verificar Lista Satisfação dos Clientes (`https://app.clickup.com/30962394/v/b/xgwpu-68133`).

## Pastas semânticas

A skill cria automaticamente se faltar:

| Pasta | O que vai |
|-------|-----------|
| `Reuniões/Gravações` | Recaps de Zoom/Fireflies/tldv com pessoas (não Daily/recorrentes vazios) |
| `Notificações Sistema` | Alertas SaaS sem ação (deploy ok, login novo, OAuth approval) |
| `Recibo` | Comprovantes de pagamento, NF emitidas (já existe) |
| `Cobranças Falhas` | Pagamentos não processados — atenção 24h |
| `Alertas Segurança` | CVEs, kernel updates, suspensões — verificar imediato |
| `Afiliados` | Comissões (Rewardful, Lovable affiliate) |
| `Asaas` | Cobranças clientes |
| `Comunicação Equipe` | Interno expertintegrado |
| `Comunicação Cliente` | Humanos externos com pedido |
| `Newsletter` | Conteúdo já consumido (já existe) |
| `Convites Eventos` | Calendário externo |
| `Itens Excluídos` | Lixo real (phishing, spam) |

## Fluxo de execução

### Setup do ambiente (1x por máquina)

A skill é self-contained — tem `package.json` próprio com `@azure/msal-node`. Em máquina nova:

```bash
cd "C:/Users/Eric Luciano/.claude/skills/email-cleaner" && npm install
```

Depois disso, basta chamar o script direto (não precisa cd nem nada):

```bash
node "C:/Users/Eric Luciano/.claude/skills/email-cleaner/scripts/cleaner.mjs" <subcomando>
```

### 1. Pré-flight

```bash
node "C:/Users/Eric Luciano/.claude/skills/email-cleaner/scripts/cleaner.mjs" --auth-check
```

Se retornar "SEM_AUTH", pedir pro Eric rodar (ele precisa fazer no terminal dele):
```bash
node "C:/Users/Eric Luciano/.claude/skills/email-cleaner/scripts/cleaner.mjs" --auth
```
E aguardar confirmação.

### 2. Snapshot dos não lidos

```bash
node ".../cleaner.mjs" --inspect-all
```
Gera `C:/tmp/inbox-unread.json` com `{id, from_addr, from_name, subject, date}`.

### 3. Aplicar regras canônicas (dry-run primeiro)

```bash
node ".../cleaner.mjs" --apply-rules --dry-run
```

Mostra: quantos casa cada regra, quantos sobram não cobertos. Apresentar volumes pro Eric e pedir confirmação.

### 4. Executar regras

```bash
node ".../cleaner.mjs" --apply-rules --execute
```

### 5. Triagem cognitiva dos não cobertos

Pra cada email não coberto por regra:

```bash
node ".../cleaner.mjs" --view <id>
```

Ler corpo, classificar em uma das categorias (mover pra pasta correspondente) ou marcar como "humano que precisa Eric".

**Heurísticas pra decisão:**
- Nome real + domínio não-SaaS + assunto pessoal → humano
- "Notificação", "alert", "deploy", "OAuth" → Notificações Sistema
- "Receipt", "Recibo", "NF", "Fatura paga" → Recibo
- "Failed", "unsuccessful", "bloqueio", "cancelamento" → Cobranças Falhas
- "CVE", "vulnerability", "security", "suspended" → Alertas Segurança
- Recap/transcript de reunião com nome de pessoa → Reuniões/Gravações
- Newsletter/marketing já enviado várias vezes → Newsletter

### 6. Apresentar humanos pro Eric

Pra cada humano confirmado, **antes de propor ação**:
1. Recall no Brain: `mcp__expert-brain__recall("Lista Satisfação ClickUp <nome cliente>")`
2. Se cliente reclamando, consultar lista ClickUp `901305474727` via API REST direta
3. Se já tem CS cuidando, marcar email como lido (não envolver Eric)
4. Se NÃO tem ninguém cuidando, apresentar pro Eric com contexto + sugestão

### 7. Cauda longa final

O que sobrar após triagem cognitiva → mark-read em massa.

### 8. Logout

```bash
node ".../cleaner.mjs" --logout
```

Apaga o token isolado em `C:/tmp/email-cleaner-token.json`. Pegada zero.

## Aprender com decisões

Quando o Eric tomar uma decisão sobre um remetente novo, **atualizar `rules.json`** adicionando o remetente na categoria correspondente. Isso reduz triagem manual em rodadas futuras.

## Subcomandos disponíveis

```
--auth                Device code flow (1x por sessão)
--auth-check          Verifica se token existe
--logout              Apaga token /tmp
--list-folders        Lista pastas existentes
--inspect-all         Dumpa não-lidos em /tmp/inbox-unread.json
--apply-rules --dry-run|--execute    Aplica rules.json
--view <id>           Mostra corpo completo do email
--reply <id> --body "texto"
--delete-ids "<id>,<id>..."
--read-ids "<id>,<id>..."
--move-ids "<id>,<id>..." --folder "Pasta"
```

## Output esperado

No final, briefing pro Eric:
- Quantos emails afetados por categoria
- Quantos humanos precisam ação dele (lista 1-a-1)
- Quais foram movidos pra pasta de cobranças falhas / alertas segurança (atenção)
- Pendentes intencionais (que ele pediu pra deixar)

## Observações

- Token isolado em `C:/tmp/email-cleaner-token.json` (fora do MCP outlook). Não toca em config do MCP.
- Escopo OAuth: `Mail.ReadWrite + Mail.Send + offline_access + User.Read`
- App Azure: mesmo CLIENT_ID do MCP outlook (já tem consent do Eric)
- Antes de mexer na inbox em massa, SEMPRE rodar `--dry-run` primeiro
