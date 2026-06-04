---
name: notificacao-webinario
description: Orquestra a cadeia de notificacoes de WhatsApp de um webinario-lancamento da Expert (API Oficial ChatGuru). 7 toques (T-12h, T-1h, T0, T+1h pitch, abertura sessao estrategica, FUP D+1 12h, FUP D+2 12h), lendo leads do Pipedrive, filtrando pelo evento atual, segmentando por cargo (decisor vs funcionario) e por pipeline (FUPs so pra quem nao agendou). Agenda os toques via scheduled-tasks relativo ao horario do webinario. TRIGGER quando Eric pedir "notificacao de webinario", "cadeia de disparos do evento", "lembrete do webinario", "avisa a galera do evento", "dispara o lembrete de X", ou montar comunicacao de um lancamento/webinario.
---

# Notificacao de Webinario — cadeia de lancamento via WhatsApp

Orquestra os disparos de WhatsApp (API Oficial ChatGuru) ao longo do ciclo de um webinario-lancamento: do lembrete pre-evento ate o follow-up de conversao pos-evento. Le os leads direto do CRM (Pipedrive), nao de CSV.

> Reaproveita a engine de disparo `whatsapp-api-fup-batch.py` (mesma do plugin comercial) — dialog de template + atribuicao opcional ao time. Credenciais SEMPRE do JSON local, nunca hardcoded.

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
5. **Toques 5/6/7 so pra quem ainda esta no pipeline Prospeccao (7).** Quem agendou migrou pro Educacional (6) e SAI automaticamente do disparo.
6. **Teste so vale fora da janela de 24h.** Dentro da janela (lead respondeu nas ultimas 24h) o WhatsApp manda texto livre (nao template) e engana. `dialog_execute` retornar success NAO garante entrega — conferir no chat.

---

## SEGMENTACAO POR PERFIL (pitch A vs B)

Classificar pelo campo **Cargo** da pessoa (`055b68e8b474363c8c4e125eab49788193109ad0`):

- **DECISOR (pitch A):** cargo contem ceo, socio, diretor, propriet, founder, fundador, presidente, dono, empresar, cfo, coo, cto, cmo, head. Pitch fala do "proximo passo do negocio/empresa".
- **FUNCIONARIO / nao-decisor (pitch B):** o resto (analista, assistente, coordenador, tecnico, estudante, vendas, consultor, **gerente**). Pitch fala de "ser o profissional que domina IA e leva pra dentro da empresa".

Gerente entra em B (nao e dono — pitch A "empresario de verdade" soaria errado).

Personalizacao adicional: empresa quando valida (descartar lixo: ".", "n", "teste", "outros", "autonomo", "estudante", etc.), senao so nome.

---

## TEXTOS-TEMPLATE DOS TOQUES

Placeholders: `{Nome}` (primeiro nome), `{Empresa}` (so se valida), `{ZOOM}`, `{DIAG}`, `{EVENTO}`. Todos LINHA UNICA, sem travessao. O template envelopa com "Ola. " no inicio e " Obrigado." no fim — o miolo e so o meio.

**Toque 1 (T-12h):** `{Nome}, falta pouco pro {EVENTO}! E ao vivo e sem reprise, separa o horario que o conteudo vai direto ao ponto pra sua empresa. Salva o link e te vejo la 👉 {ZOOM}`

**Toque 2 (T-1h):** `{Nome}, comecamos em 1 hora! Deixa tudo pronto pra entrar ao vivo. Link do Zoom aqui 👉 {ZOOM}`

**Toque 3 (T0):** `{Nome}, comecamos agora! Entra que ja vamos abrir, microfone mutado e camera a teu criterio 👉 {ZOOM}`

**Toque 4 (T+1h, pitch):** `{Nome}, chegou a parte mais importante do {EVENTO}, o que vem agora muda como voce opera com IA. Nao sai! Se ainda nao entrou, corre 👉 {ZOOM}`

