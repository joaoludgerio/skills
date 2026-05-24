---
name: prospecta-lead
description: Processa 1 lead novo de prospeccao (qualquer origem — evento, lista importada, indicacao). Para cada lead: cadastra pessoa no Pipedrive (se nao existir), pesquisa LinkedIn/empresa via WebSearch+WebFetch, infere dor provavel, cria deal no pipeline Prospeccao em "Lead Mapeado" e move pra "Tentando contato", preenche todos os campos canonicos da Pre-qualificacao seguindo a Diretriz_Preenchimento_CRM.md, cria atividade WhatsApp, e RASCUNHA mensagem personalizada (sem enviar). Envio em batch fica para skill separada (whatsapp-campanha-api-fup ou whatsapp-campanha-central-prospeccao). TRIGGER quando usuario pedir "prospecta lead", "cadastra novo lead", "pipeline de prospeccao a partir de lista", "perfil + cadastro Pipedrive", ou for invocada por squad-prospeccao em paralelo.
---

# Prospecta Lead — pesquisa + cadastro Pipedrive (v2 — sincronizado 2026-05-04)

Skill atomica: processa UM lead por vez. Pra processar uma lista (ex: 30 empresarios), o orquestrador `squad-prospeccao` invoca esta skill em paralelo (wave de 5).

> **Esta skill NAO envia mensagem.** Apenas rascunha. Envio = skill separada com aprovacao explicita.

---

## REGRA ZERO — VERIFICACAO DE IDENTIDADE (1-de-2 OBRIGATORIO)

**Apenas o NOME nunca basta.** Antes de afirmar que `<perfil pesquisado>` = `<lead do input>`, exigir UM destes dois sinais batendo:

| Sinal | Como verificar |
|---|---|
| **A. Nome + empresa** | Resultado do WebSearch tem o nome do lead COM o nome da empresa do input (ou empresa fortemente similar) |
| **B. Nome + email-do-dominio** | Dominio do email (ex: `@empresa.com.br`) bate com site/dominio da empresa encontrada no WebFetch |

Regiao/DDD NAO conta — sinal fraco e enganoso.

### Niveis de confianca

- **A E B batem** = ALTA — pode preencher campos da empresa com convicção
- **Apenas A OU apenas B bate** = MEDIA — preencher, mas com prefixo "(a confirmar)" em campos especulativos
- **Nenhum bate (so o nome)** = NAO CONFIRMADO — NAO escrever NADA da pesquisa publica nos campos. So usar dados do CSV. Adicionar nota explicita "WebSearch nao localizou perfil unico — campos da empresa nao preenchidos por falta de fonte confiavel" + marcar atencao manual.

### Anti-pattern (o que NAO fazer)

- Pegar primeiro resultado do Google que tem o nome e assumir que e a pessoa
- Inferir empresa pelo sobrenome do email sem cruzar com nome da empresa
- Aceitar pessoa do Pipedrive search_persons quando >1 retorna sem cruzar email
- Em casos ambiguos, escrever "provavel..." nos campos canonicos — campo do CRM e fato, nao hipotese

### Output obrigatorio

Toda execucao da skill DEVE retornar:

```json
{
  "identidade": {
    "confianca": "alta|media|nao-confirmada",
    "sinais_batidos": ["nome+empresa", "nome+email-dominio"],
    "sinal_faltando": "qual",
    "discrepancias": ["nenhuma" ou ["LinkedIn diz CEO mas CSV diz Diretor"]]
  }
}
```

### Pipedrive search_persons com multiplos resultados

Se `mcp__pipedrive__search_persons(term=nome)` retornar mais de 1 pessoa:
1. Se input tem email -> escolher a que tem o mesmo email
2. Se input tem telefone -> escolher a que tem o mesmo telefone
3. Se nao tem nem 1 nem o outro -> marcar AMBIGUIDADE, usar a primeira com confianca BAIXA
4. NUNCA escolher por similaridade so de nome quando ha multiplas opcoes

---

## DIRETRIZES MESTRAS — LER ANTES DE EXECUTAR

### 1. Diretriz de Preenchimento do CRM (campos do Pipedrive)

**SEMPRE** consultar antes de preencher qualquer campo:

```
C:\Users\Eric Luciano\OneDrive\Workspace\Processo Comercial\Campanha de retomada de leads\Diretriz_Preenchimento_CRM.md
```

