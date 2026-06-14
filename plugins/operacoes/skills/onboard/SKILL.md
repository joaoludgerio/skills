---
name: onboard
description: Onboarding inicial da memoria do Claude para um colaborador NOVO da Expert Integrado (primeira configuracao do zero). Cria CLAUDE.md, rules e memory com info da empresa e preferencias do colaborador. TRIGGER quando o usuario pedir "fazer onboard", "onboarding de colaborador novo", "setup inicial do meu Claude", "configurar minha memoria pela primeira vez", "sou novo na Expert e quero configurar o Claude". NAO usar para editar/atualizar memoria ja existente (ex: "atualiza minha memoria com X") nem para a configuracao pessoal do Eric — para isso, editar os arquivos direto.
---

# Onboarding de Memoria — Expert Integrado

Skill para configurar a memoria do Claude de um novo colaborador.
Guia passo a passo, cria todos os arquivos e oferece migracao de outros assistentes.

---

## FLUXO DO ONBOARDING

### Etapa 1: Boas-vindas e coleta de informacoes

Cumprimente o usuario e explique:
- Voce vai configurar a memoria do Claude para que ele te ajude melhor no dia a dia
- Sao algumas perguntas rapidas sobre voce e como voce trabalha
- Leva menos de 5 minutos

Faca as perguntas abaixo. Prefira UMA unica mensagem de conversa com a lista numerada (o colaborador responde tudo de uma vez) em vez de varios popups AskUserQuestion seguidos. Se usar AskUserQuestion, lembre que ele aceita no maximo 4 perguntas por chamada — entao agrupe, nao dispare 7 popups.

1. **Nome completo**
2. **Cargo/funcao** na Expert Integrado
3. **Departamento** (Operacoes, CS, Comercial, Marketing, Financeiro, Admin)
4. **Quem e seu gestor direto**
5. **Quais ferramentas voce mais usa no trabalho?** (Pipedrive, ClickUp, Zoom, Outlook, ChatGuru, WhatsApp)
6. **Como voce prefere que o Claude se comunique?**
   - Direto e curto (padrao Expert)
   - Mais detalhado e explicativo
   - Formal
7. **Voce usa o Claude no celular tambem?** (sim/nao)

### Etapa 2: Gerar os arquivos de memoria

Com base nas respostas, criar a seguinte estrutura em `~/.claude/`:

```
~/.claude/
  CLAUDE.md                    <- Preferencias pessoais
  rules/
    preferences.md             <- Regras de comunicacao
  memory/
    MEMORY.md                  <- Indice
    expert-integrado.md        <- Info da empresa
    produtos.md                <- Produtos da empresa
    tech-stack.md              <- Ferramentas e MCPs
```

**IMPORTANTE:** Verificar se ja existem arquivos. Se existirem, perguntar se quer sobrescrever ou manter.

#### CLAUDE.md (personalizado)

Usar o template em `templates/CLAUDE.md` como base. Substituir:
- `{{NOME}}` pelo nome do colaborador
- `{{CARGO}}` pelo cargo
- `{{DEPARTAMENTO}}` pelo departamento
- `{{GESTOR}}` pelo nome do gestor
- `{{FERRAMENTAS}}` pela lista de ferramentas que usa
- `{{TOM}}` pelo estilo de comunicacao escolhido
- Remover secoes que nao se aplicam ao perfil

#### rules/preferences.md

Copiar o template padrao de `templates/rules/preferences.md`. Ajustar o tom se o usuario preferiu algo diferente do padrao.

#### memory/ (arquivos padrao)

Copiar os templates de `templates/memory/` para `~/.claude/memory/`:
- `MEMORY.md` — indice
- `expert-integrado.md` — informacoes da empresa
- `produtos.md` — produtos da Expert
- `tech-stack.md` — ferramentas e MCPs

Esses arquivos sao iguais para todos os colaboradores.

### Etapa 3: Migracao de outros assistentes (opcional)

Pergunte ao usuario:

> Voce usa ou ja usou outros assistentes de IA como ChatGPT ou Claude.ai no navegador?
> Se sim, pode ser util trazer suas conversas e preferencias de la para ca.

Se o usuario disser SIM, orientar:

#### Para migrar do ChatGPT:
```
1. Acesse chat.openai.com
2. Clique no seu nome (canto inferior esquerdo)
3. Va em Settings > Data Controls > Export Data
4. Voce vai receber um e-mail com um arquivo .zip
5. Baixe e extraia o .zip
6. Dentro vai ter um arquivo conversations.json
7. Me envie esse arquivo que eu analiso e trago as informacoes relevantes
```

#### Para migrar do Claude.ai:
```
1. Acesse claude.ai
2. Clique no seu nome (canto inferior esquerdo)
3. Va em Settings
4. Procure a secao "Memory" ou "Project Knowledge"
5. Exporte ou copie o conteudo
6. Me envie que eu organizo nos seus arquivos de memoria
```

#### Apos receber os arquivos:
- Analisar o conteudo exportado
- Extrair preferencias, contexto profissional, informacoes uteis
- Adicionar ao `CLAUDE.md` ou criar arquivos em `memory/` conforme necessario
- NAO copiar conversas inteiras — apenas extrair informacoes estruturadas

### Etapa 4: Verificacao e proximos passos

Mostrar ao usuario um resumo do que foi criado:

```
Memoria configurada com sucesso!

Arquivos criados:
  ~/.claude/CLAUDE.md          — Suas preferencias pessoais
  ~/.claude/rules/preferences.md — Regras de comunicacao
  ~/.claude/memory/MEMORY.md   — Indice da memoria
  ~/.claude/memory/expert-integrado.md — Info da empresa
  ~/.claude/memory/produtos.md — Produtos da Expert
  ~/.claude/memory/tech-stack.md — Ferramentas e MCPs

Para testar, feche e reabra o Claude Code. Depois pergunte:
  "Qual e meu cargo na Expert Integrado?"
  "Quais sao os produtos da empresa?"

Se precisar ajustar algo depois, e so pedir:
  "Atualiza minha memoria com [informacao]"
```

---

## REGRAS

1. **Todos os textos em portugues brasileiro** com acentuacao correta
2. **Sem emojis** a menos que o usuario peca
3. **Tom acolhedor mas direto** — lembrar que sao pessoas nao tecnicas
4. **Nao incluir informacoes confidenciais** nos templates:
   - Nao incluir MRR, folha de pagamento, metricas de turnover
   - Nao incluir lista de desligados
   - Nao incluir OKRs ou metas financeiras
   - Nao incluir precos detalhados dos produtos (apenas descricao geral)
5. **Verificar antes de sobrescrever** — se ja existem arquivos, perguntar
6. **Caminhos Windows** — usar `~/.claude/` que resolve automaticamente
7. **Nao mencionar Eric pelo nome** nos templates — usar "CEO" ou "fundador"
