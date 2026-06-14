---
name: notificacao-webinario
description: Orquestra a cadeia de notificacoes de WhatsApp de um webinario-lancamento da Expert (API Oficial ChatGuru). 7 toques (T-12h, T-1h, T0, T+1h pitch, abertura sessao estrategica, FUP D+1 12h, FUP D+2 12h). Publico = export CSV de inscritos (Calendly), cruzado por telefone com os deals do evento no Pipedrive; segmenta por cargo (decisor vs funcionario) e exclui dos FUPs quem ja agendou. Agenda os toques via cron (CronCreate) relativo ao horario do webinario. TRIGGER quando Eric pedir "notificacao de webinario", "cadeia de disparos do evento", "lembrete do webinario", "avisa a galera do evento", "dispara o lembrete de X", ou montar comunicacao de um lancamento/webinario.
---

# Notificacao de Webinario — cadeia de lancamento via WhatsApp

Orquestra os disparos de WhatsApp (API Oficial ChatGuru) ao longo do ciclo de um webinario-lancamento: do lembrete pre-evento ate o follow-up de conversao pos-evento.

**Fonte do publico (2 camadas):** o universo de quem recebe vem do **export CSV de inscritos** (Calendly) — e a fonte de verdade de pertencimento. Esse CSV e cruzado por TELEFONE com os deals do evento no Pipedrive pra (a) descartar leads antigos com origem parecida e (b) ler a etapa/stage de cada um (pra excluir dos FUPs quem ja agendou). NUNCA disparar so pelo filtro de origem do CRM (infla com base velha) nem por lista solta.

> Reaproveita a engine de disparo `whatsapp-api-fup-batch.py` (em `claude-sync/scripts/`, mesma do plugin comercial) — dialog de template ChatGuru + atribuicao opcional ao time. Disparo via **ChatGuru API Oficial** (`s13.expertintegrado.app`, instituicional/corporativo), NUNCA via whatsapp-agent pessoal nem Z-API direto.
>
> **Credenciais:** nunca hardcoded. O script e a engine leem o token do Pipedrive e do ChatGuru do cache local (`claude-sync/claude_desktop_config.json` + `claude_desktop_config-ERICLUCIANO-PC*.json`), que e populado a partir do 1Password (vault "Agentes Eric") via `setup-secrets.ps1`. Fonte de verdade canonica = 1Password; se um token estiver invalido, rotacionar no 1P e rodar `setup-secrets.ps1` pra atualizar o cache — nao editar o JSON na mao.

---

## CADEIA DE 7 TOQUES

| # | Toque | Quando | Link | Publico |
|---|-------|--------|------|---------|
| 1 | Lembrete vespera | T-12h | Zoom | todos do evento |
| 2 | Alerta 1h | T-1h | Zoom | todos do evento |
| 3 | Comecamos agora | T0 (inicio) | Zoom | todos do evento |
| 4 | Pitch / conteudo mais importante | T+1h | Zoom | todos do evento |
| 5 | Abertura da sessao estrategica | momento do CTA do diagnostico | Diagnostico | todos do evento |
| 6 | FUP 1 | D+1 as 12h | Diagnostico | **so quem nao agendou** (Prospeccao) |
| 7 | FUP 2 | D+2 as 12h | Diagnostico | **so quem nao agendou** (Prospeccao) |

**Base de cada toque:** sempre puxar do Pipedrive filtrando pelo evento atual (NUNCA lista solta — evita atingir grupo de evento anterior). Ver secao FILTRO POR EVENTO.

---

## REGRAS INVIOLAVEIS