Esse documento define para CADA campo: o que preencher, quando, regra de "INFORMACAO PENDENTE", o que NAO preencher.

Regra de ouro: **NUNCA sobrescrever campo ja preenchido**, salvo pedido explicito.

### 2. Voice Guide do Eric (mensagem WhatsApp)

**SEMPRE** carregar o voice guide ANTES de rascunhar qualquer mensagem WhatsApp/email/social que vai sair em nome do Eric. NAO confiar so na intuicao — usar a tool dedicada do MCP whatsapp-agent v2.8:

```
mcp__whatsapp-agent__get_voice_guide()
```

Essa tool retorna o markdown completo do guia (mora em `claude-sync/memory/eric-voice.md`, ~298 linhas, validado A/B em 13.526 mensagens reais com score 7.8/10).

**Apos rascunhar**, validar com:

```
mcp__whatsapp-agent__check_message(content)
```

Retorna `{ok, violations[], hint}`. Se houver violacoes, reescrever ANTES de gravar na atividade Pipedrive ou enviar.

### Regras hard do Voice Guide (resumo — checadas automaticamente por regex)

| Regra | O que NAO fazer | Severidade |
|---|---|---|
| `tu-pronome` | NUNCA usar `tu/teu/tua/teus/tuas/ti` — sempre `vc/vcs` | high |
| `em-dash` | NUNCA usar `—` — substituir por virgula, dois-pontos, parenteses ou `..` | high |
| `saudacao-generica` | Proibido `Olá`, `Prezado(a)`, `Cordialmente`, `Atenciosamente` | high |
| `hype` | Proibido `revolucionário`, `transformador`, `disruptivo`, `game-changer`, `mindset` | high |
| `urgencia-manufaturada` | Proibido `última chance`, `só hoje`, `corre que`, `aproveita já` | high |
| `validacao-afetiva` | Proibido `te entendo`, `imagino como vc tá`, `fica tranquilo q vamos` | high |
| `softener-equipe` | Evitar `quando puder, por favor`, `se for possível`, `com todo respeito` | medium |
| `rsrs` | Evitar `rsrs/rsrsrs` (Eric usa `kkk` ou nada) | medium |

### Padroes positivos do Eric (extraidos do corpus)

