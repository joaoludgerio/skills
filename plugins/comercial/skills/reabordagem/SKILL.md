---
name: reabordagem
description: Processar lista de leads do Pipedrive para campanha de reabordagem. Investiga cada lead, classifica temperatura, gera mensagem personalizada e cria atividade com estrategia completa para o vendedor. TRIGGER quando usuario pedir para reabordar leads, criar campanha de reativacao, processar lista de deals para reabordagem, ou mencionar reabordagem/reativacao de leads.
---

# Reabordagem de Leads — Pipedrive

Skill para campanhas de reabordagem/reativacao de leads no Pipedrive.
Processa uma lista de leads, investiga cada um, e cria atividade personalizada com mensagem pronta + estrategia para o vendedor.

---

## FLUXO DA SKILL

### Passo 0: Coletar parametros da campanha

Perguntar ao usuario (ou extrair do contexto):

1. **Lista de leads** — CSV, lista de deal IDs, ou filtro do Pipedrive
2. **Contexto da campanha** — qual o objetivo? (ex: "mentoria sobe de R$18K para R$24K em 01/04", "convidar para evento", "retomar leads frios")
3. **Vendedor responsavel** — nome do vendedor no Pipedrive (default: perguntar). Aceitar nome parcial e resolver via lista de usuarios.
4. **Data da atividade** — quando as atividades devem ser agendadas (default: proximo dia util)
5. **Vincular ao deal?** — perguntar se a atividade deve ser vinculada ao deal ou somente a pessoa + organizacao. Default: somente pessoa + org.
6. **Playbooks de referencia** — se o usuario forneceu documentos de objecoes, scripts, estrategia comercial, absorver e usar como base

IDs dos vendedores conhecidos:
- Kesia Nandi: 23969736
- Niverton Menezes: 23506911
- Eric Luciano: 17987703

### Passo 1: Ler e parsear a lista de leads

Se CSV: extrair colunas relevantes (titulo, pessoa, org, etapa, motivo perda, data criacao, deal ID).
Se lista de IDs: usar diretamente.
Se filtro: buscar via `list_deals` com os parametros informados.

### Passo 2: Para cada lead, investigar

Usar `mcp__pipedrive__get_deal_summary` para obter:
- Data de cadastro
- Etapa atual/ultima
- Status (open/lost/won)
- Motivo de perda
- Campos personalizados (segmento, dores, objetivos, colaboradores, ferramentas)
- Anotacoes existentes (historico de conversas)
- Atividades (quantidade, ultima data)
- Pessoa vinculada (telefone, email, empresa)

### Passo 3: Classificar temperatura

| Temperatura | Criterios |
|-------------|-----------|
| **QUENTE** | Chegou a Proposta/Negociacao/Formalizacao, OU deu SIM verbal, OU motivo reversivel recente (<6 meses) |
| **MORNO** | Chegou a Apresentacao/Demo, OU teve 5+ interacoes, OU motivo reversivel antigo (>6 meses) |
| **FRIO** | Ficou em Contato/Sem contato, OU <3 interacoes, OU motivo definitivo |
| **DESCARTAR** | Desqualificado, ferramenta incompativel, ou sem dados de contato |

### Passo 4: Definir acao recomendada

Cruzar temperatura + contexto da campanha + perfil do lead para definir:
- Qual oferta fazer (ex: vender produto, convidar evento, dar cortesia)
- Qual angulo usar (ex: urgencia de preco, exclusividade, economia de tempo)
- Quais objecoes antecipar (baseado no motivo de perda + perfil)

### Passo 5: Gerar mensagem personalizada

A mensagem deve:
- Ser em portugues (ou espanhol/ingles se lead internacional)
- Mencionar o nome do vendedor responsavel
- Referenciar o historico do lead ("voce conversou com o Eric", "voce demonstrou interesse")
- Incluir a oferta da campanha com urgencia
- Ser curta e direta (3-5 paragrafos max)
- Terminar com pergunta aberta

