---
name: whatsapp-campanha-api-fup
description: Executa campanha de follow-up em massa via WhatsApp API Oficial do ChatGuru. Para cada lead: le contexto no Pipedrive, gera miolo de mensagem personalizada (Framework BDR alta conversao), grava em campo personalizado Texto_do_Template no ChatGuru, captura chat_id retornado, grava Link do Chat API Oficial na pessoa do Pipedrive, executa dialogo do template oficial e registra atividade no deal (WhatsApp concluida em sucesso, Tarefa pendente em erro). TRIGGER quando usuario pedir "campanha de follow-up", "campanha de retomada", "disparar template oficial", "follow-up em massa via API oficial", "campanha API oficial", "disparar template ChatGuru", ou quando fornecer lista de deals etiquetados CAMP RETOM ou similar.
---

# WhatsApp Campanha API Oficial — Follow-up

Skill para campanhas de follow-up onde a mensagem e disparada pelo aparelho da **API Oficial** do ChatGuru, usando template aprovado do WhatsApp Business API.

> **Seguranca:** todas as credenciais (PD_TOKEN, CG_KEY, CG_ACCT, phone_id) ficam APENAS no JSON local de config (`claude-sync/claude_desktop_config*.json`) — nunca hardcoded nesta skill nem em scripts versionados. A skill esta no GitHub publico (`expertintegrado/skills`); secret nunca pode aparecer aqui.

A diferenca pra `campanha-disparo-massa`: nao usa multipart, nao precisa de delay, nao precisa de fallback +9, nao precisa de chat_add prévio, nao agenda Call. So dispara o template e registra.

---

## CONSTANTES DA OPERACAO

| Item | Valor |
|------|-------|
| Phone ID API Oficial (ChatGuru) | ler de `CHATGURU_PHONE_ID_OFICIAL` no JSON local |
| Campo personalizado ChatGuru (miolo) | `Texto_do_Template` |
| Field key Pipedrive — Link do Chat API Oficial (pessoa) | `ac0aa8d970799954747791a22a4645ea9159c7e2` |
| User ID — Expert Integrado | `22805147` |
| Atividade sucesso — subject | `Mensagem disparada por API oficial` |
| Atividade sucesso — type | `whatsapp` (done=1) |
| Atividade erro — subject | `Erro de disparo` |
| Atividade erro — type | `task` (done=0) |
| Sem delay entre leads | API oficial nao tem risco de banimento |
| Endpoints | `https://expertintegrado.pipedrive.com/api/v1` + `https://s13.expertintegrado.app/api/v1` |

**Dialog ID do template** — NAO e constante. Pedir ao usuario a cada campanha (cada campanha tem seu template aprovado proprio).

---

## DECISOES COM O USUARIO ANTES DE EXECUTAR

1. **Lista de leads** — CSV exportado do Pipedrive, ou filtro de etiqueta (ex: `CAMP RETOM ABR 26 - Personalizada`)
2. **Dialog ID** do template oficial WhatsApp Business no ChatGuru
3. **Framework de copy** — sempre confirmar antes do batch grande (ver secao Copy abaixo)
4. **Modo de personalizacao:**
   - **Personalizada (lenta):** ler historico de cada deal e gerar miolo unico por lead. Custa ~10s/lead em get_deal_summary, mas mensagem fica forte.
   - **Disparo A/B (rapida):** miolo fixo por categoria. Voce define o template de A e B, eu replico em todos. Custa ~1s/lead.
5. **Piloto antes do batch** — sempre rodar 2-3 leads primeiro pro usuario validar copy e funcionamento.

---

## PRE-FLIGHT — DEDUPLICACAO OBRIGATORIA

Antes de montar `LEADS` pra uma nova rodada, SEMPRE ler `results.jsonl` da campanha e remover deals ja disparados. Se outro modelo retomar do zero numa sessao nova, sem isso re-dispara o mesmo lead.

