# expertintegrado/skills — Regras e Estrutura

Marketplace de skills profissionais da Expert Integrado pra Claude Code. Reestruturado em 24/05/2026 (v2.0.0) com **5 plugins por departamento**.

## Estrutura

```
expertintegrado/skills (este repo)
├── .claude-plugin/marketplace.json  ← cataloga os 5 plugins
├── plugins/
│   ├── comercial/      ← reabordagem, pipe-review, prospecta-lead, whatsapp-campanha-api-fup, whatsapp-campanha-central-prospeccao, estou-devendo (+ futuras: fup-pipedrive)
│   ├── eventos/        ← convidar-evento, verificar-convites
│   ├── marketing/      ← tweet-print, pesquisa-instagram (+ futuras: imagem, video)
│   ├── operacoes/      ← email-cleaner, onboard
│   └── setup/          ← telegram-setup
└── mcps/               ← MCPs (Pipedrive, ClickUp, Zoom, Outlook, ChatGuru)
```

## Instalacao

PC, notebook, VPS:
```
/plugin marketplace add expertintegrado/skills
/plugin install comercial@expertintegrado
/plugin install eventos@expertintegrado
/plugin install marketing@expertintegrado
/plugin install operacoes@expertintegrado
/plugin install setup@expertintegrado
```

VPS comercial pode instalar so `comercial`. Notebook enxuto so `comercial + operacoes`.

## Atualizacao

Apos qualquer push pra main:
```
/plugin update comercial@expertintegrado   # (ou o plugin afetado)
```

## Critério de graduacao (Sandbox → Production)

Skills novas nascem em `ericlucianoferreira/skills` (incubator pessoal). Pra entrar neste repo (`expertintegrado/skills`), precisam atender os 5:

1. **Uso real ≥ 5x em producao** (nao em demo)
2. **Sem bug critico nos ultimos 14 dias**
3. **Documentacao completa** — SKILL.md com triggers, exemplos, edge cases
4. **Voice Guide compliance** (pras skills que mandam WhatsApp)
5. **Outra maquina sua rodou** (ou outro membro do time validou)

Atende os 5 → PR move skill do incubator pra este repo, marketplace bump versao.

---

# REGRAS PIPEDRIVE OBRIGATORIAS

Estas regras eram skill `pipedrive-crm` ate v1.2.1. A partir de v2.0.0 viraram **regras obrigatorias** (carregadas via CLAUDE.md, sem trigger) — Claude DEVE seguir SEMPRE que operar Pipedrive.

## 0. FALLBACK quando tool aparece bloqueada

Sintoma: chamada de `create_*` ou `update_deal_fields` retorna `This tool has been disabled in your connector settings.`

Causa: hook Callback do Claude Desktop bloqueia tools com prefixo `create_*`.

Workaround: usar `pipedrive_write` (versao >= 5.9.0 do MCP). Mesma logica, nome neutro escapa do callback.

```
pipedrive_write({
  action: "create_activity",
  params: { subject: "...", type: "task", deal_id: 30, due_date: "2026-05-12" }
})
```

Actions suportadas: `create_activity`, `create_deal`, `create_person`, `create_organization`, `add_product_to_deal`, `update_deal_fields`, `create_note`.

## 1. CHECKLIST OBRIGATORIO — Criar Pessoa + Negocio

### Passo 1: Verificar duplicata
```
search_persons(term: "nome")
search_persons(term: "telefone")
```
- Se existe: usar person_id existente, NAO criar duplicata
- Se existe e tem "Origem do Contato" preenchida: NAO sobrescrever

### Passo 2: Criar pessoa (se nao existe)
Usar `create_person` ou `create_deal_full`.

### Passo 3: Preencher origem da PESSOA (OBRIGATORIO)
Logo apos criar, SEMPRE executar `update_person`:
```
update_person(id: person_id, custom_fields: {
  "Origem do Contato": "<ORIGEM>",
  "Detalhes da origem do contato": "<DETALHE>"
})
```
- Origem do Contato e preenchida 1x na vida. NUNCA muda entre deals.
- Se ja existia e tem origem: NAO sobrescrever.

### Passo 4: Criar negocio
Usar `create_deal` ou `create_deal_full`.

### Passo 5: Preencher origem do NEGOCIO (OBRIGATORIO)
Logo apos criar:
```
update_deal_fields(deal_id: deal_id, custom_fields: {
  "Origem da Oportunidade": "<ORIGEM>",
  "Detalhes da origem da oportunidade": "<DETALHE>"
})
```