1. **Miolo SEMPRE em LINHA UNICA.** O template `gupshup utility_generico_05` rejeita quebra de linha (`\n` da erro 132018, `\r\n`/U+2028/`<br>` tambem falham). Usar emoji / pontuacao como separador visual. Detalhe: Brain `rfn7klo8igyj`.
2. **NUNCA usar travessao** (em-dash — ou en-dash –) — tem cara de IA. Trocar por virgula, dois pontos, ponto. Brain `v4624gdruzyy`.
3. **Filtrar pelo evento atual** (campo Origem da Oportunidade + Detalhes da origem = nome do evento). Nunca disparar pra base inteira.
4. **Dedup:** nao duplica lead, mantem o original, nunca regride. Se a pessoa ja tem deal, nao cria outro.
5. **FUPs (toques 6/7) so pra quem NAO agendou.** A exclusao e por stage do deal (`stage_id in {54, 60, 79}`), nao por pipeline. Quem agendou (migrou pra etapa de agendamento, tipicamente saindo de Prospeccao 7 pro Educacional 6) SAI automaticamente do FUP. Toques 1-5 vao pra todos os inscritos.
6. **Teste so vale fora da janela de 24h.** Dentro da janela (lead respondeu nas ultimas 24h) o WhatsApp manda texto livre (nao template) e engana. `dialog_execute` retornar success NAO garante entrega — conferir no chat.

---

## SEGMENTACAO POR PERFIL (pitch A vs B)

Classificar pelo campo **Cargo** (vem do CSV de inscricao; no Pipedrive e `055b68e8b474363c8c4e125eab49788193109ad0`):

- **DECISOR (pitch A):** cargo contem ceo, socio, diretor, propriet, founder, fundador, presidente, dono, empresar, cfo, coo, cto, cmo, head. Pitch fala do "proximo passo do negocio/empresa".
- **FUNCIONARIO / nao-decisor (pitch B):** o resto (analista, assistente, coordenador, tecnico, estudante, vendas, consultor, **gerente**). Pitch fala de "ser o profissional que domina IA e leva pra dentro da empresa".

Gerente entra em B (nao e dono — pitch A "empresario de verdade" soaria errado).

> **ESTADO ATUAL DO SCRIPT:** `disparar_toque.py` JA classifica decisor vs funcionario (funcao `eh_decisor`) e mostra a contagem A/B no preview, mas ainda NAO envia copy diferente por perfil — todos recebem o mesmo miolo do toque (com a personalizacao de nome/empresa). A copy A/B diferenciada e a direcao desejada; ate implementar a variacao no `miolo()`, validar a copy unica com o Eric ciente de que ela serve os dois perfis. Nao prometer ao Eric A/B ativo sem antes implementar.

Personalizacao adicional: empresa quando valida (descartar lixo: ".", "n", "teste", "outros", "autonomo", "estudante", etc.), senao so nome. So o toque 5 usa a empresa no texto hoje.

---

## TEXTOS-TEMPLATE DOS TOQUES

Placeholders: `{Nome}` (primeiro nome), `{Empresa}` (so se valida), `{ZOOM}`, `{DIAG}`, `{EVENTO}`. Todos LINHA UNICA, sem travessao. O template envelopa com "Ola. " no inicio e " Obrigado." no fim — o miolo e so o meio.

**Toque 1 (T-12h):** `{Nome}, falta pouco pro {EVENTO}! É ao vivo e sem reprise, separa o horário que o conteúdo vai direto ao ponto pra sua empresa. Salva o link e te vejo lá 👉 {ZOOM}`

**Toque 2 (T-1h):** `{Nome}, começamos em 1 hora! Deixa tudo pronto pra entrar ao vivo. Link do Zoom aqui 👉 {ZOOM}`

**Toque 3 (T0):** `{Nome}, começamos agora! Entra que já vamos abrir, microfone mutado e câmera a teu critério 👉 {ZOOM}`

**Toque 4 (T+1h, pitch):** `{Nome}, chegou a parte mais importante do {EVENTO}, o que vem agora muda como você opera com IA. Não sai! Se ainda não entrou, corre 👉 {ZOOM}`