```python
import json, os
DONE = set()
log = r'C:/tmp/disparo-<nome>/results.jsonl'
if os.path.exists(log):
    DONE = {json.loads(l)['deal_id'] for l in open(log, encoding='utf-8')}
# filtrar candidatos:
candidatos = [l for l in candidatos if l['deal_id'] not in DONE]
```

Se a campanha ja tem rodadas em log alem do `results.jsonl` (ex: deals processados em batch anterior antes do log existir), incluir esses IDs num set hardcoded inicial e mesclar.

---

## DIALOG — INTERVALO ENTRE MENSAGENS QUEBRADAS

Quando o miolo (`Texto_do_Template`) e enviado em multiplas mensagens (quebrado em paragrafos pelo dialog do ChatGuru), **o dialog precisa ter intervalo de 5 segundos entre cada parte**. Sem isso o WhatsApp ranqueia como spam (mensagens consecutivas em <2s sao flag classico).

Esse intervalo e configurado no proprio dialog dentro do painel ChatGuru (nao no script). Antes de aprovar o dialog_id pra batch grande, conferir no painel:
- Cada bloco de mensagem do dialog tem espera (delay) de 5s antes de disparar a proxima
- Excecao: a 1a mensagem dispara imediatamente apos `dialog_execute` (sem delay inicial)

Se o dialog estiver sem delays, pedir pro usuario ajustar antes do batch — nao ha como suprir isso pelo script (o engine so chama `dialog_execute` uma vez; o resto e responsabilidade do dialog).

---

## FLUXO POR LEAD (5 fases)

### Fase 1 — Leitura Pipedrive (LEITURA COMPLETA)

Objetivo: extrair o maximo de contexto pra ancorar a copy em algo concreto. Velocidade nao importa — qualidade da copy importa.

**3 chamadas (paralelas quando possivel):**

```python
# 1. Summary completo (campos custom + pessoa + atividades + historico resumido + notas truncadas)
summary = mcp__pipedrive__get_deal_summary(deal_id)

# 2. Notas com texto completo (summary trunca em ~250 chars)
notes = mcp__pipedrive__list_deal_notes(deal_id, limit=20)

# 3. Produtos da proposta (so se historico mostrar passagem por etapa de proposta/negociacao)
# REST direta:
GET /v1/deals/{deal_id}/products?api_token={PD_TOKEN}
```

**Campos a EXTRAIR do summary:**

Sobre a pessoa:
- Nome
- Email
- LinkedIn / Instagram (gancho de observacao real)
- Origem do Contato + Detalhes da origem do contato (indicacao? inbound? outbound?)

Sobre a empresa/deal:
- Empresa, Nicho (antigo), Produtos que oferece
- Faturamento mensal/anual (define tom — high ticket vs SMB)
- Estrutura de colaboradores (porte real)
- Tempo de mercado
- Outras ferramentas (ferramentas que ja usam — gancho forte)
- Detalhes sobre volume de Leads e Clientes (volumes especificos)
- Origem da Oportunidade + Detalhes (G4 podcast? Calendly? etc.)
- Pessoa que indicou
- Temperatura Prospeccao (frio/morno/quente — calibra agressividade do CTA)

Sobre o historico:
- Resumo Prospeccao (descricao narrativa)
- Dores (dor declarada pelo lead)
- Objetivos com a automacao
- Oportunidades de melhoria
- Atividades concluidas (quem da Expert falou, quando, sobre o que)
- Etapas pelas quais passou (chegou em Demo? Proposta? — `get_deal_flow` se precisar detalhe)
- Produtos que estavam na proposta (se houver)

**Ignorar (nao agregam):**
- Insights tecnicos (lista generica de ferramentas)
- Insights de Vendas (script longo do robo)
- Telefone de atendimento (operacional interno)
- Agente ativador (operacional interno)

**RANKING DE GANCHOS** — escolher o gancho MAIS FORTE que o lead tiver:

