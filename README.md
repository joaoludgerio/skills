# Expert MCPs + Skills

Ferramentas de IA da Expert Integrado para uso com Claude Code: MCPs (servidores que conectam Claude a sistemas) e Skills (instrucoes que orquestram tarefas profissionais por departamento).

> Reorganizado em 24/05/2026 (v2.0.0): skills em plugins por departamento via marketplace. Hoje sao 4 plugins: comercial, eventos, marketing e operacoes.

## MCPs incluidos

| Ferramenta | Descricao |
|------------|-----------|
| **Pipedrive** | Deals, contatos, atividades e notas no CRM |
| **ClickUp** | Tarefas, documentos e time tracking |
| **Zoom** | Mensagens, canais e contatos no Zoom Team Chat |
| **Outlook** | E-mails, calendario e contatos via Microsoft 365 |
| **ChatGuru** | Consulta de conversas do WhatsApp empresarial |
| **WhatsApp** | WhatsApp pessoal via extensao do navegador |

## Skills (4 plugins por departamento)

| Plugin | Skills | Comando |
|--------|--------|---------|
| **comercial** | prospecta-lead, reabordagem, pipe-review, fup-inteligente, transferir-lead, estou-devendo, calendly-agendar, calendly-link, whatsapp-campanha-api-fup, whatsapp-campanha-central-prospeccao | `/plugin install comercial@expertintegrado` |
| **eventos** | convidar-evento, verificar-convites, notificacao-webinario | `/plugin install eventos@expertintegrado` |
| **marketing** | Video e Reels: criar-reel, viral-pra-reel, clipar-video, video, editar-video-motion, cortar-respiros, gerar-srt. Conteudo: orquestrar-conteudo, carrossel-studio, imagem, criar-script, tweet-print. Blog: agente-draft-blog, agente-revisor-blog, agente-publisher-blog, gerar-hero-blog, criar-post-blog (deprecado). Trafego e webinario: criar-campanha, relatorio-ads, criar-webinario. Pesquisa: ig-competitor-research, pauta-semanal. Conta @expertintegrado: tutorial-expert, pauta-tutorial-expert, depoimento-expert. Palestra: demonstracao-agente | `/plugin install marketing@expertintegrado` |
| **operacoes** | email-cleaner, onboard | `/plugin install operacoes@expertintegrado` |

> Maquinas/perfis diferentes instalam pacotes diferentes. PC do Eric instala todos. VPS comercial so `comercial + operacoes`. Notebook enxuto so `comercial`.

## Instalacao das skills (plugins)

No Claude Code, direto no chat:

```
/plugin marketplace add joaoludgerio/skills
/plugin install marketing@expertintegrado
```

Troque `marketing` pelo plugin desejado. Skills com setup proprio (ex.: criar-reel) trazem um `SETUP.md` dentro da pasta da skill; depois de instalar, peca ao Claude: "le o SETUP.md da skill criar-reel e me guia na instalacao".

## Skills removidas em v2.0.0

- `pipedrive-crm` virou **regras carregadas via CLAUDE.md** (sem trigger). Documentacao completa em `CLAUDE.md` deste repo. Resumo tambem em `~/.claude/CLAUDE.md` (global).

## Pre-requisitos

- [Node.js 18+](https://nodejs.org/) — instale e reinicie o computador
- [Claude Code](https://claude.ai/download) instalado

## Instalacao dos MCPs

Abra o Claude Code e envie o seguinte prompt:

> Clona https://github.com/joaoludgerio/skills.git em C:\MCPs\expert-mcps e roda `node setup.js` pra instalar os MCPs

O Claude Code faz tudo automaticamente:
1. Clona o repositorio
2. Executa o setup interativo em portugues
3. Voce escolhe quais ferramentas instalar
4. O setup guia a obtencao de credenciais passo a passo
5. Autenticacao via navegador quando necessario (Outlook, Zoom, ChatGuru)
6. Configura o Claude Code automaticamente — sem editar nenhum arquivo

## Credenciais

### Credenciais pessoais (cada pessoa obtem a sua)

| Ferramenta | O que obter | Onde encontrar |
|------------|-------------|----------------|
| **Pipedrive** | API Key pessoal | Pipedrive > Configuracoes > Preferencias pessoais > API |
| **ClickUp** | API Token pessoal (requer plano pago) | ClickUp > Settings > Apps > API Token. Se nao tem plano pago, pergunte ao seu gestor se existe uma conta compartilhada. |

### Autenticacao via navegador (nao precisa de credencial)

| Ferramenta | Como funciona |
|------------|---------------|
| **Outlook** | O setup abre o navegador — faca login com sua conta @expertintegrado.com.br |
| **Zoom** | O setup abre o navegador — faca login com sua conta Zoom da empresa |
| **ChatGuru** | O setup abre o navegador — digite seu usuario e senha do ChatGuru |
| **WhatsApp** | Instale a extensao do navegador e mantenha o WhatsApp Web aberto |

## Atualizacao

Quando houver atualizacao, abra o Claude Code e peca:

> Atualiza o repositorio em C:\MCPs\expert-mcps com git pull e roda node setup.js

## Estrutura

```
expert-mcps/
  .claude-plugin/
    marketplace.json    (cataloga os 4 plugins)
  CLAUDE.md             — regras canonicas (incluindo Pipedrive)
  mcps/                 — servidores MCP
    pipedrive/    — Pipedrive CRM
    clickup/      — ClickUp
    zoom/         — Zoom Team Chat
    outlook/      — Microsoft 365 (Outlook)
    chatguru/     — ChatGuru (modo readonly)
    whatsapp/     — WhatsApp Web
  plugins/              — skills por departamento (v2.0.0)
    comercial/
      .claude-plugin/plugin.json
      skills/  (10 skills; ver tabela acima)
    eventos/
      skills/  (convidar-evento, verificar-convites, notificacao-webinario)
    marketing/
      skills/  (23 skills de video, conteudo, blog e trafego; ver tabela acima)
    operacoes/
      skills/  (email-cleaner, onboard)
  setup.js              — Setup interativo de MCPs
  package.json
  README.md
```

## Criterio de graduacao (Sandbox → Production)

Skills novas nascem em `ericlucianoferreira/skills` (incubator pessoal do Eric). Pra entrar neste repo precisam atender os 5:

1. Uso real >= 5x em producao (nao demo)
2. Sem bug critico nos ultimos 14 dias
3. Documentacao completa (SKILL.md com triggers, exemplos, edge cases)
4. Voice Guide compliance (skills que mandam WhatsApp)
5. Outra maquina sua rodou (ou outro membro do time validou)

## Problemas?

Peca ao Claude Code:
> Verifica se meus MCPs estao configurados corretamente

Ou consulte a documentacao no ClickUp (Ferramentas de IA > Resolucao de Problemas).

## Licenca

MIT - Expert Integrado
