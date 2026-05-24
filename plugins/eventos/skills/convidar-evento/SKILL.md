---
name: convidar-evento
description: Disparar convites via WhatsApp para eventos do Eric (Expert Integrado). Fluxo de 4 mensagens (saudação velho/novo, data+link, PDF, explicação) + atualização de status no MCP expert-integrado de pendente_envio para convite_enviado. TRIGGER quando Eric pedir para enviar convites, disparar convites do evento, mandar PDFs do convite, ou entregar uma pasta/lista de PDFs de convite.
---

# Convidar para Evento — Expert Integrado

Skill para disparar convites via WhatsApp para eventos do Eric, puxando dados do MCP expert-integrado e atualizando status após envio.

---

## CONTEXTO

- Eventos ficam no MCP `expert-integrado` (tabela participantes)
- Convidados do Eric têm `convidado_por = "Eric Luciano"`
- Status inicial: `pendente_envio` → após disparo: `convite_enviado`
- Eric manda uma pasta com PDFs personalizados (ex: `Alan_Marques.pdf`, `Camila_Andrejus.pdf`)
- Match PDF ↔ participante é pelo nome do arquivo (normalizar underscores → espaços)

## CLASSIFICAÇÃO VELHO vs NOVO

Perguntar ao Eric qual evento é o "anterior" de referência (ex: Evento 1). Um convidado é:
- **VELHO**: já foi convidado pro evento anterior (aparecia na lista dele)
- **NOVO**: primeira vez que recebe convite do Eric

Eric geralmente informa na hora qual grupo é velho e qual é novo. Se não falar, perguntar.

## FLUXO DE 4 MENSAGENS (3s de intervalo entre cada)

**Mensagem 1 — Saudação (varia por velho/novo):**

VELHO (já foi CONVIDADO pra 1ª edição mas não pôde ir):
```
Fala [PrimeiroNome], beleza?

Mês passado te chamei pra minha imersão e a data não bateu. Quero te fazer o convite de novo. A 1ª edição foi um sucesso, o feedback da galera foi muito legal, então decidimos fazer mais uma.
```
IMPORTANTE: "velho" NÃO significa que a pessoa esteve no 1º evento — significa que foi convidada mas não pôde ir. Nunca escrever "como você esteve", "você participou" ou similar.
REGRA: NUNCA usar travessão longo (—) nas copies. Tem cara de IA. Usar ponto final ou quebra de linha.

NOVO:
```
Fala [PrimeiroNome], beleza?

Quero te convidar pra minha imersão de IA. Dia 05/05/2026, em São Paulo. Um dia inteiro sobre IA aplicada a processos comerciais.
```

**Mensagem 2 — Data + link:**
```
Vai ser dia 05/05/2026, aqui em São Paulo.

Detalhes e confirmação: https://imersao.ericluciano.com.br
```

**Mensagem 3 — PDF (arquivo sozinho, sem legenda)**

**Mensagem 4 — Explicação:**
```
O convite em PDF é personalizado com seu nome e tem um botão pra confirmar presença direto por lá.

Bora?
```
Nota: em 2026-04-23, versão "É cortesia individual, não transferível" foi removida. Eric reforçou que o texto original menciona o BOTÃO de confirmação no PDF, que é o ponto da msg.

## PROTOCOLO DE EXECUÇÃO

### Passo 0: Coletar parâmetros
- **evento_id** do MCP expert-integrado
- **Pasta com PDFs** (ex: `/tmp/convites/pdfs/`)
- **Quem é velho / quem é novo** (Eric informa ou pede pra classificar)

### Passo 1: Listar participantes
```
mcp__expert-integrado__list_participantes(evento_id=..., origem="Eric Luciano")
```
Se retornar vazio, tentar sem filtro e filtrar manualmente por `convidado_por = "Eric Luciano"`.

### Passo 2: Match PDF ↔ participante
Para cada PDF na pasta:
1. Nome do arquivo sem extensão, underscores → espaços (ex: `Alan_Marques.pdf` → `Alan Marques`)
2. Buscar participante cujo `nome` bata (busca case-insensitive, primeiro e último nome)
3. Se não achar: alertar Eric e pular

### Passo 3: Upload do PDF pra URL pública
WhatsApp agent precisa de `media_url` público. Hosts testados:
- **tmpfiles.org** → FUNCIONA
- 0x0.st → bloqueado (AI botnet spam)
- catbox.moe → "Invalid uploader"

```bash
curl -F "file=@/path/to/file.pdf" https://tmpfiles.org/api/v1/upload
# retorna URL, converter de "tmpfiles.org/XXX/file.pdf" pra "tmpfiles.org/dl/XXX/file.pdf"
```

### Passo 3.5: CHECAGEM OBRIGATÓRIA de última mensagem

**ANTES de disparar pra cada pessoa**, rodar `mcp__whatsapp-agent__read(phone=telefone, limit=15)` e verificar a última mensagem:

**IMPORTANTE:** usar limit=15 (não 3). Com limit baixo, whatsapp-agent pode pular mensagens recentes e só retornar as mais antigas — já aconteceu de dar falso positivo (Cleber em 2026-04-23).

