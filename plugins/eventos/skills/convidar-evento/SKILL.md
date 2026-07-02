---
name: convidar-evento
description: Use quando o Eric quiser disparar convites via WhatsApp para um evento/imersão da Expert Integrado. TRIGGER quando Eric pedir para enviar convites, disparar os convites do evento, mandar convites da imersão, convidar a galera pra imersão. NÃO usar para lembretes de webinário (skill notificacao-webinario) nem para checar respostas de convites já enviados (skill verificar-convites).
---

# Convidar para Evento — Expert Integrado

Skill para disparar convites via WhatsApp para eventos do Eric, puxando dados do MCP expert-integrado e atualizando status após envio.

---

## CONTEXTO

- Eventos ficam no MCP `expert-integrado` (tabela participantes)
- Convidados do Eric têm `convidado_por = "Eric Luciano"`
- Status inicial: `pendente_envio` → após disparo: `convite_enviado`
- **Edições com mais de uma data (ex: jul/2026, turmas 28 e 29):** cada dia é um EVENTO separado no MCP. O convidado escolhe o dia; o PDF personalizado só é gerado e enviado DEPOIS da escolha, a partir do evento do dia escolhido.
- PDFs personalizados são gerados pelo próprio MCP (`gerar_convite_pdf` / `gerar_convites_pdf_lote`) e retornam URL pública — não é mais necessário Eric mandar pasta de PDFs nem subir em host externo. (Fallback legado: pasta de PDFs + upload em tmpfiles.org, ver seção no fim.)

## SEGMENTAÇÃO (substitui a antiga classificação VELHO vs NOVO)

Classificar cada participante pelo HISTÓRICO nas edições anteriores (buscar por telefone e nome nos eventos passados do MCP):

| Segmento | Critério | Copy |
|---|---|---|
| **RECUSOU** | Foi convidado pra edição anterior e recusou UMA vez | Copy A |
| **FALTOU** | Confirmou presença numa edição anterior e não compareceu (`status_presenca = ausente`) | Copy B |
| **NOVO** | Primeira vez que recebe convite (aula, indicação, network) | Copy C |
| **COMPROU** | `origem = compra_online` (pagou ingresso) | NÃO convidar — já está dentro. Convite de cortesia pra quem pagou quebra a percepção de valor. |

### Regras de elegibilidade (decisão do Eric, 01/07/2026)
- **Recusou 2 edições diferentes → NÃO convidar mais.** Só reconvida quem recusou 1 vez.
- **Bases de convidadores desligados/vetados (ex: Vanderson Souza, Ricardo Junior) → NÃO convidar.**
- **Clientes Super SDR → NÃO convidar** (origem `cliente_supersdr` / "Cliente Super SDR" em qualquer edição).
- Em edição nova, confirmar com o Eric se a lista de vetos mudou.

## FLUXO DE 3 MENSAGENS (3s de intervalo entre cada)

> Datas, mês da recusa, cidade e link abaixo são da edição de JULHO/2026. Em edição futura, substituir pelos dados reais (confirmar com o Eric antes de disparar).
> REGRA: NUNCA usar travessão longo (—) nas copies. Tem cara de IA. Usar ponto final, vírgula ou quebra de linha.
> Em mensagem de convite formatada, usar "você" por extenso (padrão do corpus real do Eric nesse contexto).

**Copy A — RECUSOU (recusou 1x a edição anterior):**
```
Msg 1:
Fala [PrimeiroNome], beleza?

Em [maio] te chamei pra minha imersão e a data não bateu. Quero te fazer o convite de novo. As duas primeiras edições foram um sucesso, o feedback da galera foi muito legal, então decidimos fazer mais duas.
```
Substituir `[maio]` pelo mês em que a pessoa foi convidada (quem recusou só a de abril recebe "Em abril"). IMPORTANTE: "recusou" NÃO significa que a pessoa esteve no evento. Nunca escrever "como você esteve", "você participou" ou similar.

**Copy B — FALTOU (confirmou e não foi):**
```
Msg 1:
Fala [PrimeiroNome], beleza?

Em maio você tinha confirmado presença na minha imersão. Agora em julho vou rodar mais duas edições e quero muito te ver nessa.
```
NÃO reforçar o fato negativo ("você não apareceu", "não deu pra ir") — o Eric real não esfrega falta na cara de ninguém; reconhece o combinado anterior e segue direto pro convite novo.

**Copy C — NOVO (primeira vez):**
```
Msg 1:
Fala [PrimeiroNome], beleza?

[GANCHO DE ORIGEM — OBRIGATÓRIO. Ex: "O [Fulano] me passou teu contato." / "Vi seu nome cadastrado na aula de IA que eu fiz no [G4/evento]."]

Quero te convidar pra minha imersão de IA. Um dia inteiro sobre IA aplicada ao operacional do negócio, cada um sai com agente rodando. Já fiz duas edições, as duas lotaram.
```
O gancho de origem é invariante no corpus real do Eric: TODO convite pra contato novo abre citando de onde a pessoa veio (quem indicou ou em qual aula se cadastrou). Sem gancho, não dispara — perguntar ao Eric a origem.

