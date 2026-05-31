# TODO — Guardrail de Ação em Massa no MCP Pipedrive

> **Status:** NA FILA — executar SÓ depois de finalizar o fix do `update_deal_fields` (classifier do Claude Code) que está em andamento (22/05/2026).
> Spec definida pelo Eric. Não começar sem antes terminar o trabalho atual.

## Contexto

Hoje o MCP do Pipedrive não tem nenhum freio pra loops em massa. O Claude pode rodar `update_deal_fields` 200x seguidas sem checkpoint. Outros MCPs do parque já têm padrões:
- `whatsapp-agent` (`C:\repos\whatsapp-agent\mcp\index.js`): param `confirmed: z.boolean().default(false)` em toda tool destrutiva — sem `confirmed: true`, bloqueia e devolve resumo (destinatário + conteúdo) pro Claude mostrar pro Eric.
- `outlook` (`C:\MCPs\expert-mcps\mcps\outlook\src\guardrails.js`): rate-limit persistente por janela (10/h) com `confirmacao: true` pra resetar.

## Regra final definida pelo Eric

- Lote = quantas entidades a chamada vai tocar
- **1 a 5 entidades:** executa livre, sem perguntar
- **6+ entidades:** BLOQUEIA antes de executar qualquer uma, devolve preview com TODOS os itens (incluindo diff dos campos), espera `confirmacao_lote: true`
- Se Eric fizer N lotes separados de 5 ou menos, nunca bloqueia (mesmo que somando dê >5)
- Threshold é por chamada/intenção, NÃO contador acumulado
- `merge_persons/deals/organizations`: sempre exige `confirmed: true`, 1 por vez (gate hard, sem versão batch)

## Implementação

### 1. Criar `mcps/pipedrive/guardrails.js` com `checkBulkGate(operations, confirmacao_lote, options)`
- Se `operations.length <= 5`: passa
- Se `operations.length > 5 && !confirmacao_lote`: throw com objeto `{blocked: true, preview: <string formato Opção C>, count, operations}`
- Se `operations.length > 5 && confirmacao_lote === true`: passa
- Formato do preview (Opção C):
  ```
  AÇÃO EM MASSA BLOQUEADA — N <entidades> na fila, nenhuma alterada ainda.

    #ID | Nome | Empresa
      └ campo: valor_antigo → valor_novo
      └ campo2: valor_antigo → valor_novo
    ... (mostrar até 20 itens; acima disso "(+M restantes)")

  Pra executar TODOS: reenviar com confirmacao_lote: true.
  Pra cancelar: não reenviar.
  ```

### 2. Criar tools de batch novas em `index.js`
- `bulk_update_deals(operations[])` — cada op: `{deal_id, fields}`
- `bulk_update_deal_fields(operations[])` — cada op: `{deal_id, custom_fields}`
- `bulk_update_persons(operations[])` — cada op: `{person_id, fields}`
- `bulk_create_activities(activities[])`
- `bulk_move_stage(deal_ids[], new_stage_id)`

Cada uma:
- Param `operations` (ou `activities`/`deal_ids`) obrigatório
- Param `confirmacao_lote: z.boolean().default(false).describe("Obrigatório true quando operations.length > 5. Só passe true após o Eric confirmar explicitamente vendo o preview.")`
- ANTES de qualquer write: chamar `checkBulkGate(operations, confirmacao_lote)`. Se throw → retornar o preview pro modelo, sem tocar em nada
- Se passar: executar em sequência (ou paralelo com Promise.allSettled — escolher o que faz mais sentido pro rate-limit da API Pipedrive), agregar resultados, retornar resumo final

### 3. Backstop temporal pras tools singulares existentes
(`update_deal_fields`, `update_deal`, `update_person`, `create_activity`, etc)
- Contador em RAM por categoria (`deal_write`, `person_write`, `activity_write`)
- Reset após 30s sem nenhuma chamada da categoria
- Se Claude chamar a 6ª singular dentro da janela de 30s: bloquear a 6ª e devolver mensagem orientando a consolidar no `bulk_*` correspondente
- Limitação honesta documentada no comentário do código: as primeiras 5 já foram, o backstop só impede a partir da 6ª. O caminho principal é Claude usar batch quando souber que vai mexer em >5

### 4. Param `confirmed: z.boolean().default(false)` (gate HARD) em:
- `merge_persons`
- `merge_deals`
- `merge_organizations`

Sem `confirmed: true`, retornar mensagem de bloqueio com preview do que será mesclado (source vs target + contagem de atividades/notas/deals herdados).

### 5. Atualizar `C:\Users\Eric Luciano\.claude\CLAUDE.md`, seção "Regras Pipedrive Obrigatorias", subseção nova "Ação em massa":
```
- 1-5 entidades por chamada: usar tools singulares (update_deal_fields, create_activity, etc) livre
- 6+ entidades: USAR tool bulk_* correspondente
  - 1ª call com confirmacao_lote: false → MCP devolve preview com diff completo
  - Mostrar preview ao Eric, esperar "sim/confirma"
  - 2ª call com confirmacao_lote: true → executa todas
- NUNCA fazer loop manual de tool singular pra contornar o gate
- merge_persons/deals/organizations: sempre confirmed: true, 1 por vez
```

## Verificação antes de commitar
- Loop de 5 update_deal_fields singulares: passa silencioso, contador volta a zero após 30s
- 6 update_deal_fields singulares em 30s: 5 passam, 6ª bloqueia com instrução pra usar bulk_update_deal_fields
- bulk_update_deals com 5 operations: executa direto
- bulk_update_deals com 6 operations sem confirmacao_lote: zero writes, retorna preview Opção C
- bulk_update_deals com 6 operations com confirmacao_lote: true: executa 6, retorna resumo
- merge_persons sem confirmed: true: bloqueia com preview
- merge_persons com confirmed: true: executa

## Deploy
- Bumpar versão no package.json
- Atualizar BUG_LOG.md (ou criar CHANGELOG.md) com a mudança
- PERGUNTAR AO ERIC antes de fazer git push pro repo `expertintegrado/skills`
- Após push, lembrar Eric de reiniciar Claude Desktop/Code pra recarregar o MCP em todas as máquinas

## NÃO fazer
- Não mexer no comportamento de tools singulares quando lote ≤5
- Não criar janela horária — a regra é por chamada, não por acumulado
- Não persistir contador em arquivo (RAM + reset 30s é suficiente)
- Não implementar parallelization agressiva que estoure rate-limit da API Pipedrive (testar serial primeiro, paralelizar só se necessário com cap de 3-5 simultâneas)