```
1. Indicacao direta do Eric ("o Fulano te indicou em 2024")
2. Produto que estava na proposta ("a gente tinha proposta com Super SDR Gold pro Instituto GT")
3. Reuniao/demo que aconteceu mas nao fechou ("a gente teve consultoria em 2024 mas nao fechou")
4. Reuniao agendada que nao rolou ("agendou demo mas nao apareceu")
5. Volume especifico citado ("vocês operam 350 leads/dia")
6. Ferramenta especifica ("vi que vocês usam Monday + WhatsApp Web")
7. Dor declarada ("você falou de no-shows")
8. Origem identificavel ("você veio do podcast G4", "preencheu o Calendly do Imposto Invisivel")
9. Empresa + nicho generico (fallback quando nada acima)
```

**Estrutura do miolo (sempre 1 linha, sem quebra):**
```
[Nome], [referencia temporal — quando + quem da Expert] sobre [empresa] e [contexto: o que aconteceu na ultima conversa].
[Razao temporal: o que mudou em 2026 — geralmente "SDR de IA que faz X" + beneficio especifico ligado ao gancho escolhido].
[Pergunta aberta de descoberta ligada ao gancho: como ta [dor/operacao] aí hoje?]
```

---

### REGRA DE OURO: dados especificos sim, mas SEMPRE ancorados no passado

Mostrar contexto é positivo — prova que conhece o lead. O risco e citar dado especifico como se fosse atual quando ja envelheceu (lead percebe e copy vira robotica/desatualizada).

**Toda informacao que pode ter mudado precisa de ancora temporal:**

| ❌ Robotico / envelhece | ✅ Ancorado no passado |
|---|---|
| "vocês com 25k seguidores no Instagram" | "na época vocês tavam com uns 25k seguidores no Insta" |
| "vocês usam Devzapp" | "na época vocês usavam o Devzapp" |
| "350 leads/dia" | "lá em 2024 vocês me falaram que rodavam 350 leads/dia" |
| "vocês com 40 vendedores" | "na época vocês tinham um time grande de vendas" |
| "R$3,5MM/ano" | "lá em 2024 a operação ja era high ticket" |

**Ancoras temporais validas:** "na época", "lá em 2024", "quando a gente conversou", "você me falou que", "naquele momento".

**Cargo/funcao de LinkedIn:** se manter como "atual" tem que ser confirmavel (LinkedIn data o cargo). Em duvida, omitir.

**Nome de SDR antigo da Expert** (Nara, Renata, Wender, Letícia, Vinícius): pode ja ter saido. Preferir "a gente conversou" em vez de "a Nara conversou contigo". So usar o nome se for figura ainda ativa (Niverton, Kesia, Eric).

---

### PRINCIPIOS ANTI-BLASE (evitar copy robotica)

1. **Ancorar todo dado especifico no passado** ("na época", "lá em 2024", "quando a gente conversou", "você me falou que")
2. **Citar pelo menos 2 detalhes especificos** quando o deal tem contexto rico — prova de pesquisa real, vira diferencial
3. **Tom de quem lembra, nao de quem pesquisou agora** ("você me falou que" > "vi que vocês têm")
4. **Conectar dado antigo com solucao atual** ("você comentou X — de lá pra cá montamos Y")
5. **Nao usar frases tipicas de outreach automatizado:** "vi seu perfil no LinkedIn", "notei que vocês", "estava analisando", "andei pesquisando"
6. **Cortar dado se gerar duvida** — se nao rola um "naquela época" natural, melhor omitir
7. **Nicho e dor categorica sao SEMPRE estaveis** (medicina integrativa, no-shows, captacao fraca) — usar livremente sem ancora temporal

**Detector de "deal vazio":** se nao tem nota relevante + nao tem dor declarada + nao tem ferramentas/volume — sinalizar pro usuario que esse lead nao vale Personalizada (deveria ir pra template fixo Disparo A/B). Listar pendentes no fim do batch pra ele reclassificar.

### Fase 2 — Gravar Texto_do_Template no ChatGuru
```python
r = cg_call('chat_update_custom_fields', {
    'chat_number': PHONE,           # E164: '5511999999999' ou '551199999999'
    'field__Texto_do_Template': MIOLO,
})
chat_id = r['chat_id']  # capturar do retorno
```