**Toque 5 (abertura sessao estrategica):** `Tenho um presente pra voce, {Nome}! Liberamos um diagnostico gratuito de IA individual pra sua empresa, 45 minutos com um consultor pra voce sair com um plano pratico. Vagas limitadas, agenda 👉 {DIAG}`

**Toque 6 (FUP 1, D+1 12h):** `{Nome}, nao quero que voce perca: o diagnostico gratuito de IA que liberamos ainda ta de pe, mas as vagas tao acabando. 45 minutos pra sair com um plano pratico pra sua empresa. Garante o seu 👉 {DIAG}`

**Toque 7 (FUP 2, D+2 12h):** `{Nome}, ultima chamada: hoje fechamos as vagas do diagnostico gratuito de IA. Nao deixa passar, sao 45 minutos que podem mudar o rumo da sua empresa 👉 {DIAG}`

> Toques de feriado/escassez tem variante por perfil (A decisor / B funcionario). Ver `scripts/disparar_toque.py` (funcao de miolo por tipo+perfil). Escassez tem que ser REAL (nunca "nao reabre" se reabre — falar "se ocuparem, a proxima janela fica pra mais pra frente").

---

## FILTRO POR EVENTO (CRM)

Cada evento tem uma origem/detalhe propria no Pipedrive. Puxar os deals do evento atual:
- Campo `Origem da Oportunidade` (`0945bdde00c8c57d1c0e52cd360cb76f058dc6e6`)
- Campo `Detalhes da origem da oportunidade` (`c35bea7247f83fcb9cdc24abef1e4e793ae79d7d`) = nome do evento (ex: "O Imposto Invisivel do Empresario")

A skill recebe o nome/detalhe do evento e filtra so esses deals. Toques 5/6/7 cruzam tambem o `pipeline_id == 7` (Prospeccao).

---

## AGENDAMENTO (cron relativo ao horario do webinario)

A skill recebe a data/hora do webinario e calcula cada disparo:
- T-12h, T-1h, T0, T+1h: relativo ao inicio
- Toque 5: no momento do CTA (operador dispara ao vivo, ou agenda ~T+90min)
- FUP 1: D+1 as 12h | FUP 2: D+2 as 12h

Agendar via MCP `scheduled-tasks` (`create_scheduled_task` com `fireAt` ISO 8601 BRT -03:00) — um task por toque. Cada task roda o script `scripts/disparar_toque.py` com o tipo de toque. ATENCAO: scheduled-tasks roda enquanto o Claude Code esta aberto; se fechado, roda no proximo launch. Para horarios criticos (T0, T+1h durante o evento ao vivo), confirmar que a maquina estara ligada, ou disparar manualmente.

---

## EXECUCAO DE UM TOQUE

```python
import sys
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location('eng', r'C:/Users/Eric Luciano/OneDrive/Workspace/claude-sync/scripts/whatsapp-api-fup-batch.py')
eng = module_from_spec(spec); spec.loader.exec_module(eng)
# scripts/disparar_toque.py encapsula: filtra evento -> (toque 5-7: filtra Prospeccao) -> classifica A/B -> monta miolo linha unica -> run_batch(dialog template)
```

O script `scripts/disparar_toque.py` recebe: `--evento "<detalhe>"`, `--toque <1..7>`, `--zoom <url>`, `--diag <url>`. Faz dedup por log proprio do toque.

---

## CHECKLIST DE EXECUCAO

```
[ ] Confirmar nome/detalhe do evento (filtro CRM)
[ ] Confirmar data/hora do webinario + links (Zoom, Diagnostico)
[ ] Validar copy de cada toque com o Eric (linha unica, sem travessao)
[ ] Piloto: 1 disparo no numero do Eric FORA da janela 24h (corporativo) pra validar template
[ ] Agendar os 7 toques via scheduled-tasks (fireAt relativo)
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
6. **scheduled-tasks depende do app aberto** — para toques ao vivo (T0/pitch), garantir maquina ligada ou disparo manual.

Detalhes da arquitetura e cadeia no Brain: nota `g3jjtdbg0ksz`.