**Msg 2 — Datas + link (igual pros 3 segmentos):**
```
Agora vão ser duas turmas: 28 ou 29 de julho, aqui em São Paulo, das 8h às 19h. Você escolhe o dia que encaixa melhor na agenda.

Detalhes e confirmação: https://imersao.ericluciano.com.br
```

**Msg 3 — Pergunta de escolha (alternative close, igual pros 3):**
```
Qual dos dois dias fica melhor pra você? Te mando o convite personalizado do dia escolhido.
```
Uma pergunta só, fácil de responder num toque. Não adicionar outras perguntas na mesma mensagem.

## PÓS-ESCOLHA (quando a pessoa responde "28" ou "29")

1. Se escolheu o dia que NÃO é o evento onde está cadastrada: mover = `add_participante` no evento do dia escolhido (copiando dados + `convidado_por`) e `delete_participante` no evento antigo.
2. Gerar o PDF do dia certo: `mcp__expert-integrado__gerar_convite_pdf(participante_id=...)` → retorna URL pública.
3. Disparar (3s entre mensagens):
```
Msg A: Te coloquei na turma do dia [28/29].

Msg B: [PDF: send com type="document", media_url=<url do gerar_convite_pdf>, file_name="Convite - [Nome].pdf", SEM legenda]

Msg C: O convite em PDF é personalizado com seu nome e tem um botão pra confirmar presença direto por lá.

Bora?
```
Ordem fixa: confirmação da turma → documento → texto do botão. Nunca inverter, nunca concatenar.
4. `update_status_convite(participante_id, novo_status="aceitou_convite")`.
5. Pipedrive: atividade "Reunião Geral - Imersão" pro dia do evento (ver skill verificar-convites, Passo 5.5).

## FOLLOW-UP 48h (sem resposta à pergunta do dia)

Template no padrão real do Eric de fechar lista (baixa pressão, sempre com saída):
```
Fala [PrimeiroNome], beleza? Tô fechando a lista das turmas de julho. 28 ou 29, qual fica melhor pra você? Se não rolar dessa vez, tranquilo, só me avisa que passo a vaga pra frente. Bora?
```

## PROTOCOLO DE EXECUÇÃO

### Passo 0: Coletar parâmetros
- **evento_id de cada dia** no MCP expert-integrado (jul/2026: dia 28 = `2621e765-994c-480f-962a-0715dae6fbe3`)
- Confirmar com o Eric o lote do dia (quantos e quais segmentos)

### Passo 1: Listar participantes
```
mcp__expert-integrado__list_participantes(evento_id=..., status="pendente_envio")
```
Filtrar por `convidado_por = "Eric Luciano"` quando o disparo for do Eric.

### Passo 2: Segmentar
Classificar cada um em RECUSOU / FALTOU / NOVO / COMPROU cruzando com os eventos anteriores (telefone e nome). Aplicar as regras de elegibilidade. Em dúvida, perguntar ao Eric.

### Passo 3.5: CHECAGEM OBRIGATÓRIA de última mensagem

**ANTES de disparar pra cada pessoa**, rodar `mcp__whatsapp-agent__read(chat=telefone, limit=15)` e verificar a última mensagem:

**IMPORTANTE:** usar limit=15 (não 3). Com limit baixo, whatsapp-agent pode pular mensagens recentes e só retornar as mais antigas — já deu falso positivo (Cleber, 2026-04-23).

- **Última mensagem foi DO CLIENTE e está não lida/não respondida** → PARAR, reportar ao Eric e PERGUNTAR o que fazer (pode ser que precise responder a pergunta dele antes de mandar o convite)
- **Última mensagem foi do Eric/equipe, OU conversa já foi respondida** → pode disparar o convite normalmente

**Why:** Não faz sentido mandar convite automatizado pra alguém que acabou de te escrever — fica robótico e ignora o contexto. O Eric trata caso a caso essas conversas ativas.

**Reforço do próprio MCP:** o `send` tem gate nativo (`force_send_after_inbound`, default false) que bloqueia envio se a pessoa mandou algo nos últimos 10 min sem resposta. É rede de segurança extra, NÃO substitui a checagem manual acima. Se o `send` bloquear por isso, é conversa ativa: PARAR e perguntar ao Eric. Só usar `force_send_after_inbound=true` depois que o Eric mandar enviar mesmo assim.

**ATENÇÃO LIDs:** Eric às vezes responde leads num chat LID separado (formato `XXXXXXXX@lid`) que não aparece no read por número. Sintoma: leitura por número mostra apenas msgs antigas + Eric afirma ter respondido. Ação: rodar `mcp__whatsapp-agent__inbox(since=<últimas 2h>)` ou `search(query=<palavra-chave>)` pra achar o LID, então `read(chat=<LID@lid>, limit=15)`. Casos conhecidos: Henrique Scaramussa (22458769879126@lid), Cesar Barboza (83627341791456@lid), Luiz Closer (78533510574149@lid), Nicolas Tonetto (12434047811609@lid), Matheus Medeiros (180719439593480@lid).

### Passo 4: Disparo (3 mensagens com sleep 3s)