**Importante:** o `chat_id` retornado e do **aparelho oficial**, nao do aparelho da Central. Mesmo telefone tem chat_id diferente em cada aparelho. Sempre usar o que vem nessa resposta.

### Fase 2.5 — Gravar Link do Chat API Oficial na pessoa do Pipedrive
```python
link_chat = f'https://s13.expertintegrado.app/chats#{chat_id}'
PUT /v1/persons/{person_id} body={
    'ac0aa8d970799954747791a22a4645ea9159c7e2': link_chat
}
```

Isso fica gravado pra qualquer SDR depois clicar e abrir o chat correto direto.

### Fase 2.6 — Gravar links do Pipedrive no chat do ChatGuru (caminho de volta)

Esses dois campos personalizados ja existem cadastrados no ChatGuru e aparecem no painel do chat. Sem isso, o atendente que abrir o chat nao tem como achar o deal/pessoa no Pipedrive.

```python
cg_call('chat_update_custom_fields', {
    'chat_number': PHONE,
    'field__CRM__Link_pessoa':  f'https://expertintegrado.pipedrive.com/person/{person_id}',
    'field__CRM__Link_negocio': f'https://expertintegrado.pipedrive.com/deal/{deal_id}',
})
```

**Mapeamento do nome do campo na API:**
- Nome no painel: `CRM | Link pessoa` → API: `field__CRM__Link_pessoa`
- Nome no painel: `CRM | Link negócio` → API: `field__CRM__Link_negocio` (sem acento)
- Regra: pipe (`|`) vira `__`, espaco vira `_`, acentos somem.

Pode juntar essa chamada com a Fase 2 (gravar Texto_do_Template) numa unica chamada `chat_update_custom_fields` passando os 3 campos juntos — economiza um round-trip e garante atomicidade.

### Fase 3 — Executar dialog do template
```python
r = cg_call('dialog_execute', {
    'chat_number': PHONE,
    'dialog_id': DIALOG_ID,
})
```

**Armadilha conhecida:** primeira chamada pode retornar `result: error` com `dialog_execution_return: "Diálogo não foi executado pois o contexto não foi validado (certificação de contexto ativa)."`. Retry imediato resolve. A skill deve fazer 1 retry automatico.

### Fase 4 — Registrar atividade no deal
**Se sucesso (Fase 2 e 3 OK):**
```python
POST /v1/activities body={
    'subject': 'Mensagem disparada por API oficial',
    'type': 'whatsapp',
    'deal_id': DEAL_ID,
    'user_id': 22805147,
    'done': 1,
    'note': MIOLO,  # registra a mensagem enviada
}
```

**Se erro (Fase 2 ou 3 falhou):**
```python
POST /v1/activities body={
    'subject': 'Erro de disparo',
    'type': 'task',
    'deal_id': DEAL_ID,
    'user_id': 22805147,
    'done': 0,
    'note': mensagem_de_erro,
}
```

`mcp__pipedrive__create_activity` esta bloqueado por hook — usar REST direta (`urllib.request`).

---

## COPY — Framework A (BDR de alta conversao)

A mensagem final entregue ao cliente pelo template e:
```
Olá.
[miolo]
Obrigado.
```

O `Olá.` e `Obrigado.` sao fixos do template. So o miolo entra no campo personalizado.

### Estrutura do miolo
```
[Nome], [contexto da ultima conversa em 1 frase]. 
[Razao temporal especifica — o que mudou desde a ultima conversa]. 
[Pergunta aberta de descoberta — nao "quer marcar?", e sim "como tá X aí?"]
```

### Principios
- **Pattern interrupt** — nao comecar com "voltando a te chamar", "tudo bem?", "lembrei de voce"
- **Razao concreta pra falar AGORA** — produto evoluiu, mercado mudou, caso recente
- **Especificidade dupla** — citar nome da empresa + algo do nicho/dor dela
- **CTA leve** — pergunta aberta de descoberta, nao pedido de reuniao
- **Sem "obrigado"/"posso te ajudar"** — Olá e Obrigado ja vem no template

