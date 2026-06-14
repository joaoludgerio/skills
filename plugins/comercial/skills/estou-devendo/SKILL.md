---
name: estou-devendo
description: "Lista as conversas do WhatsApp em que o Eric está devendo resposta (lead respondeu por último), classificadas por urgência (URGENTE/HOJE/SEM PRAZO) e opcionalmente com drafts de resposta. Use quando o Eric pedir 'do que estou devendo?', 'quem está esperando resposta?', 'me lembra das pendências de WhatsApp', ou similar."
argument-hint: "[--categoria=cliente,prospect] [--excluir=descartar,comunidade] [--dias=1] [--limit=20] [--draft] [--urgencia=urgente,hoje]"
allowed-tools: Bash, Read, mcp__whatsapp-agent__read, mcp__whatsapp-agent__get_voice_guide, mcp__whatsapp-agent__check_message, mcp__pipedrive__get_deal_summary
---

Skill que lista as conversas onde o Eric está devendo resposta no WhatsApp pessoal — quem mandou a última mensagem é o lead/contato, não o Eric.

**Atualizado 24/05/2026 (v2):** classificação automática por urgência + flag `--draft` pra sugerir respostas + suporte a agendamento via `loop`/`schedule`.

## Como funciona

1. Conecta no Supabase do projeto WhatsApp Agent (`gmpurkzxtvzqlvkqwjkp`).
2. Filtra conversas onde `last_received_at > last_sent_at` (pendência aberta).
3. Filtra `is_group=false` por padrão (grupos sempre geram falso positivo — alguém manda algo, Eric não deve nada a ninguém).
4. Aplica filtro de categoria se passado (`--categoria=cliente,prospect`) ou exclui categorias (`--excluir=descartar`).
5. Filtra `last_received_at` mais antiga que N dias (default: 1 dia — pendências recentes não importam).
6. Ordena por `last_received_at` ascendente — quem está esperando mais tempo aparece primeiro.
7. Limita a `--limit` resultados (default: 20).

## Variáveis de ambiente obrigatórias

- `SUPABASE_PAT` — Personal Access Token user-level (usado pela query via Management API)
- `SUPABASE_SERVICE_ROLE` — Service Role Key do projeto whatsapp-agent (opcional para esta skill; o script só exige `SUPABASE_PAT`)

Fonte canônica dos tokens: 1Password Business, vault `Agentes Eric`. Cache local em `~/.claude.json` após rodar `setup-secrets.ps1`.

```bash
export SUPABASE_PAT=$(op read "op://Agentes Eric/SUPABASE_PAT/credential")
```

Em Windows local, se já estiverem no env do usuário: `$env:SUPABASE_PAT`. Na VPS (container claude-code) já vêm exportadas pelo `boot-tmux.sh`.

## Flags

**Flags lidas pelo SCRIPT** (passar direto na linha de comando):

- `--categoria=slug1,slug2` — só chats com pelo menos uma destas categorias
- `--excluir=slug1,slug2` — exclui chats com qualquer destas categorias (default: `descartar,comunidade`)
- `--dias=N` — só pendências com mais de N dias parado (default: 1). Aceita decimal (ex: `0.5`). Use 0 pra incluir as de hoje.
- `--limit=N` — número máximo de chats no output (default: 20, max: 100)
- `--all-groups` — inclui grupos (não recomendado — gera ruído)
- `--with-snippet` — inclui o trecho da última mensagem recebida (faz +N queries; mais lento)

**Diretivas pós-processamento** (NÃO passar pro script — o Claude trata depois de rodar):

- `--draft` — pra cada chat URGENTE/HOJE, o Claude gera sugestão de resposta (lê última msg via MCP + voice guide). Ver seção "Modo --draft".
- `--urgencia=urgente,hoje,sem-prazo` — filtra a apresentação por nível de urgência classificado. Ver seção "Modo --urgencia".

IMPORTANTE: `--draft` e `--urgencia` NÃO são reconhecidas pelo `estou_devendo.py` (causariam `unrecognized arguments`). Ao montar o comando, remova-as de `$ARGUMENTS` antes de chamar o script e aplique-as como instrução ao Claude no pós-processamento.

## Execução

Skill instalada via plugin marketplace. Usar `${CLAUDE_PLUGIN_ROOT}` que aponta pra raiz do plugin instalado (pode estar em `~/.claude/plugins/cache/expertintegrado/skills/<versao>/plugins/comercial/`).

