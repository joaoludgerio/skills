---
name: viral-pra-reel
description: "Workflow que transforma o que está viralizando nos concorrentes em Reel do Eric: roda a pesquisa de concorrentes do Instagram (skill ig-competitor-research, Apify + Whisper), aplica filtros de curadoria (janela de 30 dias, fit com o posicionamento do Eric, só conteúdo atemporal, nunca cópia do script) e entrega a pauta aprovada pra skill criar-reel produzir o vídeo completo. Usar quando o João/Eric pedir 'faz um reel do que tá viralizando', 'pega o viral dos concorrentes e faz um vídeo', 'roda o viral-pra-reel', 'clona o viral do [perfil]', 'transforma esse conteúdo de concorrente em reel'."
argument-hint: "[@handles...] [--dias 30] [--top 12]"
allowed-tools: Read, Write, Edit, Bash, WebFetch, WebSearch, Glob, Grep, Skill, AskUserQuestion
---

# Viral pra Reel — do concorrente ao vídeo do Eric

Orquestra duas skills irmãs deste plugin (`ig-competitor-research` e `criar-reel`) com uma
camada de curadoria no meio. Princípio central: **o concorrente valida O TEMA e O ÂNGULO,
nunca fornece o texto.** O roteiro final é 100% reescrito na voz do Eric e SEMPRE atemporal.

Este arquivo é prescritivo de propósito: siga os comandos e critérios LITERALMENTE, na ordem.
Onde houver número (nota de corte, contagem de caracteres, quantidade de clips), o número manda.

## Setup (rodar UMA vez no início de todo run)

1. Definir as variáveis do run COPIANDO este bloco literalmente (num único comando Bash; em
   comandos seguintes, repetir a definição de SKILLS_DIR/RUN_BASE no mesmo comando, porque o
   shell não guarda variáveis entre chamadas):
   ```bash
   SKILLS_DIR=$(ls -d "$HOME/.claude/plugins/cache/expertintegrado/marketing"/*/skills | sort -V | tail -1)
   RUN_BASE="$HOME/Downloads/viral-pra-reel"; mkdir -p "$RUN_BASE"
   ls "$SKILLS_DIR/ig-competitor-research/scripts/research.py" "$SKILLS_DIR/criar-reel/scripts/elevenlabs_heygen.py"
   ```
   Se o `ls` falhar, avisar o usuário que o plugin marketing está incompleto/desinstalado e parar.
2. Todo comando `python` deste workflow roda com `PYTHONUTF8=1` na frente (console Windows é
   cp1252 e quebra acento sem isso; em macOS/Linux é inócuo).
3. Conferir que `APIFY_TOKEN` existe no ambiente (`echo ${APIFY_TOKEN:+ok}`). Sem ele, parar e
   pedir ao usuário (a pesquisa usa o ator de scrape do Instagram da Apify).
4. NUNCA gravar saída dentro da pasta do plugin (ela é sobrescrita em updates): tudo vai em
   `$RUN_BASE` e nas pastas `~/Downloads/reel-<slug>/` de cada vídeo.
5. Carregar o REGISTRO DE PRODUZIDOS (obrigatório, é o anti-repetição do Filtro D). Ele é
   COMPARTILHADO ENTRE MÁQUINAS (João, Eric, etc.) e tem três camadas:
   (a) REGISTRO NA NUVEM (arquivo reels-produzidos.md no repo GitHub do banco de B-rolls):
   sincronizar pro local com
   `PYTHONUTF8=1 python "$SKILLS_DIR/viral-pra-reel/scripts/registro_reels.py" --sync "$RUN_BASE/reels-produzidos.md"`
   (a leitura é pública, não precisa de login);
   (b) BIBLIOTECA via MCP (carregar `mcp__biblioteca__biblioteca_listar_conteudos` via
   ToolSearch): é a fonte da verdade do que está PUBLICADO; todo slug dela que não estiver no
   arquivo sincronizado vira linha nova de pré-registro no arquivo local;
   (c) o arquivo local `$RUN_BASE/reels-produzidos.md` é a cópia de trabalho do run.
   Motivo das camadas: em produção um tema repetido passou porque o registro só existia numa
   máquina; com a nuvem, qualquer máquina (a do Eric inclusive) vê o mesmo histórico.

## ETAPA 0 — Padrões do PRÓPRIO perfil (o que funciona com o público do Eric)

