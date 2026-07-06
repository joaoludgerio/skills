---
name: pauta-semanal
description: "Gera a pauta de conteúdo da semana automaticamente a partir do que está viralizando no nicho. Roda a pesquisa de concorrentes do Instagram (skill ig-competitor-research) dos últimos 7 dias e transforma os achados em 5 pautas prontas — cada uma com tema, ângulo, formato sugerido, hook e por que tende a funcionar. Feita para rodar toda segunda-feira (agendável). Usar quando o pedido for 'monta a pauta da semana', 'me dá 5 pautas', 'pauta semanal', 'ideias de conteúdo da semana', ou quando a tarefa agendada de segunda disparar."
command: "pauta-semanal"
argument-hint: "[@handle1 @handle2 ...] (opcional — usa competitors.txt se não passar)"
allowed-tools: Bash, Read, Write, Edit
---

# Pauta Semanal — 5 pautas a partir do que viraliza no nicho

Transforma a pesquisa de concorrentes da semana em **5 pautas de conteúdo prontas pra produzir**.
É a camada de "pauta" em cima da skill `ig-competitor-research`: ela pesquisa o que bombou; esta aqui
decide o que VOCÊ vai postar a partir disso.

> **Genérico.** Não há perfis, nicho, token ou marca embutidos. A pessoa configura os concorrentes dela
> e a própria chave de API (ver Pré-requisitos). Sem isso, a skill não roda — peça pra configurar.

## Pré-requisitos (a pessoa nova precisa configurar uma vez)
- A skill **`ig-competitor-research`** instalada (esta skill chama o script dela).
- `APIFY_TOKEN` no ambiente — **cada pessoa usa a própria conta Apify** (free tier ~US$5/mês cobre).
- `ffmpeg` no PATH e `openai-whisper` (`pip install -U openai-whisper requests`) — para transcrever Reels.
- Um arquivo **`competitors.txt`** com os @ dos concorrentes do SEU nicho (1 por linha). É isto que
  personaliza a pauta — troque pelos perfis que fazem sentido pra sua marca.

## Passo 1 — Garantir a configuração
1. Localize a skill `ig-competitor-research`: ela fica na mesma pasta de skills do plugin que esta
   (pasta irmã de `pauta-semanal`). Ver Passo 2 pra regra exata de resolução do caminho.
2. Cheque se há `competitors.txt` com handles. Se não houver (ou estiver vazio), **pergunte os @** à
   pessoa e ofereça salvar no `competitors.txt` pra próxima vez.
3. Cheque se `APIFY_TOKEN` está no ambiente. Se não, oriente: "crie uma conta em apify.com, pegue o token
   e configure como variável de ambiente `APIFY_TOKEN`" — e pare até resolver.

## Passo 2 — Rodar a pesquisa (últimos 7 dias)
Resolva o caminho do `research.py` da skill instalada (funciona de qualquer pasta, independente de onde
o comando é chamado):
```bash
SKILLS_DIR=$(ls -d "$HOME/.claude/plugins/cache/expertintegrado/marketing"/*/skills | sort -V | tail -1)
```
`ig-competitor-research` fica em `$SKILLS_DIR/ig-competitor-research/scripts/research.py`, uma pasta
irmã de `pauta-semanal` dentro do mesmo plugin. Se esse caminho não existir (instalação diferente do
padrão), procure com um glob por `**/ig-competitor-research/scripts/research.py` a partir da raiz de
skills disponíveis antes de desistir.

Rode o script da skill de pesquisa (janela de 7 dias):
```bash
PYTHONUTF8=1 python "$SKILLS_DIR/ig-competitor-research/scripts/research.py" [@handles...] --dias 7 --top-total 15
```
Guarde o `RUN_DIR` impresso na última linha. (Se a pessoa quiser rápido, `--no-transcribe` pula a
transcrição — mas a transcrição deixa a pauta muito melhor.)

## Passo 3 — Analisar e escolher
Leia o `research_data.json` do `RUN_DIR`. Para os posts de maior **outlier score** (os que mais
superaram a mediana do próprio perfil), identifique padrões: que **temas**, **formatos** e **hooks** estão
puxando o engajamento da semana. Olhe as capas (`frame_path`) e transcrições.

## Passo 4 — Montar as 5 pautas
Escolha **5 pautas** que a marca da pessoa consegue produzir (adapte o tema viral ao contexto dela —
não mande copiar). Para cada pauta, entregue:

```
📌 PAUTA <n> — <título do tema>
• Ângulo: <o recorte específico>
• Formato sugerido: <Reel talking-head | carrossel listicle | ...>
• Hook sugerido: "<primeira frase que prende>"
• Por que tende a funcionar: <mecanismo — baseado no que viralizou esta semana>
• CTA sugerido: <orgânico: comenta/salva | ou pago: "o link tá aqui embaixo". NUNCA misture os dois
  na mesma peça: CTA orgânico ("comenta X") e CTA de anúncio ("link aqui embaixo") são mundos separados>
• Referência: <@perfil + o que ele fez que bombou>
```

Regras:
- **Diversifique** formatos e pilares (não 5 pautas iguais).
- **Hooks e textos gerados:** sem travessão (use vírgula, dois pontos ou parênteses) e sem frases
  fragmentadas com pontos (nada de "Sprint IA. Três dias. R$97.", escreva como fala corrida).
- Cada pauta deve ser **acionável** (dá pra gravar/produzir esta semana).
- Baseie-se no que **realmente** apareceu na pesquisa — cite a referência. Nada de inventar tendência.
- Mantenha o tom/nicho da marca da pessoa (se houver contexto salvo, use; senão, neutro).

## Passo 5 — Entregar
- Mostre as 5 pautas na conversa.
- Salve em `pautas/<AAAA-MM-DD>_pauta-semana.md` pra ficar registrado.
- Aponte o `report.html` da pesquisa (gerável com `build_report.py`, mesma resolução de `SKILLS_DIR` do
  Passo 2: `python "$SKILLS_DIR/ig-competitor-research/scripts/build_report.py" "<RUN_DIR>"`) caso a
  pessoa queira se aprofundar.
- Ofereça emendar com a skill `/criar-script` pra já roteirizar a pauta escolhida.

## Como rodar sozinha toda segunda (opcional)
Este pipeline é 100% local (Python, `ffmpeg`, Whisper local, `APIFY_TOKEN` e `competitors.txt` na
máquina da pessoa) - por isso a automação precisa ser um **agendador local** que dispare o Claude Code
com acesso a essas mesmas variáveis e arquivos, não um agente na nuvem. Use o agendador de tarefas do
próprio sistema operacional da pessoa (no Windows, o Task Scheduler; mesmo padrão que já é usado pra
outras tarefas agendadas locais) apontando pra um comando `claude` que roda esta skill toda segunda de
manhã e entrega as pautas no canal que a pessoa quiser (WhatsApp/Zoom/Telegram/e-mail).
- Horário sugerido: segunda, 8h.
- **No run agendado, rode com `--no-transcribe`** (o Whisper small é lento e trava o horário da
  entrega). Se alguma pauta escolhida precisar da transcrição, transcreva só esses posts depois.
- A tarefa deve rodar na máquina (ou servidor) que tem `competitors.txt`, `APIFY_TOKEN`, Python,
  `ffmpeg` e Whisper instalados e configurados pra pessoa que assumir.
- Não criar a tarefa sem a pessoa pedir; e confirmar o canal de entrega antes.

## Custo
Apify ~US$0,10–0,15 por run (cabe no free tier). Whisper roda local = grátis. Só paga a assinatura do Claude.