### Passo 6: Confirmar
Listar pro usuario: pessoa (nome+ID+link), negocio (titulo+ID+link+pipeline/etapa), origens, atividades criadas.

## 2. ORIGENS VALIDAS (enum exato)

| Prefixo | Quando usar |
|---------|-------------|
| ORG | Canal proprio (bio, automacao, site, palestra, WA receptivo) |
| SS | Social Selling em rede social |
| OUT | Prospeccao ativa (manual ou automatica) |
| INDIC | Indicacao — preencher "Pessoa que indicou" tambem |
| BASE | Lead antigo reativado ou retomado |
| CROS | Cliente existente comprando outro produto |
| EVENTO | Lead veio de evento especifico |
| PUBLI | Publicidade/patrocinio |
| ADS | Campanha paga |
| APP | Produto/app proprio |

### Opcoes validas (usar EXATAMENTE como escrito):
```
ORG | Automacao do @ericluciano
ORG | Automacao do @expertintegrado
ORG | SE Bio @ericluciano
ORG | SE Bio @expertintegrado
ORG | Mensagem receptiva de whatsapp
ORG | Palestra Eric Luciano
ORG | Site Super SDR
SS | @ericluciano
SS | @expertintegrado
OUT | Outbound Manual
OUT | Outbound Automatico
INDIC | ChatGuru
INDIC | Geral
INDIC | Direta do Eric
BASE | Lead retomou conversa
BASE | Retomada programada
BASE | Campanha de base interna
CROS | Cliente Ativo
CROS | Cliente Inativo
CROS | Downsell de Projetos
CROS | Downsell de Educacional
CROS | Upsell de Educacional
EVENTO | ADVBOX
EVENTO | IA Summit Joinville 2025
EVENTO | Imersao Highticket 23
EVENTO | Imersao Highticket 24
EVENTO | Growth Conference 2024
EVENTO | Nova Era
EVENTO | WebSummit
EVENTO | Eric presencialmente
PUBLI | ADVBOX
PUBLI | G4 Tools
ADS | Facebook Leads
ADS | LP > Formulario
ADS | LP > WhatsApp
ADS | SE LP
ADS | SE Manychat
ADS | WhatsApp > SDR
Lancamento Mentoria Automacoes Inteligentes
APP | Voice AI
Desconhecido
```

### Mapeamento contexto Eric → origem:
- "G4 Tools" / "G4" / "G4 Scale" / "G4 Traction" / "G4 Educacao" → `PUBLI | G4 Tools`
- "indicacao do Eric" / "indicacao minha" → `INDIC | Direta do Eric`
- "indicacao" (generico) → `INDIC | Geral`
- "Instagram" → `SS | @ericluciano` ou `SS | @expertintegrado`
- "evento" + nome → `EVENTO | <nome>` ou `EVENTO | Eric presencialmente`
- "outbound" → `OUT | Outbound Manual`
- "cliente" → `CROS | Cliente Ativo` ou `CROS | Cliente Inativo`
- Sem inferencia clara: perguntar.

### Campo "Pessoa que indicou":
- Preencher SOMENTE se origem for INDIC
- Valor: nome de quem indicou (texto livre)
- "indicacao minha" → "Eric Luciano"

## 3. PIPELINES E ETAPAS

### Educacional (ID: 6)
| Ordem | Etapa | ID |
|-------|-------|----|
| 1 | Sem contato | 52 |
| 2 | Contato Realizado | 53 |
| 3 | Aguardando agendamento | 115 |
| 4 | Apresentacao Agendada | 54 |
| 5 | Apresentacao realizada | 60 |
| 6 | Proposta enviada | 55 |
| 7 | Em negociacao | 56 |
| 8 | Formalizacao | 82 |

### SaaS (ID: 1)
| Ordem | Etapa | ID |
|-------|-------|----|
| 1 | Sem contato | 16 |
| 2 | Contato realizado | 17 |
| 3 | Apresentacao agendada | 19 |
| 4 | Apresentacao realizada | 61 |
| 5 | Proposta enviada | 20 |
| 6 | Em negociacao | 21 |
| 7 | Formalizacao | 83 |

### Super SDR (ID: 2)
| Ordem | Etapa | ID |
|-------|-------|----|
| 1 | Sem contato | 7 |
| 2 | Contato realizado | 8 |
| 3 | Aguardando agendamento | 90 |
| 4 | Demo agendada | 9 |
| 5 | Demo realizada | 10 |
| 6 | Proposta enviada | 12 |
| 7 | Em negociacao | 14 |
| 8 | Formalizacao | 81 |