**Toque 5 (abertura sessao estrategica):** `Tenho um presente pra você, {Nome}! Liberamos um diagnóstico gratuito de IA individual pra sua empresa, 45 minutos com um consultor pra você sair com um plano prático. Vagas limitadas, agenda 👉 {DIAG}`

**Toque 6 (FUP 1, D+1 12h):** `{Nome}, não quero que você perca: o diagnóstico gratuito de IA que liberamos ainda tá de pé, mas as vagas tão acabando. 45 minutos pra sair com um plano prático pra sua empresa. Garante o seu 👉 {DIAG}`

**Toque 7 (FUP 2, D+2 12h):** `{Nome}, última chamada: hoje fechamos as vagas do diagnóstico gratuito de IA. Não deixa passar, são 45 minutos que podem mudar o rumo da sua empresa 👉 {DIAG}`

> Variantes por perfil (A decisor / B funcionario) e a evolucao desejada da copy, mas o `miolo()` em `scripts/disparar_toque.py` ainda envia texto unico por toque (ver ESTADO ATUAL na secao SEGMENTACAO). Quando implementar escassez/variantes: escassez tem que ser REAL (nunca "nao reabre" se reabre — falar "se ocuparem, a proxima janela fica pra mais pra frente").

---

## FILTRO POR EVENTO (CRM)

Cada evento tem uma origem/detalhe propria no Pipedrive. Puxar os deals do evento atual:
- Campo `Origem da Oportunidade` (`0945bdde00c8c57d1c0e52cd360cb76f058dc6e6`)
- Campo `Detalhes da origem da oportunidade` (`c35bea7247f83fcb9cdc24abef1e4e793ae79d7d`) = nome do evento (ex: "O Imposto Invisivel do Empresario")

A skill recebe o nome/detalhe do evento e filtra so esses deals (pipeline-agnostic). Os FUPs (toques 6/7) excluem quem ja agendou pelo **stage do deal**, nao pelo pipeline: o script `disparar_toque.py` remove `stage_id in {54 Apresentacao Agendada, 60 Realizada, 79 Reuniao agendada}`. Efeito pratico: quem migrou pra etapa de agendamento (independente do pipeline) sai do FUP.

---

## AGENDAMENTO (cron relativo ao horario do webinario)

A skill recebe a data/hora do webinario e calcula o horario de cada disparo:
- T-12h, T-1h, T0, T+1h: relativo ao inicio
- Toque 5: no momento do CTA (operador dispara ao vivo, ou agenda ~T+90min)
- FUP 1: D+1 as 12h | FUP 2: D+2 as 12h

Agendar via ferramenta **`CronCreate`** (1 chamada por toque). O cron e de 5 campos `M H DoM Mon DoW` em **horario LOCAL = BRT (America/Sao_Paulo)** — NAO converter pra UTC, NAO usar sufixo Z nem `fireAt` ISO. Cada toque e disparo unico, entao usar `recurring: false` (pina minuto/hora/dia/mes do horario calculado; o cron dispara uma vez e se auto-deleta). Cada job deve carregar o prompt que roda `scripts/disparar_toque.py` com o `--toque` correspondente.

Exemplo (toque 6 = FUP 1, agendado pra 14/06 as 12h BRT):
- `cron: "0 12 14 6 *"`, `recurring: false`, prompt = "Rodar o toque 6 da notificacao-webinario do evento <X> em PREVIEW e me mostrar a copy/lista pra aprovar."

LIMITACOES do cron (avisar o Eric):
- **Roda so com o Claude Code aberto e a sessao idle.** Jobs sao por sessao (somem ao fechar) a menos que `durable: true`. Para toques ao vivo criticos (T0, T+1h durante o evento), confirmar que a maquina estara ligada com a sessao aberta, ou disparar manualmente.
- Como o modo padrao e SEMI (preview + aprovacao), o prompt do cron deve rodar em PREVIEW e pedir aprovacao; nao agendar disparo cego com `--confirmar`, exceto se o Eric autorizar explicitamente um toque pra rodar sozinho.

