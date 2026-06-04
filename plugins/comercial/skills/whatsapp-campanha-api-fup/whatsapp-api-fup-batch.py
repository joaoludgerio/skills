"""
whatsapp-api-fup-batch.py — Engine reutilizavel da skill whatsapp-campanha-api-fup.

Sobrevive a compacts de sessao. Le credenciais SOMENTE do JSON local
(claude-sync nao e versionado em git). Nenhum secret hardcoded.

Uso:
    from importlib.util import spec_from_file_location, module_from_spec
    spec = spec_from_file_location('engine', r'C:/Users/Eric Luciano/OneDrive/Workspace/claude-sync/scripts/whatsapp-api-fup-batch.py')
    eng = module_from_spec(spec); spec.loader.exec_module(eng)

    eng.run_batch(LEADS, dialog_id='...', log_path='C:/tmp/disparo-x/results.jsonl')

Cada lead em LEADS deve ser dict com keys:
    deal_id, person_id, phone (E164 BR sem +), name, miolo

Comportamento:
    F2 + F2.6: 1 chamada com 3 campos (Texto_do_Template, CRM__Link_pessoa, CRM__Link_negocio)
    F2.5: PUT /persons/{id} com campo 'Link do Chat API Oficial'
    F3: dialog_execute com 1 retry em 1s
    F4: atividade WhatsApp (sucesso) ou Tarefa (erro)
    Fallback automatico 12<->13 chars no phone (insere/remove '9' depois do DDD)
    Sem delay entre leads (API oficial nao tem risco de banimento)
"""
import sys, io, json, urllib.request, urllib.parse, urllib.error, time, os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ───────────── CREDENCIAIS — sempre do JSON local, nunca hardcoded ─────────
SYNC = r'C:/Users/Eric Luciano/OneDrive/Workspace/claude-sync'

def _load_creds():
    pd = json.load(open(f'{SYNC}/claude_desktop_config.json', encoding='utf-8'))
    PD_TOKEN = pd['mcpServers']['pipedrive']['env']['PIPEDRIVE_API_KEY']
    # fallback entre os 2 PCs do Eric
    cg_path = None
    for fn in ['claude_desktop_config-ERICLUCIANO-PC.json', 'claude_desktop_config-ERICLUCIANO-PC-2.json']:
        p = f'{SYNC}/{fn}'
        if os.path.exists(p):
            cg_path = p; break
    if not cg_path:
        raise RuntimeError('claude_desktop_config-ERICLUCIANO-PC*.json nao encontrado em ' + SYNC)
    cg = json.load(open(cg_path, encoding='utf-8'))['mcpServers']['chatguru-mcp']['env']
    return {
        'PD_TOKEN':      PD_TOKEN,
        'CG_KEY':        cg['CHATGURU_API_KEY'],
        'CG_ACCT':       cg['CHATGURU_ACCOUNT_ID'],
        'PHONE_OFICIAL': cg['CHATGURU_PHONE_ID_OFICIAL'],
    }

PD_BASE = 'https://expertintegrado.pipedrive.com/api/v1'
CG_BASE = 'https://s13.expertintegrado.app/api/v1'

PERSON_CHAT_FIELD = 'ac0aa8d970799954747791a22a4645ea9159c7e2'  # campo "Link do Chat API Oficial"
EXPERT_USER       = 22805147  # user_id Expert Integrado (conta automacao)
ERRO_LABEL_ID     = 390       # Label "ERRO DE DISPARO" no Pipedrive
LEAD_MAPEADO_STAGE = 64       # Stage "Lead Mapeado" no pipeline Prospeccao (id 7)
TENTANDO_CONTATO_STAGE = 65   # Stage "Tentando contato" — destino padrao em caso de sucesso quando target_stage_on_success=True

# MAPA stages pipeline 7 (Prospeccao) — atencao: NAO confundir stage_id 2 (nao existe) com 65
# 64: Lead Mapeado | 65: Tentando contato | 66: Conexao iniciada/Em qualificacao
# 68: Pre-Qualificado | 116: Qualificado | 79: Reuniao agendada

# ───────────── HTTP HELPERS ────────────────────────────────────────────────
def _cg_call(creds, action, params):
    """Chama API REST do ChatGuru. ATENCAO: parametro de auth e `key`, nao `api_key`."""
    p = dict(params)
    p['action']     = action
    p['key']        = creds['CG_KEY']         # NAO mudar pra api_key — quebra tudo (HTTP 400)
    p['account_id'] = creds['CG_ACCT']
    p['phone_id']   = creds['PHONE_OFICIAL']
    body = urllib.parse.urlencode(p).encode('utf-8')
    req  = urllib.request.Request(CG_BASE, data=body)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        try: parsed = json.loads(body)
        except: parsed = {}
        return {'http_error': e.code, 'body': body[:300], **parsed}