### Prospeccao (ID: 7)
| Ordem | Etapa | ID |
|-------|-------|----|
| 1 | Lead Mapeado | 64 |
| 2 | Tentando contato | 65 |
| 3 | Conexao iniciada/Em qualificacao | 66 |
| 4 | Pre-Qualificado | 68 |
| 5 | Qualificado | 116 |
| 6 | Reuniao agendada | 79 |

### Parceria (ID: 10)
| Ordem | Etapa | ID |
|-------|-------|----|
| 1 | Sem contato | 84 |
| 2 | Contato Inicial | 85 |
| 3 | Interesse Confirmado | 86 |
| 4 | Reuniao de Alinhamento | 87 |
| 5 | Negociacoes Iniciadas | 88 |
| 6 | Formalizacao | 89 |

## 4. TIPOS DE ATIVIDADE

| Tipo (API) | Nome visivel | Quando usar |
|-----------|-------------|-------------|
| whatsapp | WhatsApp | Conversa por WhatsApp |
| call | Chamada | Ligacao telefonica |
| instagram | Instagram | Interacao por Instagram DM |
| linkedin | Linkedin | Contato via LinkedIn |
| email | E-mail | Email enviado/recebido |
| task | Tarefa | Acao interna (nao e contato) |
| encontro_presencial | Encontro presencial | Reuniao presencial |
| diagnostico | Demonstracao | Demo do produto |
| apresentacao | Reuniao Geral | Reuniao online generica |
| meeting | NO-SHOW | Lead nao apareceu |
| deadline | Prazo | Prazo limite |
| recurso_de_ia | Recurso de IA | Acao executada por IA |

### Regras de atividade:
- Todo negocio DEVE ter uma proxima atividade agendada
- Atividade concluida: `done: true`
- Atividade futura: `done: false`
- "marca para [dia]": criar atividade com `due_date` no dia indicado
- NUNCA passar `due_time` ao criar atividade sem horario definido — se passar string vazia ou "00:00", Pipedrive marca como vencida

## 5. CAMPOS PRE-QUALIFICACAO (preencher quando informado)

| Campo | Tipo | Quando preencher |
|-------|------|-----------------|
| Segmento | enum | Sempre que Eric informar nicho/setor |
| Nicho (detalhes adicionais) | texto | Complemento do segmento |
| Informacoes gerais | texto | Dados da empresa (modelo, localizacao) |
| Midias e redes da empresa | texto | Links Instagram, site, LinkedIn |

### Segmentos validos:
Academia e empresas de esporte, Agencias em geral, Agencia de Marketing, Arte e Cultura, Call Center, Clinica Estetica, Clinica Medica, Contabilidade, Consultoria, Educacao, Ecommerce, Energia, Entretenimento, Eventos, Imoveis e Construcao, Industria, Infoprodutos e Mentorias, Juridico, Seguros, Servicos Financeiros, Servicos Gerais, Tecnologia e TI, Turismo e Viagens, Varejo, Vendas, Outros (descrever)

## 6. REGRAS GERAIS

1. **sync_fields primeiro**: Se campos personalizados derem erro, rodar `sync_all` antes
2. **Nunca sobrescrever**: Campos com valor NAO sao alterados (exceto se Eric pedir)
3. **Origem obrigatoria**: NUNCA criar pessoa ou negocio sem definir origem
4. **Detalhe obrigatorio**: SEMPRE preencher o detalhe da origem
5. **Indicacao → Pessoa que indicou**: Se origem e INDIC, preencher campo
6. **Telefone sempre com DDI+DDD**: Formato 55XXXXXXXXXXX (sem +, sem espacos)
7. **Nome do deal**: Usar o que Eric disser. Se nao disser, usar nome da pessoa
8. **Titulo padrao deal**: `Nome | Empresa`
9. **Links clicaveis**: Sempre incluir link do Pipedrive no resumo final
10. **Motivos de Perda**: Parou de responder, Fora do orcamento, Adiou contratacao (Reversiveis); Mudanca de prioridade, Contratou outra, Internalizou (Dificil); Nao e o que buscava, Ferramenta incompativel (Definitivo)
11. **Lead perdido → atividade de retomada**: Toda marcacao de Perdido dispara criacao obrigatoria de atividade de retomada futura (30/90/180 dias por motivo de perda)
