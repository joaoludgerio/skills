---
name: whatsapp-campanha-central-prospeccao
description: Executa campanha de prospeccao em massa via aparelho da Central de Atendimento do ChatGuru (NAO API oficial). Para cada lead: reatribui ao SDR responsavel, conclui atividade vencida do evento, dispara mensagem em multipart (3 partes com delay humano via send_date), executa dialogo do bot da SDR, cria atividade WhatsApp concluida e Call de follow-up no Pipedrive, preenche CRM__Link_pessoa e CRM__Link_negocio no chat e adiciona anotacao com link do deal. Usa chip de numero convencional — exige delay entre leads (anti-banimento). TRIGGER quando usuario pedir "campanha de prospeccao", "disparar campanha pela Central", "rodar massa de leads", "campanha de ativacao", "ativar leads do webinar/aula/evento" pelo aparelho da Central, ou quando fornecer lista de deal_ids para processar com WhatsApp multipart + atividades + dialog. Para follow-up via API Oficial usar whatsapp-campanha-api-fup.
---

# Campanha Central de Prospeccao — Pipedrive + ChatGuru (chip Central)

Skill para campanhas onde o disparo sai pelo aparelho da **Central de Atendimento** do ChatGuru (chip de numero convencional, NAO API oficial). Usar quando precisa de:
- Mensagem multipart com tom humano (3 partes espacadas no tempo)
- Reatribuicao do deal pra SDR especifico
- Atividades comerciais completas no Pipedrive (registro + follow-up Call)
- Dialogo do bot da SDR ativado pos-disparo

> **Seguranca:** todas as credenciais (PD_TOKEN, CG_KEY, CG_ACCT, CG_PHONE) ficam APENAS no JSON local de config (`claude-sync/claude_desktop_config*.json`) — nunca hardcoded nesta skill nem em scripts versionados. A skill esta no GitHub publico (`expertintegrado/skills`); secret nunca pode aparecer aqui.

A diferenca pra `whatsapp-campanha-api-fup`: aparelho diferente (chip vs API oficial), mensagem em multipart (vs template unico), exige delay entre leads (anti-banimento), faz fallback 12<->13 chars (Central armazena formato variavel por DDD), reatribui SDR (vs Expert Integrado fixo), cria 2 atividades por lead (registro WhatsApp + Call follow-up).

---

## CONSTANTES DA OPERACAO

| Item | Valor |
|------|-------|
| Phone ID Central (ChatGuru) | ler de `CHATGURU_PHONE_ID` no JSON local (NAO o oficial) |
| User ID — Expert Integrado (automacao) | `22805147` |
| User ID — Niverton Menezes | `23506911` |
| User ID — Kesia Nandi | `23969736` |
| User ID — Eric Luciano | `17987703` |
| Pipeline ID — Prospeccao | `7` |
| Atividade registro — subject | `Mensagem de ativação` |
| Atividade registro — type | `whatsapp` (done=1, dono = Expert Integrado) |
| Atividade follow-up — type | `call` (dono = SDR) |
| Em caso de erro — stage destino | `Lead Mapeado` (id 64, pipeline Prospeccao) |
| Em caso de erro — label adicional | `ERRO DE DISPARO` (id 390, preserva labels existentes) |
| Sleep default entre leads | `30s` (anti-banimento) |
| Offset msg 2 / msg 3 | `+1min` / `+2min` apos chat_add |
| Endpoints | `https://expertintegrado.pipedrive.com/api/v1` + `https://s13.expertintegrado.app/api/v1` |

**Dialog IDs por SDR** — NAO sao constantes. Pedir ao usuario a cada campanha (cada SDR pode ter dialog proprio configurado pra contexto).

---

## DECISOES COM O USUARIO ANTES DE EXECUTAR