Lembre de exportar `SUPABASE_PAT` (ver seção de variáveis de ambiente) antes de rodar. Passar SOMENTE as flags do script (sem `--draft`/`--urgencia`):

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/plugins/comercial/skills/estou-devendo/scripts/estou_devendo.py" $ARGUMENTS
```

Em Windows local com Python global, trocar `python3` por `python`:
```bash
python "${CLAUDE_PLUGIN_ROOT}/plugins/comercial/skills/estou-devendo/scripts/estou_devendo.py" $ARGUMENTS
```

## Após rodar — classificação por urgência

Claude DEVE classificar cada chat antes de apresentar pro Eric:

### URGENTE (responder hoje)
- Categoria `lead` (qualquer status)
- Categoria `cliente` + deal Pipedrive ativo com valor R$40K+ (`mcp__pipedrive__get_deal_summary` por nome se necessário)
- Categoria `parceiro` se mencionar dinheiro/prazo
- Chats com `dias_parado >= 3` independente de categoria (já tá ruim, decidir)

### HOJE (idealmente hoje, pode ser amanhã cedo)
- Categoria `cliente` padrão (sem qualificação VIP)
- Categoria `parceiro` sem urgência clara
- Categoria `prospect`

### SEM PRAZO (responder quando puder)
- Categoria `pessoal`, `familia`, `amigo`
- Categoria `vendedor`, `fornecedor`

### Output esperado

O script devolve JSON com:
- `total_pendencias`: total absoluto encontrado (antes do limit)
- `mostrando`: quantos retornados (após limit)
- `por_categoria`: contagem agrupada por categoria
- `chats`: array `[{ chat_id, chat_name, categories[], dias_parado, ultima_msg_recebida, link }]` ordenado por `dias_parado` desc

Briefing pro Eric (formato canônico):

```markdown
## URGENTE (X)
- [Lead] Carlos Shimizu — 1d — "Pode ser as 9h" → link
- [Cliente VIP] Mauricio — 2h — "Cloud tá pesando" → link

## HOJE (Y)
- [Cliente] Joana — 1d — link
- [Parceiro] Silvia — 4h — link

## SEM PRAZO (Z)
- [Pessoal] Mirtes — 4h — "Estamos perdidos"
- [Família] Camila — 2d
```

### Modo --draft

Quando `--draft` flag presente, pra cada chat URGENTE ou HOJE, Claude:
1. Lê as últimas mensagens via `mcp__whatsapp-agent__read(chat=<chat_id ou nome>, limit=5)` (áudios já vêm com `transcription` automática)
2. Consulta `mcp__whatsapp-agent__get_voice_guide()` uma vez no início (vale pra todos os drafts)
3. Gera sugestão de resposta natural com a voz do Eric, com acentuação correta do português
4. Valida o draft com `mcp__whatsapp-agent__check_message(content)` antes de apresentar (pega em-dash, hype, saudação genérica, tu/teu)
5. Apresenta junto da listagem: `Carlos Shimizu — DRAFT: "Bom dia Carlos, sim 9h tá ótimo, te mando o Zoom. Abraço"`

Eric aprova ou edita antes de enviar. NUNCA envia automático — o envio é só via `mcp__whatsapp-agent__send` com `confirmed=true` explícito do Eric.

### Modo --urgencia (filtro)

`--urgencia=urgente` → só lista os URGENTE
`--urgencia=urgente,hoje` → URGENTE + HOJE (default visualização recomendada)
`--urgencia=sem-prazo` → só pessoal/família (modo "responder quando tiver tempo")

Se quiser detalhe de uma conversa específica, usa o MCP whatsapp-agent (tool `mcp__whatsapp-agent__read`) — áudios já vêm transcritos. A skill `transcrever-conversa` (repo `whatsapp-agent`, fora deste marketplace) é alternativa só se estiver instalada.

## Exemplos de uso

```
estou-devendo
estou-devendo --categoria=cliente,prospect --dias=2
estou-devendo --excluir=descartar,comunidade,pessoal --limit=10
estou-devendo --categoria=familia --dias=0 --limit=5
estou-devendo --urgencia=urgente,hoje --draft
estou-devendo --urgencia=urgente --draft --limit=5
```

## Agendamento (loop / schedule)

Skill pode rodar automatica 2x/dia (manhã + meio-tarde):

```
/loop 6h /estou-devendo --urgencia=urgente
```

Ou agendamento fixo via `schedule`:
- 08:00 BRT — `estou-devendo --urgencia=urgente,hoje` (manhã, foco em hoje)
- 14:00 BRT — `estou-devendo --urgencia=urgente --draft` (meio-tarde, com drafts pras urgências do dia)

## Observações

- **Grupos por padrão NÃO entram** porque mensagem em grupo não é "devendo resposta" pessoal. Use `--all-groups` se quiser conferir grupos também (raro).
- A skill **não envia mensagem** — só lista o que está pendente. O envio é via tool `send` do MCP whatsapp-agent (com `confirmed=true` explícito).
- Categoria precisa estar atribuída no DB pra filtro funcionar — chats sem categoria aparecem na listagem geral mas não no filtro `--categoria=X`.
- Pra atribuir categoria a um chat, usar tool `mcp__whatsapp-agent__categorize_chat` do MCP.
- **Alternativa oficial (sem script/SQL):** o MCP whatsapp-agent já expõe `mcp__whatsapp-agent__inbox(waiting_on="eric", exclude_groups=true, exclude_categories=["descartar","comunidade"])`, que retorna exatamente os chats em que o Eric está devendo resposta. Use como fallback se `SUPABASE_PAT` não estiver no env ou a Management API falhar — é o caminho oficial e dispensa o token de Management API.
