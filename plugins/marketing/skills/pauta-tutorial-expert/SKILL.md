---
name: pauta-tutorial-expert
description: "Garimpa perguntas REAIS de dono/decisor de empresa nas fontes internas da Expert (atas de reunião no Pipedrive, conversas do ChatGuru, transcrições avulsas) e transforma em pautas prontas pra série de tutoriais do @expertintegrado, mantendo uma fila com dedupe e status. Cada pauta sai com a pergunta literal, ângulo didático, hook e CTA sugeridos. Usar quando pedirem 'garimpa perguntas pra série da Expert', 'monta a fila do tutorial-expert', 'pautas do tutorial da Expert', 'roda o pauta-tutorial-expert', ou antes de produzir episódios em lote."
argument-hint: "[--fontes pipedrive,chatguru,pasta] [--dias N] [--pasta <transcricoes>]"
allowed-tools: Read, Write, Edit, Bash, Glob
---

# Pauta Tutorial Expert (garimpo de perguntas reais)

A força da série de tutoriais do @expertintegrado é responder o que dono de empresa REALMENTE
pergunta, com as palavras dele. Esta skill minera essas perguntas nas fontes internas e
mantém a fila de pautas que a skill `tutorial-expert` consome.

## A fila (estado persistente, fora do plugin)

`C:/Users/<user>/Downloads/tutorial-expert/fila-pautas.md`, tabela com colunas:

| data | pergunta (literal, anonimizada) | fonte | segmento | status |

Status: `nova` (pronta pra produzir), `produzida` (virou episódio; anotar o slug),
`descartada` (com o motivo curto). Criar o arquivo na primeira rodada. NUNCA apagar linhas:
a fila é também o histórico de dedupe.

## Fluxo

### 1. Coletar (fontes na ordem, pular as indisponíveis avisando)

Janela default: últimos 14 dias (`--dias` muda).

- **Pipedrive (melhor fonte):** as reuniões gravadas viram ata nas notas dos deals
  (sistema meeting-to-crm). Via MCP do Pipedrive: listar os deals com atividade recente
  (`list_deals` / `search_deals`), puxar `list_deal_notes` dos mais movimentados e ler as
  atas procurando PERGUNTAS do lead (dúvida, objeção formulada como pergunta, "e se...",
  "quanto custa...", "isso funciona pra...").
- **ChatGuru (WhatsApp comercial, leitura):** `chatguru_list_chats` nos chats recentes +
  `chatguru_read_messages` nos mais ativos. Perguntas escritas pelo LEAD, ipsis litteris.
- **Transcrições avulsas:** se vier `--pasta`, ler os .txt/.srt/.md de transcrição
  (webinário, mentoria, imersão) e extrair as perguntas da plateia.
- **Time:** se as fontes acima renderem pouco, sugerir perguntar no canal do comercial
  quais dúvidas mais ouviram na semana (5 minutos de Zoom rendem 10 pautas).

Se um MCP não estiver configurado na máquina, avisar qual faltou e seguir com as outras
fontes (não travar o garimpo inteiro).

### 2. Filtrar e anonimizar

Entra na fila só o que passa nos 4 filtros:

1. **Pergunta de decisor** (dono, sócio, gestor), não dúvida operacional de suporte.
2. **Atemporal**: continua fazendo sentido daqui a 6 meses (a série não cobre notícia).
3. **Respondível em 60s** com um passo a passo concreto (se precisa de aula, é pauta de
   outro formato; anotar como descartada com motivo "longa demais").
4. **Anonimizável**: a pergunta reescrita SEM nome de pessoa/empresa/segmento identificável
   continua fazendo sentido. Registrar só o segmento genérico (ex.: "clínica", "advocacia").
   NUNCA levar nome de lead ou dado de negociação pra fila nem pro conteúdo.

Dedupe: antes de adicionar, comparar com TODAS as linhas da fila (qualquer status). Mesma
pergunta com outras palavras = duplicata; manter a formulação mais natural de fala.

### 3. Rankear e entregar

Escolher as 5 melhores da rodada (frequência entre fontes > força da dor > variedade de
tema vs episódios já produzidos) e entregar no formato:

```
📌 PAUTA <n> (fila: linha <k>)
• Pergunta: "<como o dono falou>"
• Fonte: <pipedrive | chatguru | transcrição> (<segmento>)
• Ângulo didático: <o recorte que cabe em 60s>
• Hook sugerido: "<a pergunta, encurtada pra abrir o vídeo>"
• Palavra de CTA sugerida: <UMA palavra simples>
• Por que rende: <frequência/mecanismo observado no garimpo>
```

Regras de texto: sem travessão, sem frases picotadas, "você/seu" (nunca "tu/teu").

### 4. Fechar a rodada

- Adicionar as novas na fila com status `nova`.
- Mostrar o placar: quantas coletadas, quantas filtradas fora (e por quê), tamanho da fila.
- Oferecer emendar com `/tutorial-expert --da-fila` pra já produzir a primeira.

## Edge cases

- **Fila vazia + fontes secas:** não inventar pergunta "que parece real". Usar as 5 perguntas
  seed de `../tutorial-expert/references/tom-canal-expert.md` (validadas na reunião de 09/07)
  e avisar que são seed, não garimpo.
- **Ata com dado sensível (valor de proposta, nome):** usar a PERGUNTA, nunca o contexto da
  negociação. O que identifica o lead não sai do CRM.
- **Rodada agendada (segunda de manhã):** mesmo padrão da `pauta-semanal`: agendador local
  (Task Scheduler) chamando o Claude Code; só criar se a pessoa pedir, confirmando o canal
  de entrega.

## Skills relacionadas

- `tutorial-expert`: consome a fila (`--da-fila`) e marca a pauta como `produzida`.
- `pauta-semanal`: a irmã de TOPO DO ERIC (viraliza por concorrente); esta aqui é a fila da
  série da EMPRESA (perguntas internas reais). Não misturar as duas filas.