1. **Lista de leads** — filtro Pipedrive (campo personalizado), CSV/xlsx exportado, ou deal_ids hardcoded
2. **Distribuicao** — quem fica com quantos. Pode ser 1 SDR pega tudo, split entre N, ou regra customizada (por DDD, por porte, etc.)
3. **Mensagem template (3 partes)** — abertura/check-in, pitch personalizado, CTA. Variaveis tipicas: nome, empresa (com fallback "sua operação")
4. **dialog_id por SDR** — cada SDR usa um dialog proprio do bot
5. **Atividade Call follow-up** — titulo, data, horario (BRT), duracao
6. **Excluir algum lead?** — testes, internos da equipe, leads com numero invalido conhecido
7. **Conclui vencida?** — se a campanha eh follow-up de evento (webinar, calendly), informar substring do subject pra identificar e concluir (ex: "Imposto Invisível"). Se nao houver, deixar vazio.
8. **Piloto** — sempre rodar 1-2 leads (preferencialmente 1 com empresa preenchida e 1 sem) antes do batch. Mais robusto: testar primeiro no numero pessoal do usuario.

---

## PRE-FLIGHT — DEDUPLICACAO OBRIGATORIA

A engine ja faz isso automaticamente: le `results.jsonl` e remove deals com `ok=true`. Mesmo assim conferir:

```python
import json, os
log_path = r'C:/tmp/disparo-<nome>/results.jsonl'
if os.path.exists(log_path):
    done = {json.loads(l)['deal_id'] for l in open(log_path, encoding='utf-8') if json.loads(l).get('ok')}
    print(f"Ja feitos: {len(done)}")
```

Se houver pilotos manuais (executados antes da engine), incluir os deal_ids num set hardcoded e mesclar.

---

## FLUXO POR LEAD (engine `process_lead`)

A engine executa em ordem:

1. **GET deal** -> person_id, phone, name, company. Aplica `_clean_first_name` no nome (filtra emails, titulos profissionais, bot greetings tipo "Opa"/"Hola"/"Quero Automatizar" — fallback `amigo(a)`)
2. **GET activities pendentes** -> identifica vencida (subject contem `vencida_subject_match`) e marca done
3. **PUT deal** user_id = SDR (reatribuir)
4. **chat_add ChatGuru** (msg 1 + nome; com fallback de phone 12<->13 — `chat_add_with_fallback`. SEM `dialog_id` aqui — disparamos separado)
5. **Sleep 5s** (registro async ChatGuru)
6. **dialog_execute** (com fallback 12<->13 chars no phone)
7. **message_send msg 2** com `send_date = +1min` (BRT, formato YYYY-MM-DD HH:MM)
8. **message_send msg 3** com `send_date = +2min`
9. **POST atividade WhatsApp concluida** — SO se chat_add deu certo (evita atividade-fantasma: dono Expert Integrado, due_date hoje, due_time = 09:25 BRT retroativo, note = msg 1+2+3 concatenadas, done=1)
10. **POST atividade Call follow-up** — SO se chat_add deu certo (dono SDR, data/hora configuravel)
11. **chat_update_custom_fields** preenchendo `CRM__Link_pessoa` + `CRM__Link_negocio` (so se chat_add ok)
12. **note_add** com link do deal (so se chat_add ok)
13. **Sleep 30s** antes do proximo lead

Cada falha em step individual nao para o batch — vira entrada em `errs` e o lead segue. Re-rodar a engine depois pula leads com `ok=true`.

**Por que essa ordem:** chat_add eh a primeira chamada critica do disparo. Se falhar (numero invalido, sem WhatsApp), as atividades Pipedrive NAO sao criadas — antes ficavam fantasma marcadas como "Mensagem enviada" mesmo sem disparo real. Agora se chat_add falha, o lead vai pro log com `errs=["chat_add: ..."]` e fica disponivel pra correcao manual + retry.

---

## ENGINE DE DISPARO — usar o script reutilizavel

Toda a logica vive em UM unico arquivo, fora do repo da skill, sobrevive a compacts:

```
C:/Users/Eric Luciano/OneDrive/Workspace/claude-sync/scripts/whatsapp-central-prospeccao-batch.py
```

**NAO reescrever esse engine inline numa nova sessao** — importar e usar. O codigo ja trata: parametro `key` (nao `api_key`), fallback 12<->13 chars, conversao BRT->UTC pra atividades Pipedrive REST, dedup via `results.jsonl`, log incremental, retry automatico em chamadas de rede.