Tudo pelo MCP `whatsapp-agent` (instância PESSOAL do Eric).

**Parâmetros do `send` (conferir nomes exatos):**
- texto vai em `content` (NÃO `text`)
- `confirmed=true` é OBRIGATÓRIO pra realmente enviar. Só passar `true` depois que o Eric confirmou o disparo na Regra 1.

```
mcp__whatsapp-agent__send(to=telefone, content=msg1, confirmed=true)
sleep(3)
mcp__whatsapp-agent__send(to=telefone, content=msg2, confirmed=true)
sleep(3)
mcp__whatsapp-agent__send(to=telefone, content=msg3, confirmed=true)
```

O PDF NÃO vai neste disparo — vai no PÓS-ESCOLHA, quando a pessoa responder o dia.

### Passo 5: Atualizar status no MCP
```
mcp__expert-integrado__update_status_convite(
  participante_id=...,
  novo_status="convite_enviado"
)
```
Valores válidos: pendente_envio, convite_enviado, em_avaliacao, aceitou_convite, confirmado, recusou.
NÃO usar `update_participante` pra status — ele não aceita o campo.

### Passo 5.5: Registrar atividade no Pipedrive (NA HORA DO ENVIO)

Pra cada convite enviado com sucesso, criar atividade **concluída** no Pipedrive registrando o disparo. Vale como histórico auditável e cobre os silenciosos.

```
mcp__pipedrive__search_persons(term=<últimos 8 dígitos do telefone>)
# se não achar (contato novo):
mcp__pipedrive__create_person(
  name=<nome>,
  phone=<telefone>,        # formato 55XXXXXXXXXXX, só dígitos
  owner_id="Eric Luciano",
  custom_fields='{"Origem do Contato": "INDIC | Direta do Eric", "Pessoa que indicou": "Eric Luciano"}'
)
# NUNCA sobrescrever "Origem do Contato" de pessoa que já existe (regra CLAUDE.md: 1x na vida).

# Atividade já CONCLUÍDA numa chamada só (done=true cria retroativo):
mcp__pipedrive__create_activity(
  subject="Convite enviado, imersão, <DD.MM.AAAA>",
  type="whatsapp",
  due_date="<YYYY-MM-DD do envio>",   # sem due_time. NUNCA passar "" ou "00:00"
  person_id=<id>,
  user_id="Eric Luciano",
  note="Contexto: <segmento, de onde veio, quem trouxe>",
  done=true
)
```

**Quando NÃO criar atividade aqui:** se o convite foi disparado por outro convidador. Manter atividade só para `convidado_por = "Eric Luciano"`.

### Passo 6: Resumo final
Tabela com: Nome | Segmento | Status envio | Status MCP | Pipedrive (act_id)

---

## LIMITAÇÃO TÉCNICA — números sem chat prévio

Por padrão o `whatsapp-agent__send` só envia pra números com chat existente. Pra números novos, retorna "Nenhum chat encontrado".

**Caminho oficial:** passar `allow_new=true` no `send` da 1ª mensagem (cria a entrada do chat). Dali em diante o `send` normal funciona.

```
mcp__whatsapp-agent__send(to=telefone, content=msg1, allow_new=true, confirmed=true)
```

**REGRA CRÍTICA:** A primeira mensagem JAMAIS pode ser "teste" ou conteúdo genérico. A primeira mensagem TEM que ser a Msg 1 real do segmento. Nunca fazer "ping" de teste em lead/cliente.

## FALLBACK LEGADO — pasta de PDFs + tmpfiles.org

Só usar se `gerar_convite_pdf` do MCP falhar. Eric manda pasta com PDFs (`Alan_Marques.pdf` → "Alan Marques", match case-insensitive) e o upload vai pra host público:
- **tmpfiles.org** → FUNCIONA (`curl -F "file=@arquivo.pdf" https://tmpfiles.org/api/v1/upload`, converter URL pra `/dl/`). Atenção: link expira em ~60 min, gerar na hora do envio.
- 0x0.st e catbox.moe → bloqueados.

## REGRAS IMPORTANTES

1. **SEMPRE confirmar com Eric antes de disparar** — mostrar lista de quem vai receber e perguntar "confirmo o disparo?"
2. **Nunca mandar PDF com legenda** — PDF é mensagem separada (no PÓS-ESCOLHA)
3. **3s entre mensagens** — evitar bloqueio anti-spam
4. **Acentuação correta** em todas as mensagens (à, ã, é, ç)
5. **Primeiro nome apenas** na saudação
6. **Se falhar em alguém** — logar e continuar, reportar no resumo final
7. **Atualizar status SÓ se as 3 mensagens foram enviadas com sucesso**
8. **update_participante não aceita convidado_por** — preferir `convidado_por_user_id` (resolver com `list_vendedores`); pra trocar convidador de registro antigo, delete + add
9. **Normalizar telefone** antes de enviar (só dígitos, começando com 55)
10. **`status_presenca = "confirmado"` é DEFAULT de cadastro**, não significa que a pessoa confirmou — confirmação real é `status` do convite (aceitou_convite/confirmado)