- **Frequentes:** `a gente` (bigrama #1, 2.297x), `acho que` (871x — opiniao como opiniao), `vc` (6:1 vs `você`), `cara` (740x), `fala` (748x)
- **Tom:** direto, sem hype, sem floreio. Empoderamento (`você consegue`) > venda (`isso revoluciona tudo`)
- **Estilo:** vocativo-aberto, frase curta, opiniao explicita
- **Em vendas-lead frio:** `mano` proibido. Em equipe/cliente proximo: permitido.

---

## INPUT (1 lead)

Obrigatorio:
- `nome` — nome completo
- `telefone` — formato BR com DDD

Opcional (acelera pesquisa):
- `empresa` — nome da empresa
- `cargo` — cargo
- `email` — email
- `faturamento` — faixa do CSV (mapear pra opcao do enum se aplicavel)
- `total_colaboradores` — faixa do CSV (mapear pra enum)
- `origem_oportunidade` — opcao canonica de Origem (default: "PUBLI | G4 Tools")
- `detalhes_origem` — texto livre (ex: "Jantar G4 04/05/2026")
- `sdr_responsavel_user_id` — default: 17987703 (Eric Luciano)

---

## CONSTANTES DA OPERACAO (sincronizadas 2026-05-04 via sync_all)

### Pipeline Prospeccao
- **Pipeline ID:** `7` (nome: "Prospeccao")
- **Stage inicial:** `64` (Lead Mapeado)
- **Stage destino apos cadastro:** `65` (Tentando contato) — porque o agente FEZ a primeira tentativa de contato (mensagem rascunhada/enviada)
- Outros stages do pipeline: 66 Conexao iniciada/Em qualificacao, 68 Pre-Qualificado, 116 Qualificado, 79 Reuniao agendada

### Users
- Eric Luciano: `17987703`
- Niverton Menezes: `23506911`
- Kesia Nandi: `23969736`
- Expert Integrado (automacao): `22805147`

### Campos canonicos a preencher (Pre-qualificacao + Origem)

Passar pra `update_deal_fields` usando o NOME do campo (MCP resolve key automaticamente). Ordem de prioridade:

| Campo | Tipo | Como preencher (resumo da Diretriz) |
|---|---|---|
| `Origem da Oportunidade` | enum | Default: `PUBLI \| G4 Tools` (ou outra opcao canonica). Lista completa em config.js |
| `Detalhes da origem da oportunidade` | text | Texto livre. Ex: `Jantar G4 04/05/2026` ou `Diagnostico Traction 099` |
| `Informacoes gerais` | text long | Resumo da empresa do WebSearch/WebFetch: modelo de negocio, localizacao, particularidades |
| `Midias e redes da empresa` | text long | Links coletados: `IG: @x \| Site: y.com.br \| LinkedIn: linkedin.com/company/z` |
| `Segmento` | enum | Mapear pra opcao mais proxima (Academia, Agencia, Clinica Estetica, Clinica Medica, Contabilidade, Consultoria, Educacao, Ecommerce, Energia, Imoveis, Juridico, Saude, SaaS, Varejo, Industria, etc) |
| `Nicho (detalhes adicionais` | text autocomplete | Detalhamento livre do nicho. Ex: `Clinica de Ortodontia, franquia 4 unidades` |
| `Produtos que oferece` | text | O que a empresa vende. Ex: `Implantes, ortodontia, lentes` |
| `Total de colaboradores` | enum | Mapear faixa do CSV (1 a 5, 6 a 10, 11 a 20, 21 a 50, 51 a 100, 101 a 200, 201 a 500, 501 a 1000, Acima de 1.000) ou **`❌ INFORMAÇÃO PENDENTE`** (com emoji ❌ e acentos — valor literal exato do enum) |
| `Tamanho da equipe comercial` | double (numero) | So preencher se a pesquisa publica revelou. Caso contrario, deixar vazio |
| `Nº atendimentos por mês` | enum | **`❌ INFORMAÇÃO PENDENTE`** (valor literal com emoji) — so usar opcao numerica se sabe via pesquisa |
| `Pessoa que indicou` | text autocomplete | Vazio (prospeccao fria nao tem indicador) |

**ATENCAO ENUM:** valores `❌ INFORMAÇÃO PENDENTE` precisam do emoji ❌ + acentos exatos. Sem isso o Pipedrive rejeita.

**Opcoes do enum Segmento** (lista completa pra evitar erro): Academia e empresas de esporte, Agencia, Clinica Estetica, Clinica Medica, Contabilidade, Consultoria, Educacao, Ecommerce, Energia, Imoveis, Industria, Juridico, Saude, SaaS, **Seguros**, Varejo, Logistica/Transporte, Tecnologia/TI, e outras (consultar config.js pra opcoes completas).

**NAO preencher** (campos pausados/excluidos pela Diretriz):
- Briefing Prospeccao
- Resumo Prospeccao
- Canal de Comunicacao
- Insights tecnicos / Insights de Vendas
- Faturamento mensal (vai ser excluido)
- Tempo de mercado (vai ser excluido)
- Nicho (antigo) (legado)
- UTM (preenchido por automacao)

**NAO preencher na 1a prospeccao** (esses sao discovery, preenchidos durante/apos reuniao):
- Dores
- Objetivos com a automacao
- Oportunidades de melhoria
- SPICED-* (Situational, Pain, Impact, Critical Event, Decision)
- Como funcionam os processos da empresa
- Tipo de venda
- Funis de vendas utilizados
- Canais de atendimento atuais
- Tamanho acumulado da lista de leads
- Detalhes sobre volume de Leads e Clientes
- Estrutura de colaboradores
- Automacoes que utiliza atualmente
- Ferramenta de WhatsApp atual
- CRM atual
- Outras ferramentas
- Dominio de IA na empresa / Solucoes de IA que utiliza hoje
- Nivel de prioridade da contratacao
- Forma de Pagamento, Especificacoes do projeto, etc (negociacao)

### Campos da PESSOA (entidade Person)

| Campo | Tipo | Como preencher |
|---|---|---|
| `Cargo` | text | Direto do CSV ou WebSearch (Socio/Fundador/CEO/Diretor) |
| `Nivel de decisao` | enum (`Único decisor` / `Sócio decisor` / `Não é decisor`) | Mapear: Socio/Fundador = `Sócio decisor`; CEO/Presidente solo = `Único decisor`; Diretor/Gerente/Coordenador = `Não é decisor` (ate confirmar). Valores literais com acentos. |
| `Origem do Contato` | enum | Mesma de Origem da Oportunidade (mas SO se pessoa for nova; nao alterar se ja existir) |
| `Detalhes da origem do contato` | text | Mesmo de Detalhes da origem (so pessoa nova) |

---

## FLUXO POR LEAD (sequencial, 1 execucao = 1 lead)

### Fase 1 — Verificar duplicata DE PESSOA E DEAL (10s)

1. `mcp__pipedrive__search_persons(term=nome)` — checar se ja existe
2. `mcp__pipedrive__search_deals(term=nome)` ou `term=empresa` — checar deals abertos
3. Decidir:
   - **Pessoa existe + deal aberto pra mesma origem**: usar ambos, NAO duplicar nada. Pular Fase 4 (criacao). So adicionar nota + atividade + completar campos vazios via `update_deal_fields`.
   - **Pessoa existe sem deal aberto pra essa origem**: usar pessoa, criar deal novo (Fase 4 normal).
   - **Pessoa nao existe**: ir pra Fase 2 normal.

REGRA CRITICA: na pratica do teste real, ~95% dos leads do G4Tools JA existiam no Pipedrive (integracao G4 sincroniza). Skill DEVE assumir esse pattern como default e tratar criacao como excecao.

### Fase 2 — Pesquisa publica (15-30s)

a. `WebSearch("{nome} {empresa|""} LinkedIn")` — extrair: cargo, empresa, segmento, descricao publica
b. Se URL LinkedIn: `WebFetch(url)` — bio publica completa (pode falhar se LinkedIn bloquear, snippet do Google ja basta)
c. Se site da empresa aparecer: `WebFetch(site)` — pegar "Quem somos", "O que fazemos"
d. `mcp__expert-brain__recall("dor segmento {X}")` — pattern de dor (so pra inspirar mensagem, NAO grava na "Dores" do Pipedrive)

Coletar:
```json
{
  "linkedin_url": "...",
  "site_empresa": "...",
  "instagram_url": "...",
  "cargo_inferido": "...",
  "empresa_segmento": "...",  // mapear pra opcao do enum Segmento
  "empresa_nicho": "...",
  "empresa_produtos": "...",
  "empresa_resumo": "...",  // 2-3 frases
  "porte_estimado": "...",
  "dor_inferida": "...",
  "confianca": "alta|media|baixa"
}
```

### Fase 3 — Cadastrar Pessoa (5-10s)

Se Fase 1 nao achou:
1. `mcp__pipedrive__create_person` com nome, telefone, email, org_name
2. Capturar `person_id`

Se achou: usar existente.

Apos criacao da pessoa nova, preencher campos da Pessoa:
- `Cargo` (do CSV ou pesquisa)
- `Nivel de decisao` (Sim se Socio/Fundador/CEO)
- `Origem do Contato` (mesma da Oportunidade)
- `Detalhes da origem do contato`

### Fase 4 — Criar Deal em "Lead Mapeado" (5s)

1. `mcp__pipedrive__create_deal_full`:
   - title: `{nome} | {empresa}` (ou so nome se sem empresa)
   - person_id: o capturado
   - pipeline_id: 7
   - stage_id: 64 (Lead Mapeado)
   - user_id: sdr_responsavel_user_id
2. Capturar `deal_id`

### Fase 5 — Preencher campos personalizados (5s)

1. `mcp__pipedrive__update_deal_fields(deal_id, custom_fields=...)` com TODOS os campos canonicos coletados na Fase 2:
   - Origem da Oportunidade
   - Detalhes da origem da oportunidade
   - Informacoes gerais
   - Midias e redes da empresa
   - Segmento (opcao do enum)
   - Nicho (detalhes adicionais
   - Produtos que oferece
   - Total de colaboradores (faixa enum)
   - Tamanho da equipe comercial (numero, so se souber)
   - Nº atendimentos por mês (`INFORMACAO PENDENTE` se nao sabe)
2. REGRA: nao sobrescrever campo ja preenchido (force=false default). Se o MCP retornar conflitos, anotar pra revisao Eric.

### Fase 6 — MOVER deal pra "Tentando contato" (5s)

1. `mcp__pipedrive__update_deal(deal_id=X, stage_id=65)` — move pra Tentando contato
2. Justificativa: o agente acabou de fazer a 1a tentativa de contato (mensagem rascunhada/enviada)

### Fase 7 — Rascunhar mensagem WhatsApp (15s) — usar Voice Guide

**Passo 7.1 — Carregar Voice Guide (1x por sessao, cacheavel)**:

```
mcp__whatsapp-agent__get_voice_guide()
```

Ler o markdown retornado e usar como referencia ativa pro tom da mensagem. Nao parafrasear o guide — incorporar os patterns reais (lexico, sintaxe, vocativo, tempo verbal).

**Passo 7.2 — Rascunhar 4 linhas**:

Estrutura base (sem usar literalmente — adaptar ao contexto):

```
Linha 1 — Gancho pessoal: referencia algo especifico que pesquisou (cargo, empresa, post recente, evento). Usar "vc" sempre. Sem "Olá".
Linha 2 — Ponte Expert: como o que a gente faz se conecta com o que ele faz. Sem hype. Tom "a gente tem ajudado..." ou "acho que faz sentido..."
Linha 3 — CTA suave: "se fizer sentido trocar uma ideia, me chama" ou "topa marcar 20min essa semana?"
Linha 4 (opcional) — Contexto evento: "PS: te vi confirmado no [evento]" ou similar
```

Regras criticas (vindas do Voice Guide):
- ZERO `tu/teu/tua` — sempre `vc/vcs`
- ZERO `—` (em-dash) — usar virgula, dois-pontos, parenteses
- ZERO saudacoes genericas (`Olá`, `Prezado`, `Cordialmente`)
- ZERO hype (`revolucionário`, `transformador`, `disruptivo`, `mindset`)
- ZERO urgencia manufaturada (`última chance`, `só hoje`, `corre que`)
- ZERO `te entendo` / `fica tranquilo q vamos` (validacao afetiva)
- ZERO emojis (regra Eric universal)
- Mensagem curta — 4 linhas max, sem paragrafo longo
- Se a pessoa ja for cliente, virar reaproximacao (nao 1o contato)

**Passo 7.3 — Validar com check_message**:

```
mcp__whatsapp-agent__check_message(content=mensagem_rascunhada)
```

Se retornar `ok=true`: prosseguir.
Se retornar violacoes: REESCREVER atendendo as regras quebradas, validar de novo. Nao gravar mensagem com violacao high — sao falso positivos raros, mas custam autenticidade.

**Passo 7.4 — Gravar resultado** apenas apos validacao positiva (ou depois de log explicito de falso positivo aceito).

### Fase 8 — Criar atividade no Pipedrive (5s)

1. `mcp__pipedrive__create_activity`:
   - subject: `Mensagem de prospeccao` (sem prefixo TESTE em producao real)
   - type: `whatsapp`
   - deal_id: o capturado
   - user_id: sdr_responsavel_user_id
   - due_date: hoje
   - due_time: hoje + 30min
   - done: 0 (sera marcada done quando envio rolar via skill separada)
   - note: dados coletados (perfil + dor) + mensagem rascunhada

### Fase 9 — Adicionar nota no deal (5s)

1. `mcp__pipedrive__create_note`:
   - deal_id
   - content: estrutura
     ```
     PROSPECCAO {data}

     PERFIL PUBLICO
     - Cargo: {cargo}
     - Empresa: {empresa} ({segmento})
     - LinkedIn: {url}
     - Site: {url}
     - Resumo: {2-3 frases}

     DOR INFERIDA (confianca {nivel})
     {dor}

     ANGULO DE ABORDAGEM
     {angulo + porque desse gancho}
     ```

### Fase 10 — Retornar resultado pro orquestrador

```json
{
  "ok": true,
  "deal_id": 12345,
  "deal_url": "https://expertintegrado.pipedrive.com/deal/12345",
  "person_id": 67890,
  "stage_movido": "Lead Mapeado -> Tentando contato",
  "campos_preenchidos": ["Origem da Oportunidade", "Informacoes gerais", "Segmento", ...],
  "campos_ja_preenchidos_sem_overwrite": [...],
  "perfil": { ... },
  "mensagem_rascunhada": "...",
  "tempo_execucao_s": 60,
  "atencao_manual": ["se for cliente: ajustar mensagem", "se 3+ deals lost: ver motivo"]
}
```

---

## EXECUCAO PARALELA (squad-prospeccao orquestra)

Pra processar 30 leads, `squad-prospeccao`:
1. Disparar wave de 5 chamadas paralelas (via `Task`)
2. Aguardar todas concluirem
3. Disparar proxima wave de 5
4. Repetir
5. Consolidar em planilha unica

---

## FALLBACKS

- **Pessoa ja existe**: nao recadastrar. Adicionar deal novo (se nao tiver aberto pra mesma origem) + atividade.
- **Deal aberto ja existe pra mesma origem**: NAO duplicar. Adicionar nota + atividade nele.
- **Deal aberto em OUTRO pipeline (Super SDR, SaaS)**: usar deal existente, nao criar novo no Prospeccao 7.
- **LinkedIn bloqueia WebFetch**: usar so snippet do Google.
- **Sem empresa identificada**: cadastrar pessoa sem org_id. Mensagem usa "sua operacao" como fallback.
- **Telefone invalido (<10 digitos)**: cadastrar pessoa sem phone, marcar atencao manual.
- **Faixa de Total de colaboradores nao bate exatamente com enum**: usar opcao mais proxima ou `INFORMACAO PENDENTE`.

---

## CHECKLIST DE OUTPUT (planilha consolidada — feita pelo orquestrador)

| # | Nome | Empresa | Cargo | Person ID | Deal ID | Stage atual | Campos preenchidos | Mensagem rascunhada | Atencao manual |
|---|---|---|---|---|---|---|---|---|---|

---

## SEGURANCA

- **NAO envia mensagem.** Envio so via skill separada apos aprovacao explicita Eric.
- **NAO altera campo Pipedrive ja preenchido.** Forca = false default.
- Pesquisa LinkedIn/web e SO publica. Sem login, sem scraping autenticado.
- Em duvida sobre cadastrar duplicado: NAO cadastrar. Reportar.

---

## VERSIONAMENTO

- **v1** (03/05/2026): versao inicial. Falhou em preencher campos personalizados (so Origem) e em mover stage (parou em Lead Mapeado). Stage "Contato Realizado" referenciado nao existia no pipeline 7.
- **v2** (04/05/2026): incorpora Diretriz_Preenchimento_CRM.md. Lista canonica de campos da Pre-qualificacao. Stage destino corrigido pra "Tentando contato" (id 65). Adicionada Fase 6 explicita de mover stage. Distincao clara entre campos "agora" (pre-qualificacao + origem) e "depois" (discovery/SPICED so apos reuniao).
- **v2.1** (04/05/2026 noite): correcoes apos teste real:
  - Enum `INFORMACAO PENDENTE` -> valor literal `❌ INFORMAÇÃO PENDENTE` (com emoji + acentos)
  - Enum `Nivel de decisao` -> opcoes reais sao `Único decisor`/`Sócio decisor`/`Não é decisor` (nao Sim/Nao)
  - Lista do enum `Segmento` adicionou opcao `Seguros` que estava faltando
  - Fase 1 expandida pra incluir `search_deals` ANTES de criar deal novo (95% dos leads G4Tools ja existem)
  - Aprendizado-chave: skill nao deve assumir lead novo como default — pattern real e lead pre-existente.
- **v2.3.1** (04/05/2026 noite): correcao Eric — DDD/regiao e sinal fraco, removido. Regra final: 1-de-2 sinais OBRIGATORIO (nome+empresa OU nome+email-dominio). So nome NUNCA basta.
- **v2.3** (04/05/2026 noite): sistema de confianca de identidade:
  - Adicionada REGRA ZERO no topo
  - Niveis de confianca definem o que preencher
  - Tratamento de ambiguidade no `search_persons` (multiplos resultados): cruzar com email ou telefone, NUNCA escolher so por nome
  - Output passa a incluir bloco `identidade` com sinais batidos/faltando/discrepancias
  - Justificativa: bugs reais nos testes (Kaled retornou pessoa errada, Eric Limas confundido com executivo de irrigacao na California, Daniel Lopes nome comum)
- **v2.2** (04/05/2026 noite): integracao Voice Guide:
  - Adicionada Diretriz Mestra #2 (Voice Guide) com 8 regras hard explicitas
  - Fase 7 reformulada em 4 passos: 7.1 carregar guide via `mcp__whatsapp-agent__get_voice_guide`, 7.2 rascunhar com regras, 7.3 validar via `mcp__whatsapp-agent__check_message`, 7.4 gravar so apos OK
  - Mensagens deixam de depender da intuicao do agente sobre "voz Eric" — agora usam fonte canonica empirica (13.526 msgs validadas A/B)
  - Justificativa: notas Brain `yasak98uo4z4` (voice guide) e `pnxl3vm6dvlb` (MCP v2.8 com tools dedicadas)