> **Duas copias do engine — uma so e canonica.** A copia ao lado deste SKILL.md (`whatsapp-central-prospeccao-batch.py` na pasta da skill) e apenas um espelho versionado pra distribuicao via marketplace/leitura. A copia **canonica de runtime** e a do `claude-sync/scripts/` (caminho importado acima) — e dela que o `eng.run_batch` roda. Ao corrigir logica, editar a canonica em `claude-sync/scripts/` e DEPOIS sincronizar o espelho da skill (copiar por cima) pra nao divergir. Nunca importar a copia da pasta da skill em runtime.

### Como invocar (em qualquer sessao, mesmo apos compact):

```python
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location('eng',
    r'C:/Users/Eric Luciano/OneDrive/Workspace/claude-sync/scripts/whatsapp-central-prospeccao-batch.py')
eng = module_from_spec(spec); spec.loader.exec_module(eng)

LEADS = [
    {'deal_id': 10458, 'sdr': 'Niverton'},
    {'deal_id': 10516, 'sdr': 'Kesia'},
    # ...
]

config = {
    'msg_1_func': lambda nome, sdr: (
        f"Oi {nome}, aqui é {'o' if sdr=='Niverton' else 'a'} {sdr} da Expert Integrado.\n\n"
        f"E aí, conseguiu participar da aula ontem? Os feedbacks foram muito bons "
        f"e o Eric mostrou umas coisas muito legais — espero que você tenha assistido."
    ),
    'msg_2_func': lambda empresa: (
        f"Não sei se você viu, mas a gente abriu a possibilidade de agendar um diagnóstico "
        f"gratuito pra entender como {('a ' + empresa) if empresa else 'sua operação'} "
        f"está em uso de IA e criar um mapa de como você pode implementar IA no seu negócio.\n\n"
        f"O diagnóstico é totalmente gratuito e percebi que você ainda não agendou o seu."
    ),
    'msg_3_func': lambda: (
        "Lembrando que tem uma condição especial pra quem agendar ainda esta semana: "
        "ingresso cortesia da Imersão de IA.\n\nVamos agendar?"
    ),
    'sdr_ids':     {'Niverton': 23506911, 'Kesia': 23969736},
    'sdr_dialogs': {'Niverton': '<dialog_id_niverton>', 'Kesia': '<dialog_id_kesia>'},
    'expert_id':   22805147,
    'wa_subject':  'Mensagem de ativação',
    'wa_due_time_brt':  '09:25',
    'call_subject':     'Ligar - Follow-up Webinar Imposto Invisível',
    'call_due_date':    '2026-04-29',
    'call_due_time_brt':'11:30',
    'call_duration':    '00:30',
    'vencida_subject_match': 'Imposto Invisível',  # vazio = nao buscar vencida
    'sleep_between_leads': 30,
    'msg2_offset_min': 1,
    'msg3_offset_min': 2,
    'post_chat_add_sleep': 5,
}

results = eng.run_batch(LEADS, config, log_path=r'C:/tmp/disparo-<nome>/results.jsonl')
```

`results` e uma lista de dicts: `{deal_id, sdr, name, phone, person_id, company, ok, errs, wa_activity_id, call_activity_id, chat_add_id, msg2_id, msg3_id, vencida_id, phone_used, ...}`.

### Dry-run

```python
eng.run_batch(LEADS, config, log_path='...', dry_run=True)
```
Imprime o que faria sem chamar APIs.

### Se PRECISAR adaptar logica nova
- Editar `scripts/whatsapp-central-prospeccao-batch.py` — nao bifurcar inline no script ad-hoc.
- Single source of truth: tudo que muda na execucao da campanha vive nesse arquivo.

---

## ARMADILHAS CONHECIDAS

1. **Numero do ChatGuru — formato 12 vs 13 chars** — depende do DDD/regiao. Central armazena com 9 prefix (13 chars) pra alguns numeros e sem (12 chars) pra outros. **A engine ja faz fallback automatico** em `dialog_execute`, `message_send`, `chat_update_custom_fields`, `note_add`. Tenta primeiro o que veio do Pipedrive (apos `normalize_br`), fallback no oposto.