### Anti-padroes (NAO fazer)
- "Voltando a te chamar aqui" (passivo, sem motivo)
- "Faz sentido retomar?" (pergunta sobre relacao, nao sobre dor)
- "Estamos ajudando empresas a usar IA pra elevar isso" (vago)
- Frases longas de cumprimento que poluem o miolo
- Quebra de linha (o template nao aceita)

### Exemplos validados
```
Rosangila, em 2024 a gente conversou sobre o Super SDR pro Instituto Max Tovar e parou no meio. De lá pra cá o produto evoluiu muito — empresas com volume de leads agora qualificam 24/7 sem precisar contratar SDR humano. Como tá a operação comercial de vocês hoje?
```
```
Lucas, em 2024 você falou da The VOID e da bagunça em qualificação e follow-up dos leads — definiu como "o coração da empresa". De lá pra cá montamos um SDR de IA que cuida exatamente disso: qualifica e dá follow-up por WhatsApp 24/7. Como vocês tão lidando com esse fluxo agora?
```
```
Leonardo, lembrei do Funnel Max porque vocês operam 350 leads/dia e a recuperação via WhatsApp era o gargalo que você tinha citado lá em 2024. De lá pra cá montamos esse fluxo exato — SDR de IA que recupera no WhatsApp e qualifica antes do humano. Como tá a taxa de resposta de vocês hoje?
```

---

## ARMADILHAS CONHECIDAS

1. **chat_id diferente por aparelho** — o mesmo telefone tem chat_id diferente em cada phone_id. Sempre usar o chat_id retornado pelo aparelho que voce esta operando. Link do Pipedrive padrao (`Link do Chat`, sem "API Oficial") aponta pro aparelho da Central — outro chat_id.

2. **dialog_execute primeira chamada pode falhar** — `Diálogo não foi executado pois o contexto não foi validado`. Retry imediato resolve. Implementar retry automatico (1 retry) antes de marcar erro.

3. **`mcp__pipedrive__create_activity` e `update_deal_fields` bloqueados por hook** — sair pra REST direta com `urllib.request` em Python.

4. **Numero precisa estar em formato E164 puro** — `5519998511984` (12 ou 13 digitos, comecando com 55, sem espacos, sem parenteses). API oficial valida estritamente. Filtrar do CSV os que nao baterem nesse formato e listar pro usuario corrigir manualmente.

5. **Encoding em curl/Bash Windows** — usar Python `urllib.parse.urlencode` que respeita UTF-8. NAO usar curl no Git Bash (cp1252 quebra acentos).

6. **Print Python crasha com emoji/setas no Windows** — sempre `sys.stdout.reconfigure(encoding='utf-8', errors='replace')` no topo do script. Pra scripts de inspecao rapida no terminal (one-liner com `python -c`), usar `python -X utf8 -c "..."` — caso contrario nomes com emoji (ex: `Juliana prado💜`) crasham o stdout no cp1252 e a listagem trunca no meio.

7. **Fallback 12↔13 chars E NECESSARIO** — alguns DDDs registraram historico no aparelho oficial sem o "9" prefix (12 chars) e outros com (13 chars). Pipedrive guarda como o lead digitou. Quando F2 retorna `"Chat não encontrado."` (HTTP 400), tentar a forma alternativa antes de marcar erro: se veio 13 chars com 9 na pos 4, tentar sem; se veio 12 chars, tentar com 9. Caso confirmado: deal #1048 (Jeferson) — Pipedrive `5547997565906`, ChatGuru `554797565906`. **O template do batch ja faz esse fallback automatico.**

8. **Sem necessidade de chat_add previo** — `dialog_execute` ja cria o contexto. So `chat_update_custom_fields` ja registra o contato.

9. **PARAMETRO E `key`, NAO `api_key`** — a API REST do ChatGuru aceita `key=<token>`, nao `api_key`. Se rescrever a funcao `cg_call` do zero, conferir esse detalhe — caso contrario TODAS as chamadas voltam HTTP 400 com `"key ou account_id não informado(s)"`. Confirmado em sessao com Sonnet 4.6 que reescreveu sem consultar a skill e travou o batch inteiro.