---

## EXECUCAO DE UM TOQUE — MODO SEMI (padrao)

O modo de operacao definido com o Eric (04/06/2026) e **SEMI**: a skill monta o toque, mostra a copy + a lista de quem vai receber, e SO dispara apos aprovacao explicita (`--confirmar`). Sem `--confirmar`, roda em PREVIEW (nao dispara nada).

O script `scripts/disparar_toque.py` implementa a logica de 2 camadas:

```bash
# 1) PREVIEW (nao dispara) — mostra copy + contagem + exemplos:
python -X utf8 disparar_toque.py \
    --inscritos "C:/caminho/invitees-export.csv" \
    --evento "O Imposto Invisivel do Empresario" \
    --toque 6 \
    --zoom "https://us02web.zoom.us/j/..." \
    --diag "https://expertintegrado.com.br/diagnostico"

# 2) Eric revisa a copy/lista. Se aprovar, MESMO comando + --confirmar:
python -X utf8 disparar_toque.py ... --confirmar
```

Parametros:
- `--inscritos` (OBRIGATORIO): CSV export de inscritos do Calendly. E a **fonte de verdade do publico** (camada 1).
- `--evento`: texto do Detalhe da origem no Pipedrive (pra achar os deals).
- `--toque` 1..7. `--zoom` / `--diag`: links. `--delay` (default 8s, anti-throttle). `--confirmar`: dispara de verdade.

**Camada 1 (pertencimento):** cruza os telefones do CSV de inscritos com os deals de origem do evento. So inscritos reais entram; leads antigos com origem parecida sao descartados.

**Camada 2 (etapa):** toques 6/7 (FUP) excluem quem ja agendou (stage 54 Apresentacao Agendada / 60 Realizada / 79 Reuniao agendada). Toques 1-5 vao pra todos os inscritos.

Personalizacao: cargo/empresa vem do CSV de inscricao; segmenta decisor (pitch A) vs funcionario (pitch B). Dedup por log proprio do toque.

> Agendamento dos horarios (T-12h etc.) via `CronCreate` (ver secao AGENDAMENTO), chamando este script em PREVIEW; o Eric aprova e roda com --confirmar. Para toques ao vivo (T0/pitch), disparo sob comando.

---

## CHECKLIST DE EXECUCAO

```
[ ] Confirmar nome/detalhe do evento (filtro CRM)
[ ] Confirmar data/hora do webinario + links (Zoom, Diagnostico)
[ ] Validar copy de cada toque com o Eric (linha unica, sem travessao)
[ ] Piloto: 1 disparo no numero do Eric FORA da janela 24h (corporativo) pra validar template
[ ] Agendar os 7 toques via CronCreate (cron 5 campos em BRT, recurring:false)
[ ] Toques 5/6/7: confirmar filtro pipeline Prospeccao
[ ] Apos cada toque: reportar OK / erros / pulados (ja agendaram)
```

---

## ARMADILHAS

1. **Template rejeita \n** — linha unica sempre. Erro 132018 nao aparece no dialog_execute (retorna success), so na entrega. Brain `rfn7klo8igyj`.
2. **Cooldown de 5min por chat** no dialog_execute. Entre toques no mesmo numero, respeitar. A engine ja faz retry de cooldown.
3. **Janela de 24h mascara teste** — testar so fora da janela.
4. **Travessao tem cara de IA** — nunca usar. Brain `v4624gdruzyy`.
5. **Multi-evento:** sempre filtrar pelo detalhe do evento atual; nunca a base inteira (senao atinge grupo de evento anterior).
6. **cron (CronCreate) depende do Claude Code aberto e idle** — jobs somem ao fechar a sessao (a menos que `durable: true`). Para toques ao vivo (T0/pitch), garantir maquina ligada com sessao aberta, ou disparo manual.

Detalhes da arquitetura e cadeia no Brain: nota `g3jjtdbg0ksz`.