2. **`mcp__pipedrive__create_activity` bloqueado** por hook "Callback hook blocking error" no Claude Code. Restart nao resolve. **A engine usa REST direta** (`POST /v1/activities` via `urllib.request`).

3. **Pipedrive due_time UTC vs BRT** — REST direta exige UTC. **A engine converte BRT->UTC** automaticamente (`brt_to_utc_hhmm`). Passar horarios sempre em BRT no config.

4. **Encoding curl/Bash Windows** — cp1252 quebra acentos em `--data-urlencode`. **A engine usa `urllib.parse.urlencode` em Python** (UTF-8 nativo).

5. **Print Python crashar com emoji/setas no Windows** — `→` (U+2192) e o pior. **A engine ja faz `sys.stdout.reconfigure(encoding="utf-8", errors="replace")`** no topo. Em scripts ad-hoc rodar com `python -X utf8`.

6. **`chat_add` e assincrono** — leva 1-30s pra completar. `message_send` agendado pode chegar ANTES de msg 1 se houver fila lenta. Mitigacao na engine: sleep 5s + `dialog_execute` separado (que tambem aguarda registro). Se observar muitos casos de ordem invertida, aumentar `post_chat_add_sleep` no config.

7. **`chat_add` com `dialog_id` nao executa o dialog se chat ja existe** (apenas atualiza contato). **A engine NAO passa `dialog_id` no chat_add** — chama `dialog_execute` separado pra garantir.

8. **`dialog_execute` primeira chamada pode falhar** com erro `Diálogo não foi executado pois o contexto não foi validado`. A engine tenta com phone original, se falhar tenta variante. Se ainda falhar, registra em `errs` mas segue.

9. **PARAMETRO E `key`, NAO `api_key`** na API REST do ChatGuru. Confirmado em sessao com modelo que reescreveu sem consultar a skill — todas as chamadas voltam HTTP 400 com `key ou account_id não informado(s)`. **A engine ja usa `key`** corretamente.

10. **Numero invalido no Pipedrive** — alguns leads tem phones bagunçados (sem DDI 55, prefixos invalidos como `90347`, digitos a mais). API ChatGuru retorna 400 "Chat nao existe". A engine registra em `errs` e segue. **chat_add ja faz fallback 12<->13 chars** (via `chat_add_with_fallback`) antes de marcar erro — se o phone original veio 12 chars, tenta com 9; se veio 13, tenta sem. Quando chat_add falha mesmo apos fallback, alem de logar o erro a engine: (a) cria task "Erro de disparo" (dono Expert Integrado, done=0), (b) move o deal pra stage `Lead Mapeado` (id 64), (c) adiciona label `ERRO DE DISPARO` (id 390) preservando labels existentes. Sai do funil ativo, fica facil de filtrar/triagem manual.

11. **Nome do contato mal preenchido no Pipedrive** — alguns leads tem como nome um email (`fulano@dominio.com`), titulo profissional (`Psicóloga Fátima Cruz`), bot greeting (`Opa`, `Hola 👋`, `Quero Automatizar Funis`) ou nome de empresa (`Mister Massas`). A funcao `_clean_first_name` filtra esses casos: extrai segundo nome quando o primeiro eh titulo (Psicóloga -> Fátima), descarta emails com digitos, e cai em `amigo(a)` quando nao consegue extrair nome decente. Resultado: a saudacao "Oi {first_name}" nunca fica esquisita ("Oi Psicóloga,", "Oi Adrianocs16,").

12. **Atividade Call atrasada** — se a hora `call_due_time_brt` ja passou no momento do disparo, atividade aparece como ATRASADA no Pipedrive. Decisao com usuario: aceitar (sinaliza urgencia) ou reagendar pra horario futuro. Se reagendar em batch:
    ```python
    for r in results:
        if r.get('call_activity_id'):
            eng.pd_put(creds, f"/activities/{r['call_activity_id']}", {"due_time": "14:30"})  # UTC
    ```