def _pd_req(creds, method, path, payload):
    body = json.dumps(payload).encode('utf-8')
    req  = urllib.request.Request(
        f'{PD_BASE}{path}?api_token={creds["PD_TOKEN"]}',
        data=body, method=method,
        headers={'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {'http_error': e.code, 'body': e.read().decode('utf-8', errors='replace')[:300]}

# ───────────── PHONE FALLBACK ──────────────────────────────────────────────
def _alt_phone(phone):
    """Gera forma alternativa: 13 chars com 9 -> 12 sem 9, e vice-versa.
    Pipedrive guarda como o lead digitou; ChatGuru indexa como o WhatsApp registrou.
    Os dois divergem em alguns DDDs."""
    if len(phone) == 13 and phone.startswith('55') and phone[4] == '9':
        return phone[:4] + phone[5:]
    if len(phone) == 12 and phone.startswith('55'):
        return phone[:4] + '9' + phone[4:]
    return None

def _cg_with_fallback(creds, action, params, phone):
    """Tenta phone original; se 'Chat nao encontrado', tenta a forma alternativa.
    Retorna (response, phone_que_funcionou)."""
    p = dict(params); p['chat_number'] = phone
    r = _cg_call(creds, action, p)
    if r.get('result') == 'success':
        return r, phone
    desc = r.get('description', '') or ''
    body = r.get('body', '') or ''
    if 'Chat n' in desc or 'Chat n' in body:
        alt = _alt_phone(phone)
        if alt:
            p['chat_number'] = alt
            r2 = _cg_call(creds, action, p)
            if r2.get('result') == 'success':
                return r2, alt
            return r2, alt
    return r, phone

# ───────────── DISPATCH POR LEAD ───────────────────────────────────────────
def _is_chat_not_found(r):
    desc = (r.get('description', '') or '') + ' ' + (r.get('body', '') or '')
    desc_lower = desc.lower()
    return ('chat n' in desc_lower) or ('não encontrado' in desc_lower) or ('nao encontrado' in desc_lower)

def _normalize_phone(phone):
    """Remove TODOS os caracteres nao-digitos do telefone.
    Pipedrive guarda como '(47) 99756-5906' as vezes; ChatGuru exige so digitos.
    Sem normalizacao, ChatGuru retorna HTTP 400 BAD REQUEST."""
    import re
    return re.sub(r'[^\d]', '', str(phone or ''))

def disparar(creds, deal_id, person_id, phone, miolo, dialog_id, name=None, target_stage_on_success=None, assign_dialog_id=None):
    """Executa as 5 fases pra 1 lead. Retorna dict com resultado.

    assign_dialog_id (opcional): se passado, apos o template (F3) executa um SEGUNDO
    dialog de atribuicao/roteamento (F3.5) — ex: jogar o lead pro vendedor ou pro time
    comercial e arquivar o chat. Falha na atribuicao NAO marca o lead como erro (o
    disparo principal ja foi); fica registrada em assign_erro no retorno."""
    phone = _normalize_phone(phone)  # remove (), -, espacos antes de qualquer chamada
    erro = None; chat_id = None; phone_used = phone; chat_added = False; assign_erro = None

    # F2 + F2.6: 3 campos numa chamada (com fallback de phone)
    fields = {
        'field__Texto_do_Template': miolo,
        'field__CRM__Link_pessoa':  f'https://expertintegrado.pipedrive.com/person/{person_id}',
        'field__CRM__Link_negocio': f'https://expertintegrado.pipedrive.com/deal/{deal_id}',
    }
    r, phone_used = _cg_with_fallback(creds, 'chat_update_custom_fields', dict(fields), phone)

    # F2.1: se chat nao existe, tenta chat_add e refaz F2
    if r.get('result') != 'success' and _is_chat_not_found(r):
        r_add = _cg_call(creds, 'chat_add', {
            'chat_number': phone,
            'name': name or f'Lead {deal_id}',
            'text': ' ',  # espaco em branco: registra o chat sem disparar mensagem (miolo vai pelo dialog em F3)
        })
        if r_add.get('result') == 'success':
            chat_added = True
            time.sleep(8)  # chat_add e assincrono — aguardar registro
            # refaz F2 com o phone original (ja registrado pelo chat_add)
            r, phone_used = _cg_with_fallback(creds, 'chat_update_custom_fields', dict(fields), phone)
        else:
            erro = f'F2.1 chat_add: {r_add.get("description") or r_add.get("body") or r_add}'

    if not erro:
        if r.get('result') == 'success':
            chat_id = r.get('chat_id')
        else:
            erro = f'F2: {r.get("description") or r.get("body") or r}'

    # F2.5: link do chat na pessoa do Pipedrive
    if chat_id and not erro:
        link = f'https://s13.expertintegrado.app/chats#{chat_id}'
        _pd_req(creds, 'PUT', f'/persons/{person_id}', {PERSON_CHAT_FIELD: link})

    # F3: dialog com 1 retry
    if not erro:
        r3 = _cg_call(creds, 'dialog_execute', {'chat_number': phone_used, 'dialog_id': dialog_id})
        if r3.get('result') != 'success':
            time.sleep(1)
            r3 = _cg_call(creds, 'dialog_execute', {'chat_number': phone_used, 'dialog_id': dialog_id})
            if r3.get('result') != 'success':
                erro = f'F3: {r3.get("dialog_execution_return") or r3.get("description") or r3}'

    # F3.5: dialog de atribuicao/roteamento (opcional). Roda so se o template foi OK.
    # Falha aqui NAO marca o lead como erro — o disparo principal ja aconteceu.
    if not erro and assign_dialog_id:
        ra = _cg_call(creds, 'dialog_execute', {'chat_number': phone_used, 'dialog_id': assign_dialog_id})
        if ra.get('result') != 'success':
            time.sleep(1)
            ra = _cg_call(creds, 'dialog_execute', {'chat_number': phone_used, 'dialog_id': assign_dialog_id})
            if ra.get('result') != 'success':
                assign_erro = ra.get('dialog_execution_return') or ra.get('description') or str(ra)

    # F4: atividade + (em caso de erro) move pra Lead Mapeado e adiciona label ERRO DE DISPARO
    if erro:
        _pd_req(creds, 'POST', '/activities', {
            'subject': 'Erro de disparo', 'type': 'task',
            'deal_id': deal_id, 'user_id': EXPERT_USER, 'done': 0,
            'note': erro,
        })
        # F4.1: move pra Lead Mapeado + adiciona label ERRO DE DISPARO (preserva labels existentes)
        try:
            d = _pd_req(creds, 'GET', f'/deals/{deal_id}', None) if False else None
            # GET via urllib direto pra simplificar (sem body)
            url = f'{PD_BASE}/deals/{deal_id}?api_token={creds["PD_TOKEN"]}'
            with urllib.request.urlopen(url, timeout=15) as r:
                deal_data = json.loads(r.read()).get('data') or {}
            cur_label = deal_data.get('label')
            cur_ids = []
            if isinstance(cur_label, int):
                cur_ids = [cur_label]
            elif isinstance(cur_label, str) and cur_label:
                cur_ids = [int(x) for x in cur_label.split(',') if x.strip().isdigit()]
            elif isinstance(cur_label, list):
                cur_ids = [int(x) for x in cur_label if str(x).isdigit()]
            if ERRO_LABEL_ID not in cur_ids:
                cur_ids.append(ERRO_LABEL_ID)
            _pd_req(creds, 'PUT', f'/deals/{deal_id}', {
                'stage_id': LEAD_MAPEADO_STAGE,
                'label': ','.join(str(x) for x in cur_ids),
            })
        except Exception as _e:
            pass  # nao bloqueia o batch se Pipedrive der hiccup; erro ja foi marcado
    else:
        _pd_req(creds, 'POST', '/activities', {
            'subject': 'Mensagem disparada por API oficial', 'type': 'whatsapp',
            'deal_id': deal_id, 'user_id': EXPERT_USER, 'done': 1,
            'note': miolo,
        })
        # F4.2 (opcional): mover stage no sucesso quando o batch parte de uma etapa anterior
        # (ex: Lead Mapeado). Default None preserva comportamento legado (nao mexe em stage).
        if target_stage_on_success:
            try:
                _pd_req(creds, 'PUT', f'/deals/{deal_id}', {'stage_id': int(target_stage_on_success)})
            except Exception:
                pass  # nao quebra o batch se falhar

    return {'deal_id': deal_id, 'phone': phone, 'phone_used': phone_used,
            'chat_id': chat_id, 'chat_added': chat_added, 'ok': not erro, 'erro': erro,
            'assign_erro': assign_erro}

# ───────────── RUN BATCH ───────────────────────────────────────────────────
def run_batch(leads, dialog_id, log_path=None, verbose=True, target_stage_on_success=None, assign_dialog_id=None):
    """Roda o batch inteiro. Cada lead em `leads` precisa ter:
    deal_id, person_id, phone, name, miolo.

    target_stage_on_success (opcional): se passado, deals com sucesso sao movidos
    pra essa stage_id apos a atividade ser criada. Use TENTANDO_CONTATO_STAGE (65)
    quando o batch partir de Lead Mapeado ou outra etapa anterior. Default None
    preserva comportamento legado (nao mexe em stage no sucesso).

    assign_dialog_id (opcional): dialog de atribuicao/roteamento rodado APOS o template
    em cada lead (F3.5). Use DIALOG_ASSIGN_NIVERTON ou DIALOG_ASSIGN_TIME_VENDAS."""
    creds = _load_creds()
    log_f = None
    if log_path:
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        log_f = open(log_path, 'a', encoding='utf-8')

    results = []
    for i, lead in enumerate(leads, 1):
        if verbose:
            print(f'\n[{i}/{len(leads)}] {lead.get("name","?")} (deal {lead["deal_id"]})')
        r = disparar(creds, lead['deal_id'], lead['person_id'],
                     lead['phone'], lead['miolo'], dialog_id, name=lead.get('name'),
                     target_stage_on_success=target_stage_on_success,
                     assign_dialog_id=assign_dialog_id)
        r['name'] = lead.get('name')
        results.append(r)
        if verbose:
            tag = 'OK' if r['ok'] else 'ERRO'
            extra = '' if r['ok'] else f' — {r["erro"][:120]}'
            if r['ok'] and r.get('assign_erro'): extra = f' (atribuicao falhou: {r["assign_erro"][:60]})'
            print(f'  -> {tag}{extra}')
        if log_f:
            log_f.write(json.dumps(r, ensure_ascii=False) + '\n'); log_f.flush()

    if log_f: log_f.close()

    if verbose:
        ok = sum(1 for r in results if r['ok'])
        print(f'\n=== {ok}/{len(results)} OK ===')
    return results

# ───────────── DIALOGS CONHECIDOS (ChatGuru API Oficial) ───────────────────
# Pegar ID no painel ChatGuru, embaixo do nome do dialog. dialog_id sozinho nao
# da acesso a nada (precisa de CG_KEY+account_id+phone_id, que ficam no JSON local).
DIALOG_TEMPLATE_DISPARO   = '64998eac599de0399b0748d4'  # template gupshup utility_generico_05
DIALOG_ASSIGN_NIVERTON    = '64998eac98d7c95e2f3ef60c'  # atribui lead ao vendedor Niverton
DIALOG_ASSIGN_TIME_VENDAS = '6a1f8e82a8b8359bec3e6c3a'  # atribui ao time de vendas (sem vendedor especifico)

def run_assign_batch(leads, assign_dialog_id, log_path=None, verbose=True):
    """Roda SO o dialog de atribuicao/roteamento (sem template, sem mexer em campos
    nem criar atividade). Use pra rotear leads JA disparados pro vendedor/time comercial
    e arquivar o chat. Cada lead precisa ter: phone (e opcional name/deal_id pra log).
    Faz fallback 12<->13 chars no phone. 1 retry no dialog."""
    creds = _load_creds()
    log_f = None
    if log_path:
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        log_f = open(log_path, 'a', encoding='utf-8')
    results = []
    for i, lead in enumerate(leads, 1):
        phone = _normalize_phone(lead['phone'])
        if verbose:
            print(f'\n[{i}/{len(leads)}] {lead.get("name","?")} ({phone})')
        # resolve a forma do phone que o ChatGuru reconhece (mesma logica do disparo)
        r0, phone_used = _cg_with_fallback(creds, 'dialog_execute',
                                           {'dialog_id': assign_dialog_id}, phone)
        ok = r0.get('result') == 'success'
        if not ok:
            time.sleep(1)
            r0 = _cg_call(creds, 'dialog_execute', {'chat_number': phone_used, 'dialog_id': assign_dialog_id})
            ok = r0.get('result') == 'success'
        erro = None if ok else (r0.get('dialog_execution_return') or r0.get('description') or str(r0))
        res = {'deal_id': lead.get('deal_id'), 'name': lead.get('name'),
               'phone': phone, 'phone_used': phone_used, 'ok': ok, 'erro': erro}
        results.append(res)
        if verbose:
            print(f'  -> {"OK" if ok else "ERRO — " + str(erro)[:100]}')
        if log_f:
            log_f.write(json.dumps(res, ensure_ascii=False) + '\n'); log_f.flush()
    if log_f: log_f.close()
    if verbose:
        n_ok = sum(1 for r in results if r['ok'])
        print(f'\n=== {n_ok}/{len(results)} atribuidos ===')
    return results

if __name__ == '__main__':
    print('Engine carregada. Importe e chame run_batch(leads, dialog_id, log_path).')
    print('Ver docstring no topo do arquivo para o formato de leads.')