### Passo 6: Criar atividade no Pipedrive

**Criar atividade** via `mcp__plugin_pipedrive-agent_pipedrive__pipedrive_create_activity`:
```
subject: "Reabordagem [nome da campanha] — [Nome Lead] | [Empresa]"
type: "call"
person_id: [ID da pessoa]
org_id: [ID da org, se existir]
deal_id: [ID do deal, SOMENTE se usuario pediu para vincular ao deal no Passo 0]
due_date: [data definida no passo 0]
note: [HTML formatado — ver template abaixo]
```

IMPORTANTE: NUNCA passar `due_time`. Atividades sem horario definido devem ser criadas SEM o campo `due_time`. Se passar "00:00" ou string vazia, Pipedrive interpreta como meia-noite e marca como vencida.

Se usuario escolheu vincular ao deal: incluir deal_id.
Se usuario escolheu somente pessoa + org (default): NAO incluir deal_id.

**Atualizar atividade** via `mcp__pipedrive__update_activity`:
```
activity_id: [ID retornado]
user_id: "[nome do vendedor]"
type: "whatsapp"
```

### Passo 7: Resumo final

Apos processar todos os leads, gerar resumo:
- Total processados
- Quantos por temperatura (quente/morno/frio/descartados)
- Quantos atribuidos a cada vendedor
- Lista dos descartados com motivo

---

## TEMPLATE HTML DA ATIVIDADE

A nota da atividade DEVE usar HTML e seguir esta estrutura (mensagem NO TOPO):

```html
<b>📩 MENSAGEM PARA ENVIAR (WhatsApp):</b><br><br>

[mensagem personalizada aqui, com <br><br> entre paragrafos]<br><br>

<hr>

<h3>🎯 ESTRATÉGIA DE REABORDAGEM — [Nome da Campanha]</h3>

<b>📊 RESUMO DO LEAD</b><br>
[resumo em 2-3 linhas: nome, empresa, segmento, como chegou, o que aconteceu, motivo da perda]<br><br>

<b>🌡️ TEMPERATURA: [QUENTE/MORNO/FRIO]</b><br>
[justificativa em 1 linha]<br><br>

<b>✅ AÇÃO RECOMENDADA: [acao]</b><br>
• [prioridade 1]<br>
• [prioridade 2 / fallback]<br>
• [observacoes especiais]<br><br>

<b>⚠️ OBJEÇÕES PROVÁVEIS:</b><br>
1. <b>"[objecao 1]"</b> → [resposta]<br>
2. <b>"[objecao 2]"</b> → [resposta]<br>
3. <b>"[objecao 3]"</b> → [resposta]<br><br>

<b>📌 CONTEXTO ADICIONAL:</b><br>
• [dores mapeadas]<br>
• [ferramentas que usa]<br>
• [observacoes especiais: idioma, fuso, socio, etc]<br>
• [links relevantes: proposta, chat, etc]
```

---

## REGRAS IMPORTANTES

1. **Mensagem SEMPRE no topo** — o vendedor abre a atividade e ja ve o que enviar
2. **HTML obrigatorio** — usar `<br>`, `<b>`, `<h3>`, `<hr>` para formatar. Nunca texto puro.
3. **Vinculo da atividade** — por default, vincular apenas a pessoa + organizacao (sem deal). Se usuario pediu no Passo 0, incluir deal_id.
4. **Tipo WhatsApp** — definir via update_activity (o plugin nao suporta tipo whatsapp direto)
5. **Vendedor via update_activity** — o plugin nao suporta user_id, entao criar e depois atualizar
6. **Processar em lotes** — mostrar o primeiro lead ao usuario para validar, depois processar o resto
7. **Leads internacionais** — detectar pelo telefone/pais e gerar mensagem no idioma adequado
8. **Nao criar nota separada** — tudo fica na atividade
9. **Se lead nao tem telefone/email** — classificar como DESCARTAR e explicar motivo
10. **Paralelizar quando possivel** — usar agents para processar multiplos leads simultaneamente