13. **chat_add_id != chat_id real** — `chat_add` retorna um `chat_add_id` (hash interno do registro async). O link real do chat eh outro hash diferente. NAO usar chat_add_id pra preencher "Link do Chat" na pessoa. Pra capturar o chat_id real, usar `chatguru_get_chat_link` (Playwright web scrape) — requer sessao ativa via `node login.js`. A engine **nao preenche** "Link do Chat" automaticamente — deixar pra processo posterior se necessario.

---

## CREDENCIAIS — sempre do JSON local, nunca hardcoded

```python
import json
SYNC = r'C:/Users/Eric Luciano/OneDrive/Workspace/claude-sync'
PD_TOKEN = json.load(open(f'{SYNC}/claude_desktop_config.json', encoding='utf-8'))\
    ['mcpServers']['pipedrive']['env']['PIPEDRIVE_API_KEY']
cg = json.load(open(f'{SYNC}/claude_desktop_config-ERICLUCIANO-PC.json', encoding='utf-8'))\
    ['mcpServers']['chatguru-mcp']['env']
CG_KEY   = cg['CHATGURU_API_KEY']
CG_ACCT  = cg['CHATGURU_ACCOUNT_ID']
CG_PHONE = cg['CHATGURU_PHONE_ID']   # Central (NAO o oficial)
```

**Regras de seguranca:**
- Nenhum desses 4 valores pode aparecer em arquivo versionado (skill, script, README, log de exemplo).
- A engine ja le tudo do JSON local — nao reimplementar inline.
- Se um secret vazar pra esta skill ou pro repo `expertintegrado/skills`, ROTACIONAR no 1Password (vault "Agentes Eric") + painel ChatGuru/Pipedrive antes de qualquer outra coisa.

> **Fonte canonica dos secrets (atual):** o 1Password Business (vault "Agentes Eric", via `op read "op://Agentes Eric/<TOKEN>/credential"`) e a fonte de verdade; o `setup-secrets.ps1` propaga o cache local. Os arquivos `claude_desktop_config*.json` acima sao o cache legado que esta engine ainda le diretamente — funciona, mas esta divergindo do canon. Migrar a leitura da engine pra `op CLI` (ou pro cache `~/.claude.json`) e tarefa pendente no script compartilhado (fora desta skill). Ate la, garantir que esses JSON locais existam e estejam atualizados antes de rodar.

---

## CHECKLIST DE EXECUCAO

```
[ ] Confirmar lista de leads (origem + filtros + exclusoes)
[ ] Confirmar distribuicao SDR (e dialog_id de cada um)
[ ] Validar mensagem template (3 partes) com usuario
[ ] Confirmar atividade Call (titulo, data, horario BRT, duracao)
[ ] Confirmar `vencida_subject_match` (ou vazio se nao houver)
[ ] Rodar PILOTO com 1-2 leads (preferir numero pessoal do usuario primeiro)
[ ] Validar com usuario:
    [ ] Encoding correto (acentos legíveis)
    [ ] Ordem das mensagens (msg 1 antes da 2 antes da 3)
    [ ] Diálogo da SDR executou
    [ ] Atividades criadas certinhas (WhatsApp concluida + Call agendada)
    [ ] Reatribuicao SDR foi pro dono certo
[ ] Rodar batch principal em background (eng.run_batch)
[ ] Monitorar progresso periodicamente (tail run.log)
[ ] Reconciliar pendentes:
    [ ] Numeros invalidos -> pedir Eric corrigir Pipedrive, depois re-rodar (dedup pula ok=true)
    [ ] Falhas residuais em msg_2/msg_3 -> rodar retry com phone alternativo (ja na engine)
[ ] Reagendar Calls se hora passou (opcional)
[ ] Reportar ao usuario: total OK, total WARN, pendentes
```

---

## HISTORICO DE CAMPANHAS

| Data | Campanha | Leads | OK | Pendentes | Notas |
|------|----------|-------|----|-----------|-------|
| 2026-04-29 | Webinar "O Imposto Invisível do Empresário" (28/04) | 57 | 55 | 2 (numeros invalidos: Cristóvão 10524, Inês 10534) | Primeira execucao da skill — script ad-hoc em `C:/tmp/disparo-imposto/`. Engine criada apos campanha. |