---

## CREDENCIAIS — sempre do JSON local, nunca hardcoded

```python
import json
SYNC = r'C:/Users/Eric Luciano/OneDrive/Workspace/claude-sync'
PD_TOKEN = json.load(open(f'{SYNC}/claude_desktop_config.json', encoding='utf-8'))\
    ['mcpServers']['pipedrive']['env']['PIPEDRIVE_API_KEY']
cg = json.load(open(f'{SYNC}/claude_desktop_config-ERICLUCIANO-PC.json', encoding='utf-8'))\
    ['mcpServers']['chatguru-mcp']['env']
CG_KEY        = cg['CHATGURU_API_KEY']        # token de disparo — NUNCA hardcoded
CG_ACCT       = cg['CHATGURU_ACCOUNT_ID']
PHONE_OFICIAL = cg['CHATGURU_PHONE_ID_OFICIAL']  # phone_id da API Oficial — tambem fora do repo
```

**Regras de seguranca:**
- Nenhum desses 4 valores (`PD_TOKEN`, `CG_KEY`, `CG_ACCT`, `PHONE_OFICIAL`) pode aparecer em arquivo versionado (skill, script, README, log de exemplo).
- Se for criar novo PC, copiar o JSON local por canal seguro e adicionar a chave `CHATGURU_PHONE_ID_OFICIAL` na secao `chatguru-mcp.env`.
- Se um secret vazar para esta skill ou para qualquer arquivo do repo `expertintegrado/skills`, ROTACIONAR no painel do ChatGuru/Pipedrive antes de qualquer outra coisa.

---

## ENGINE DE DISPARO — usar o script reutilizavel

A logica de disparo (5 fases + fallback de phone + retry de dialog) vive em UM unico arquivo, fora do repo da skill, sobrevive a compacts:

```
C:/Users/Eric Luciano/OneDrive/Workspace/claude-sync/scripts/whatsapp-api-fup-batch.py
```

**NAO reescrever esse engine do zero numa nova sessao** — importar e usar. O codigo ja trata: parametro `key` (nao `api_key`), fallback automatico 12<->13 chars, retry de `dialog_execute`, leitura de credenciais do JSON local, log incremental.

### Como invocar (em qualquer sessao, mesmo apos compact):

```python
import sys
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location('eng',
    r'C:/Users/Eric Luciano/OneDrive/Workspace/claude-sync/scripts/whatsapp-api-fup-batch.py')
eng = module_from_spec(spec); spec.loader.exec_module(eng)

DIALOG_ID = '...'  # pedir ao usuario, especifico de cada template
LEADS = [
    {'deal_id': 523, 'person_id': 545, 'phone': '5521988582119',
     'name': 'Paulo', 'miolo': 'Paulo, ...'},
    # ...
]

results = eng.run_batch(LEADS, dialog_id=DIALOG_ID,
                        log_path=r'C:/tmp/disparo-<nome>/results.jsonl')
```

`results` e uma lista de dicts: `{deal_id, name, phone, phone_used, chat_id, ok, erro}`.

### Se PRECISAR adaptar logica nova:
- Editar `scripts/whatsapp-api-fup-batch.py` (claude-sync) — nao bifurcar inline.
- Single source of truth: tudo que muda na execucao da campanha vive nesse arquivo.

---

## CHECKLIST DE EXECUCAO

```
[ ] Confirmar lista de leads (CSV ou filtro)
[ ] Pedir dialog_id do template oficial
[ ] Definir modo: Personalizada (lento, ~10s/lead) ou A/B fixo (rapido, ~1s/lead)
[ ] Validar Framework A da copy (1-2 exemplos pro usuario aprovar)
[ ] Rodar PILOTO com 2-3 leads
[ ] Pegar links dos chats e mostrar pro usuario
[ ] Aprovacao explicita pra rodar batch
[ ] Rodar batch (sem delay default)
[ ] Salvar results.jsonl
[ ] Reportar: total OK / erros / numeros invalidos
[ ] Listar pendentes (numeros mal formatados — pedir Eric corrigir)
```