- **Última mensagem foi DO CLIENTE e está não lida/não respondida** → PARAR, reportar ao Eric e PERGUNTAR o que fazer (pode ser que precise responder a pergunta dele antes de mandar o convite)
- **Última mensagem foi do Eric/equipe, OU conversa já foi respondida** → pode disparar o convite normalmente

**Why:** Não faz sentido mandar convite automatizado pra alguém que acabou de te escrever — fica robótico e ignora o contexto dela. O Eric quer tratar caso a caso essas conversas ativas.

**ATENÇÃO LIDs:** Eric às vezes responde leads num chat LID separado (formato `XXXXXXXX@lid`) que não aparece no read por número. Sintoma: leitura por número mostra apenas msgs antigas + Eric afirma ter respondido. Ação: rodar `mcp__whatsapp-agent__inbox(since=<últimas 2h>)` ou `search(query=<palavra-chave da conversa>)` pra achar o LID, então `read(chat=<LID@lid>, limit=15)`. Já aconteceu com Henrique Scaramussa (22458769879126@lid), Cesar Barboza (83627341791456@lid), Luiz Closer (78533510574149@lid), Nicolas Tonetto (12434047811609@lid), Matheus Medeiros (180719439593480@lid).

### Passo 4: Disparo (4 mensagens com sleep 3s)

**IMPORTANTE:** O `whatsapp-agent__send` com type=document NÃO aceita fileName, chega como "Sem nome". Pra PDFs personalizados, usar `zapi_action(action="send-document/pdf")` com fileName.

```python
send(to=telefone, text=msg1)
sleep(3)
send(to=telefone, text=msg2)
sleep(3)
# PDF com nome correto:
zapi_action(
  action="send-document/pdf",
  params={
    "phone": telefone,
    "document": pdf_url,
    "fileName": "Convite - [Nome].pdf"
  }
)
sleep(3)
send(to=telefone, text=msg4)
```

### Passo 5: Atualizar status no MCP
```
mcp__expert-integrado__update_status_convite(
  participante_id=...,
  novo_status="convite_enviado"
)
```
Valores válidos: pendente_envio, convite_enviado, em_avaliacao, aceitou_convite, confirmado, recusou.
NÃO usar `update_participante` — ele não aceita o campo status.

### Passo 5.5: Registrar atividade no Pipedrive (NA HORA DO ENVIO)

Pra cada convite enviado com sucesso, criar atividade **concluída** no Pipedrive registrando o disparo. Isso vale como histórico imediato auditável e cobre os silenciosos (que não respondem nunca).

```
mcp__pipedrive__search_persons(term=<últimos 8 dígitos do telefone>)
# se não achar:
mcp__pipedrive__create_person(
  name=<nome>,
  phone=<telefone>,
  owner_id="Eric Luciano",
  custom_fields='{"Origem do Contato": "INDIC | Direta do Eric"}'
)

mcp__pipedrive__create_activity(
  subject="Convite enviado, imersão, <DD.MM.AAAA>",
  type="whatsapp",
  due_date="<YYYY-MM-DD do envio>",
  person_id=<id>,
  user_id="Eric Luciano",
  note="Contexto: <de onde veio a indicação, quem trouxe, lead frio etc>",
  force=true  # se já tem atividade pendente do tipo
)

mcp__pipedrive__update_activity(activity_id=<id>, done=true)
```

**Por que marcar concluída na hora do envio:**
- Captura silenciosos (que nunca respondem)
- Auditável imediatamente
- Resposta do lead vira nota/atividade futura na skill `verificar-convites`, não nesta

**Quando NÃO criar atividade aqui:** se o convite foi disparado por outro convidador (ex: Vanderson, Ricardo Junior, Niverton), Eric não é dono do touchpoint. Manter atividade só para `convidado_por = "Eric Luciano"`.

### Passo 6: Resumo final
Tabela com: Nome | Velho/Novo | Status envio | Status MCP | Pipedrive (act_id)

---

## LIMITAÇÃO TÉCNICA — números sem chat prévio

O `whatsapp-agent__send` só envia pra números com chat existente. Pra números novos (sem conversa prévia), retorna "Nenhum chat encontrado".

**Workaround:** usar `zapi_action(action="send-text")` para a 1ª mensagem (isso inicia o chat). Dali em diante o `send` normal funciona.

**REGRA CRÍTICA:** A primeira mensagem JAMAIS pode ser "teste" ou conteúdo genérico — o destinatário é pessoa real. A primeira mensagem TEM que ser a saudação real do fluxo (Mensagem 1 do convite). Nunca fazer "ping" de teste em lead/cliente.

## REGRAS IMPORTANTES

1. **SEMPRE confirmar com Eric antes de disparar** — mostrar lista de quem vai receber e perguntar "confirmo o disparo?"
2. **Nunca mandar PDF com legenda** — PDF é mensagem separada
3. **3s entre mensagens** — evitar bloqueio anti-spam
4. **Acentuação correta** em todas as mensagens (à, ã, é, ç)
5. **Primeiro nome apenas** na saudação (não nome completo)
6. **Se falhar em alguém** — logar e continuar, reportar no resumo final
7. **Atualizar status SÓ se as 4 mensagens foram enviadas com sucesso**
8. **update_participante não aceita convidado_por** — se precisar trocar esse campo, fazer delete + add
9. **Normalizar telefone** antes de enviar (só dígitos, começando com 55)