1. Sincronizar o arquivo de padrões da nuvem:
   `PYTHONUTF8=1 python "$SKILLS_DIR/viral-pra-reel/scripts/registro_reels.py" --file padroes-perfil.md --sync "$RUN_BASE/padroes-perfil.md"`
2. Se o arquivo tiver "Última análise" com MENOS de 30 dias, só LER e seguir pra ETAPA 1.
3. Se estiver velho/vazio (ou o usuário pedir "atualiza os padrões"): rodar a MESMA pesquisa
   de concorrentes no PRÓPRIO perfil (handle em `perfil-proprio.txt` desta skill) com
   `--dias 90`, MAIS os campeões históricos listados em `hits.txt` desta skill (o scraper só
   alcança posts recentes; os virais antigos entram por lá). Transcrever os top posts, comparar
   HITS vs FLOPS e reescrever o `padroes-perfil.md` com: hooks que performaram (texto literal
   dos 3 primeiros segundos), temas campeões vs temas fracos, CTA e palavra usados nos hits,
   duração dos hits, e 3 regras acionáveis pro próximo roteiro. Datar ("Última análise:
   AAAA-MM-DD") e subir: `registro_reels.py --file padroes-perfil.md --put "$RUN_BASE/padroes-perfil.md"`.
4. Esses padrões ALIMENTAM a curadoria (desempate entre candidatos: tema mais próximo dos hits
   ganha) e o roteiro (etapa 4/5: hook e CTA seguem o que JÁ funcionou com este público).

## ETAPA 1 — Coleta (custo: centavos de Apify + CPU do Whisper)

```bash
PYTHONUTF8=1 python "$SKILLS_DIR/ig-competitor-research/scripts/research.py" \
  --file "$SKILLS_DIR/viral-pra-reel/competitors.txt" \
  --dias 30 --top-total 12 \
  --outdir "$RUN_BASE/output"
```
Rodar em BACKGROUND (Whisper demora minutos). Regras:
- `--dias 30` é o default; só mudar se o usuário pedir outra janela.
- Handles passados como argumento na invocação substituem o `--file`.
- Transcrição SEMPRE ligada (nunca `--no-transcribe` aqui: a transcrição é o insumo da curadoria).
- Saída: a última linha imprime `RUN_DIR=<pasta>`; dentro dela, `research_data.json`.

## ETAPA 2 — Curadoria (ler research_data.json e pontuar TODOS os posts)

Ler o JSON assim (nunca `cat` puro, o console Windows quebra os acentos):
```bash
PYTHONUTF8=1 python -c "import json;[print(p.get('handle'),p.get('outlier_score'),p.get('views'),repr((p.get('caption') or '')[:120]),repr((p.get('transcript') or '')[:200]),sep=' | ') for p in json.load(open(r'<RUN_DIR>/research_data.json',encoding='utf-8'))['posts']]"
```
(Se o JSON for uma lista direta em vez de {'posts': [...]}, trocar o final por
`...for p in json.load(open(r'<RUN_DIR>/research_data.json',encoding='utf-8'))]`.) Para CADA
post, preencher
esta ficha (montar uma tabela interna com todos antes de decidir):

| Campo | Regra objetiva |
|---|---|
| Performance | `outlier_score >= 2.0` passa; abaixo disso só entra como "menção bônus" se o fit for >= 9 |
| Fit Eric (0-10) | Nota 7+ passa. +2 se o tema é IA aplicada a negócio/vendas/automação com mecanismo explicável; +2 se serve a empresário NÃO-técnico; -3 se exige o público ser dev; -5 se é fofoca de big tech, meme sem mecanismo ou promessa de dinheiro fácil |
| Atemporalidade | Classificar em exatamente 1 de 3: **ATEMPORAL** (conceito/tutorial/erro comum: passa), **TEMPORAL-ADAPTÁVEL** (gancho é novidade mas o mecanismo é evergreen: passa COM reescrita que remove a âncora de tempo), **TEMPORAL-PURO** (notícia/evento/drama datado: DESCARTA, sem exceção) |
| Repetição | Comparar o TEMA do candidato contra as DUAS fontes do Setup item 5 (registro local + títulos/descrições da Biblioteca). Tema equivalente já produzido = DESCARTAR, a menos que o ângulo seja genuinamente novo (aí entra no checkpoint com o alerta "tema já coberto em <slug>, ângulo novo: <qual>" na descrição). Em dúvida, entra com alerta |
| Transcrição | Vazia (Reel sem fala)? Só passa se a legenda + frame sustentarem a análise; marcar "referência visual" |

Sinais de TEMPORAL no texto: "acabou de", "lançou", "ontem/essa semana/este mês", "a nova
versão", nome de evento com data. Um único sinal já tira o post de ATEMPORAL.

## ETAPA 3 — CHECKPOINT 1 (obrigatório, via AskUserQuestion)

Apresentar os 3-5 melhores como opções, cada uma neste formato exato de descrição:
`@handle, <views> views, outlier <N>x, <M> comentários. "<hook original resumido>". Fit <nota>/10
(<justificativa de 1 linha>). <ATEMPORAL|TEMPORAL-ADAPTÁVEL>. Aproveitar: <tema/ângulo/mecânica>.`
- Marcar o recomendado com "(Recomendado)" e listar alertas (ex.: tema possivelmente repetido).
- Se NENHUM candidato passou nos filtros: NÃO forçar. Reportar o motivo por candidato e oferecer
  `--dias 60` ou trocar handles.
- Só pular este checkpoint se o usuário disser explicitamente "roda automático".

## ETAPA 4 — Briefing de pauta (arquivo `briefing-<slug>.md` no RUN_DIR)

Antes de escrever: VERIFICAR OS FATOS via WebSearch/WebFetch. O claim do concorrente NÃO é
fonte. Achar a ferramenta/repo real, confirmar que existe, stars, se é grátis, como instala.
Se o público for brasileiro e o tema envolver dados de pessoas: reenquadrar pra fontes
públicas/LGPD (nunca prometer e-mail em massa ou "leads ilimitados").

O briefing contém, nesta ordem:
1. Origem (URL, métricas, classificação) — referência, não fonte.
2. Tema e ângulo em palavras próprias.
3. Por que performou (mecânica do hook em 3-4 bullets).
4. Regra dura anti-cópia (colar literalmente): "PROIBIDO traduzir, parafrasear frase a frase ou
   reaproveitar frases do script do concorrente. Extrair só tema, ângulo e mecânica."
5. Diretiva de atemporalidade (colar literalmente): "O roteiro NUNCA ancora no tempo. Proibido:
   lançou ontem/hoje/essa semana, acabou de sair, a nova versão X.Y, referência a evento datado.
   Usar: existe uma ferramenta que..., tem um jeito de fazer isso que..."
6. Fatos verificados com data da verificação + o que NÃO repetir do original.
7. Palavra do CTA sugerida (curta, grafia que o brasileiro digita; lembrar de cadastrar
   variantes no ManyChat).

## ETAPA 5 — Produção (invocar a skill `criar-reel` deste plugin com o briefing como pauta)

Seguir o fluxo do criar-reel do início ao fim (incluindo o gate de orçamento da etapa 2.5 dele,
que NUNCA é pulado). Regras adicionais deste workflow por cima dele:

- **Pré-voo de voz (antes do gate de orçamento):** rodar
  `python "$SKILLS_DIR/criar-reel/scripts/preflight_voz.py" <reel>/cenas.txt --block-seconds 12`
  e reescrever as frases dos blocos reprovados até o pré-voo passar inteiro (o ElevenLabs troca
  o timbre pra certos textos; detalhes na etapa 3a do criar-reel).
- **Roteiro (etapa 2 do criar-reel):** o `cenas.txt` deve somar **900-980 caracteres**
  (medir com `wc -c`). A voz do Eric no ElevenLabs fala ~16 chars/s reais (medido em produção:
  1034 chars viraram 65s); acima de 1000 chars o vídeo passa dos 60s do alvo da estrutura
  viral. Cortar ANTES do gate de orçamento, não depois.
- **Nº de B-rolls:** provisório pro gate = `ceil((total_de_chars_do_cenas.txt / 16) / 5)`
  (a voz fala ~16 chars/s); DEFINITIVO = medir a duração real do avatar com ffprobe depois do
  render e recalcular `ceil(real/5)`.
- **SRT (etapa 4 do criar-reel):** depois do Whisper, revisar e corrigir SEMPRE: o nome da
  ferramenta do vídeo (o ASR erra nome próprio, ex.: "APFY" -> "Apify"), "Cloud/Cláudio" ->
  "Claude", a palavra do CTA em CAIXA ALTA, e erros de junção (ex.: "com texto" -> "contexto").
- **Composição (etapa 7 do criar-reel):** usar o `compose_reel.py` do próprio criar-reel com
  caminhos SEMPRE absolutos. Ele normaliza os B-rolls pra 1080x1920@30 antes do concat; se o
  log NÃO mostrar linhas "normalizando clip-NN...", a versão do plugin está desatualizada:
  atualizar o plugin antes de compor (B-roll de resolução/fps misto trava o vídeo).
- **Thumb e capa da Biblioteca:** texto em português SEMPRE com acentuação correta (GRÁTIS,
  VÍDEO, VOCÊ). Conferir letra a letra com Read; se a IA de imagem errar um acento, regenerar
  pedindo o acento explicitamente no prompt ("note the acute accent on...").
- **Validações antes de entregar:** 1 frame do avatar (fundo verde chapado), 3 frames do final
  (início/meio/fim: legenda amarela acima da cabeça, B-roll casando com a fala), duração via
  ffprobe, e limpar os PNGs de verificação no fim.

## Saídas do run completo
- `<reel>/video-final-<slug>.mp4` + `thumb-*.png` + `legenda-post.md` (com a URL da página da
  Biblioteca preenchida) + `roteiro.md` + `cenas.txt` + SRT corrigido.
- Página do CTA publicada na Biblioteca (a tool devolve a URL; colocar no chat e no legenda-post).
- Lembrar o usuário no resumo final: cadastrar a palavra do CTA (e variantes) no ManyChat.
- **Atualizar o registro (obrigatório, fecha o anti-repetição):** depois de CADA vídeo
  produzido, acrescentar a linha
  `| AAAA-MM-DD | <tema em 5-8 palavras> | <PALAVRA> | <slug da Biblioteca> | @handle/<shortcode> |`
  no arquivo local E na nuvem, via
  `PYTHONUTF8=1 python "$SKILLS_DIR/viral-pra-reel/scripts/registro_reels.py" --add "<linha>"`.
  Se o --add sair com exit 2 (máquina sem acesso de escrita no repo), a linha fica só no local:
  AVISAR no resumo final que o registro remoto ficou pendente.
  A palavra de CTA de um vídeo novo NUNCA repete uma já listada no registro.

## Regras anti-deriva (se alguma instrução conflitar, estas vencem)
1. Views nunca decidem sozinhas: outlier seleciona, fit e atemporalidade cortam.
2. Script de concorrente é referência de estrutura, NUNCA fonte de texto.
3. Roteiro sempre atemporal e sempre na voz do Eric (references/voz-eric.md do criar-reel).
4. Dois pontos de aprovação humana: checkpoint 1 e o gate de orçamento. Nada é gasto antes deles.
5. Claim de concorrente sem verificação NÃO entra no roteiro nem na página do CTA.
6. cenas.txt entre 900 e 980 caracteres, sem exceção sem aprovação do usuário.

## Modo lote (o usuário pediu N vídeos de uma vez, ex.: "me entrega 5")
1. UMA coleta só (etapa 1) serve de base pra todos; selecionar os N melhores candidatos que
   passam nos filtros (checkpoint 1 vira uma lista, ou é pulado se "roda automático").
2. Palavra de CTA DIFERENTE por vídeo (nunca repetir na mesma leva) e B-rolls com o mínimo de
   repetição entre os vídeos (anotar os ids já usados e variar categoria/série).
3. Produzir EM SÉRIE, um vídeo por vez, do início ao fim (nunca dois elevenlabs_heygen ao mesmo
   tempo, e nunca duas produções do MESMO vídeo em paralelo).
4. Informar o custo TOTAL estimado (N x simulação) antes de começar, e o custo real no resumo.
5. No resumo final: tabela com pasta, duração, palavra do CTA e URL da Biblioteca de cada vídeo,
   mais o lembrete das palavras pro ManyChat.

## Edge cases
- Apify timeout: o run-sync tem teto de ~300s; reduzir handles e avisar.
- Transcrição vazia num candidato forte: analisar por legenda + frame, marcar como referência visual.
- Nenhum candidato aprovado: seguir o CICLO DE ESGOTAMENTO, nesta ordem e sem baixar a régua:
  (1) reexecutar com `--dias 60`; (2) se ainda zerar, rodar com os handles de RESERVA
  comentados no competitors.txt desta skill (passar direto como argumento); (3) se ainda
  zerar, reportar ao usuário e pedir handles novos. Coletas repetidas custam centavos;
  candidato fraco custa um vídeo ruim.
- Rodada em lote/agendada: isso é da skill `pauta-semanal`; este workflow produz UM vídeo.
- Saldo/crédito de API acabou no meio: parar, reportar o que foi gasto e o que falta; nunca
  trocar de motor sem avisar.
