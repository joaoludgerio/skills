# -*- coding: utf-8 -*-
"""
ENGINE REUSAVEL — Campanha Central de Prospeccao via aparelho da Central do ChatGuru.

Single source of truth para a logica de disparo. Nao reescrever inline em scripts ad-hoc:
importar e chamar `run_batch(...)`.

Difere da API Oficial (`whatsapp-api-fup-batch.py`):
- Usa aparelho da Central (CHATGURU_PHONE_ID padrao, NAO o oficial)
- Mensagem em multipart (msg 1 imediata via chat_add + msg 2/3 agendadas com send_date)
- Requer delay entre leads (default 30s) — anti-banimento de chip
- Faz fallback 12<->13 chars no telefone (Central armazena formato variavel por DDD)
- Cria 2 atividades no Pipedrive (WhatsApp concluida como registro + Call agendada)
- Reatribui SDR (nao fica no Expert Integrado)
- Conclui atividade vencida do evento (se houver)

USO:
    import sys
    from importlib.util import spec_from_file_location, module_from_spec
    spec = spec_from_file_location('eng',
        r'C:/Users/Eric Luciano/OneDrive/Workspace/claude-sync/scripts/whatsapp-central-prospeccao-batch.py')
    eng = module_from_spec(spec); spec.loader.exec_module(eng)

    LEADS = [
        {'deal_id': 10458, 'sdr': 'Niverton'},
        {'deal_id': 10516, 'sdr': 'Kesia'},
        ...
    ]

    config = {
        'msg_1_func': lambda nome, sdr: f"Oi {nome}, aqui é {'o' if sdr=='Niverton' else 'a'} {sdr}...",
        'msg_2_func': lambda empresa: f"Não sei se você viu, mas a gente abriu...",
        'msg_3_func': lambda: "Lembrando que tem uma condição especial...",
        'sdr_ids':    {'Niverton': 23506911, 'Kesia': 23969736},
        'sdr_dialogs':{'Niverton': '<dialog_id>', 'Kesia': '<dialog_id>'},
        'expert_id':  22805147,
        'wa_subject': 'Mensagem de ativação',
        'wa_due_time_brt':  '09:25',  # registro retroativo
        'call_subject':     'Ligar - Follow-up Webinar',
        'call_due_date':    '2026-04-29',
        'call_due_time_brt':'11:30',
        'call_duration':    '00:30',
        'vencida_subject_match': 'Imposto Invisível',  # se vazio, nao busca vencida
        'sleep_between_leads': 30,
        'msg2_offset_min': 1,
        'msg3_offset_min': 2,
    }

    results = eng.run_batch(LEADS, config, log_path=r'C:/tmp/disparo-<nome>/results.jsonl')
"""

import json, re, time, datetime, sys, urllib.request, urllib.parse, urllib.error
from pathlib import Path
from zoneinfo import ZoneInfo

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# ---------- CREDENCIAIS (JSON local; nunca hardcoded) ----------
SYNC = r"C:/Users/Eric Luciano/OneDrive/Workspace/claude-sync"

def _load_creds():
    pd_cfg = json.load(open(f"{SYNC}/claude_desktop_config.json", encoding="utf-8"))
    PD_TOKEN = pd_cfg["mcpServers"]["pipedrive"]["env"]["PIPEDRIVE_API_KEY"]
    cg_cfg_path = f"{SYNC}/claude_desktop_config-ERICLUCIANO-PC.json"
    cg = json.load(open(cg_cfg_path, encoding="utf-8"))["mcpServers"]["chatguru-mcp"]["env"]
    return {
        "PD_TOKEN": PD_TOKEN,
        "CG_KEY":   cg["CHATGURU_API_KEY"],
        "CG_ACCT":  cg["CHATGURU_ACCOUNT_ID"],
        "CG_PHONE": cg["CHATGURU_PHONE_ID"],   # Central (NAO o oficial)
    }

PD_BASE = "https://expertintegrado.pipedrive.com/api/v1"
CG_BASE = "https://s13.expertintegrado.app/api/v1"
BRT     = ZoneInfo("America/Sao_Paulo")

ERRO_LABEL_ID      = 390  # Label "ERRO DE DISPARO" no Pipedrive
LEAD_MAPEADO_STAGE = 64   # Stage "Lead Mapeado" no pipeline Prospeccao (id 7)

# ---------- HTTP helpers ----------
def _http_json(method, url, body=None, headers=None, timeout=20, retries=3):
    headers = headers or {}
    data = None
    if body is not None:
        if isinstance(body, dict):
            data = json.dumps(body).encode("utf-8")
            headers.setdefault("Content-Type", "application/json")
        elif isinstance(body, str):
            data = body.encode("utf-8")
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=data, method=method, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            try:
                return json.loads(e.read().decode("utf-8"))
            except Exception:
                return {"_http_error": e.code, "_body": str(e)}
        except Exception as e:
            if attempt == retries - 1:
                return {"_err": f"network: {e}"}
            time.sleep(2 ** attempt)

# ---------- PIPEDRIVE ----------
def pd_get(creds, path, params=None):
    qs = {"api_token": creds["PD_TOKEN"]}
    if params: qs.update(params)
    url = f"{PD_BASE}{path}?{urllib.parse.urlencode(qs)}"
    return _http_json("GET", url)

def pd_put(creds, path, body):
    url = f"{PD_BASE}{path}?api_token={creds['PD_TOKEN']}"
    return _http_json("PUT", url, body)

def pd_post(creds, path, body):
    url = f"{PD_BASE}{path}?api_token={creds['PD_TOKEN']}"
    return _http_json("POST", url, body)

# ---------- CHATGURU ----------
def cg_call(creds, action, params):
    """Chama acao da API REST do ChatGuru (Central). PARAMETRO E `key`, NAO `api_key`."""
    qs = urllib.parse.urlencode({
        "key":        creds["CG_KEY"],
        "account_id": creds["CG_ACCT"],
        "phone_id":   creds["CG_PHONE"],
        "action":     action,
    })
    body = urllib.parse.urlencode(params).encode("utf-8")
    return _http_json(
        "POST", f"{CG_BASE}?{qs}", body,
        headers={"Content-Type": "application/x-www-form-urlencoded; charset=utf-8"},
    )

# ---------- PHONE NORMALIZATION ----------
def normalize_br(phone):
    """Normaliza phone BR: remove o '9' prefix em numero 13 chars '55XX9XXXXXXXX' -> 12 chars."""
    p = re.sub(r"\D", "", phone or "")
    if len(p) == 13 and p.startswith("55") and p[4] == "9":
        return p[:4] + p[5:]
    return p

def with_9(p12):
    """Insere o '9' apos DDD (12 chars 55XXNNNNNNNN -> 13 chars 55XX9NNNNNNNN)."""
    if len(p12) == 12 and p12.startswith("55"):
        return p12[:4] + "9" + p12[4:]
    return p12

def cg_call_phone_fallback(creds, action, phone, params_extra):
    """Tenta com phone como veio; se erro 'Chat nao existe', tenta variante 13 chars."""
    r = cg_call(creds, action, {"chat_number": phone, **params_extra})
    if r.get("result") == "success":
        return r, phone
    p_alt = with_9(phone) if len(phone) == 12 else None
    if p_alt and p_alt != phone:
        r2 = cg_call(creds, action, {"chat_number": p_alt, **params_extra})
        if r2.get("result") == "success":
            return r2, p_alt
    return r, phone

def _alt_phone_br(p):
    """Retorna alternativa BR (12<->13 chars) ou None se nao aplicavel.
    12 chars '55XX...' -> 13 chars com 9 apos DDD.
    13 chars '55XX9...' -> 12 chars sem o 9.
    """
    p = re.sub(r"\D", "", p or "")
    if len(p) == 12 and p.startswith("55"):
        return p[:4] + "9" + p[4:]
    if len(p) == 13 and p.startswith("55") and p[4] == "9":
        return p[:4] + p[5:]
    return None

def chat_add_with_fallback(creds, phone, name, text):
    """chat_add tentando phone original e, se falhar, alternativa 12<->13.
    Retorna (response, phone_used). Sucesso = `chat_add_id` presente."""
    r = cg_call(creds, "chat_add", {"chat_number": phone, "name": name, "text": text})
    if r.get("chat_add_id"):
        return r, phone
    p_alt = _alt_phone_br(phone)
    if p_alt and p_alt != phone:
        r2 = cg_call(creds, "chat_add", {"chat_number": p_alt, "name": name, "text": text})
        if r2.get("chat_add_id"):
            return r2, p_alt
        return r2, p_alt
    return r, phone

# ---------- NOME DO CONTATO ----------
_SKIP_FIRST_NAMES = {"opa", "eu", "hola", "ola", "oi", "olá", "olá,",
                     "funis", "quero", "agendar", "tenho", "preciso"}
_SKIP_TITLE_PREFIXES = {"psicóloga", "psicologa", "psicólogo", "psicologo",
                        "dr", "dra", "doutor", "doutora", "doutorando",
                        "mister", "sr", "sra", "senhor", "senhora",
                        "engenheiro", "engenheira", "professor", "professora",
                        "pastor", "pastora", "advogado", "advogada"}

def _clean_first_name(full_name, fallback="amigo(a)"):
    """Extrai primeiro nome usavel. Filtra:
    - Email armazenado como nome (Adrianocs16@hotmail.com -> fallback se tiver digito)
    - Bot greetings ("Opa", "Oi", "Olá") -> tenta segunda palavra
    - Titulos profissionais ("Psicóloga Fátima Cruz" -> "Fátima")
    Retorna o primeiro nome capitalizado ou `fallback`.
    """
    if not full_name:
        return fallback
    t = full_name.strip()
    # Email-as-name
    if "@" in t and " " not in t:
        prefix = t.split("@")[0]
        candidate = prefix.split(".")[0]
        if any(c.isdigit() for c in candidate) or len(candidate) < 2:
            return fallback
        return candidate.capitalize()
    parts = t.split()
    if not parts:
        return fallback

    def _normalize(token):
        token = token.strip("|,").strip()
        return "".join(c for c in token if c.isalpha() or c in "-'")

    fn = _normalize(parts[0])
    if not fn:
        # primeira palavra so tinha simbolo/emoji — tenta segunda
        if len(parts) > 1:
            fn2 = _normalize(parts[1])
            if fn2:
                return fn2.capitalize() if fn2.isupper() else fn2
        return fallback
    fn_lower = fn.lower()
    # Bot greeting ou titulo profissional -> tenta segunda palavra
    if fn_lower in _SKIP_FIRST_NAMES or fn_lower in _SKIP_TITLE_PREFIXES:
        if len(parts) > 1:
            fn2 = _normalize(parts[1])
            if fn2 and fn2.lower() not in _SKIP_FIRST_NAMES:
                return fn2.capitalize() if fn2.isupper() else fn2
        return fallback
    return fn.capitalize() if fn.isupper() else fn

# ---------- DEDUPE ----------
def load_processed_ids(log_path):
    """Le results.jsonl e retorna set de deal_ids ja processados com sucesso."""
    p = Path(log_path)
    if not p.exists():
        return set()
    done = set()
    for line in p.open(encoding="utf-8"):
        try:
            r = json.loads(line)
            if r.get("ok"):
                done.add(r["deal_id"])
        except Exception:
            continue
    return done

# ---------- TIME ----------
def now_brt():
    return datetime.datetime.now(BRT)

def brt_to_utc_hhmm(hhmm_brt):
    """Converte 'HH:MM' BRT (UTC-3) para 'HH:MM' UTC."""
    h, m = map(int, hhmm_brt.split(":"))
    h_utc = (h + 3) % 24
    return f"{h_utc:02d}:{m:02d}"

# ---------- LOG ----------
def _append_jsonl(log_path, obj):
    p = Path(log_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")

def _log(msg, log_path=None):
    ts = now_brt().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    if log_path:
        side = Path(log_path).with_suffix(".log")
        side.parent.mkdir(parents=True, exist_ok=True)
        with side.open("a", encoding="utf-8") as f:
            f.write(line + "\n")

# ---------- PROCESS ONE LEAD ----------
def process_lead(creds, lead, config, log_path):
    """Roda fluxo completo pra 1 lead. Retorna dict com resultado."""
    deal_id = lead["deal_id"]
    sdr = lead["sdr"]
    sdr_id = config["sdr_ids"][sdr]
    dialog_id = config["sdr_dialogs"][sdr]

    result = {"deal_id": deal_id, "sdr": sdr, "ok": False, "errs": []}

    try:
        # 1. GET deal -> person, phone, name, company
        d = pd_get(creds, f"/deals/{deal_id}")
        if not d.get("success"):
            raise RuntimeError(f"GET deal: {d}")
        deal = d["data"]
        person = deal.get("person_id") or {}
        person_id = person.get("value")
        person_name = person.get("name", "") or "amigo(a)"
        org = deal.get("org_id") or {}
        company = (org.get("name") if org else None) or None
        phones = person.get("phone") or []
        phone_raw = next((p["value"] for p in phones if p.get("primary")),
                         phones[0]["value"] if phones else "")
        phone = normalize_br(phone_raw)
        if not phone:
            raise RuntimeError("Sem telefone")
        result.update(person_id=person_id, name=person_name, company=company, phone=phone)

        # Mensagens
        first_name = _clean_first_name(person_name)
        m1 = config["msg_1_func"](first_name, sdr)
        m2 = config["msg_2_func"](company)
        m3 = config["msg_3_func"]()

        # 2. Vencida
        if config.get("vencida_subject_match"):
            ar = pd_get(creds, f"/deals/{deal_id}/activities", {"done": 0})
            for a in (ar.get("data") or []):
                if config["vencida_subject_match"] in (a.get("subject") or ""):
                    rr = pd_put(creds, f"/activities/{a['id']}", {"done": 1})
                    if rr.get("success"):
                        result["vencida_id"] = a["id"]
                    else:
                        result["errs"].append(f"vencida: {rr}")
                    break

        # 3. Reatribuir SDR
        rr = pd_put(creds, f"/deals/{deal_id}", {"user_id": sdr_id})
        if not rr.get("success"):
            result["errs"].append(f"update_owner: {rr}")

        # 4. ChatGuru chat_add (msg 1 + nome; com fallback 12<->13)
        # SEM dialog_id aqui — disparamos dialog_execute separado pra garantir.
        rr, phone_used = chat_add_with_fallback(creds, phone, person_name, m1)
        chat_add_ok = bool(rr.get("chat_add_id"))
        if chat_add_ok:
            result["chat_add_id"] = rr["chat_add_id"]
        else:
            result["errs"].append(f"chat_add: {rr}")
        result["phone_used"] = phone_used

        # 5. Wait 4-8s (registro async ChatGuru)
        time.sleep(config.get("post_chat_add_sleep", 5))

        # 6. dialog_execute (separado, garantia) — com fallback 12<->13
        rr, phone_used = cg_call_phone_fallback(creds, "dialog_execute", phone_used,
                                                {"dialog_id": dialog_id})
        if rr.get("result") != "success":
            result["errs"].append(f"dialog_execute: {rr.get('description', rr)}")
        result["phone_used"] = phone_used

        # 7. Send msg 2 + msg 3 com send_date
        now = now_brt()
        m2_dt = now + datetime.timedelta(minutes=config.get("msg2_offset_min", 1))
        m3_dt = now + datetime.timedelta(minutes=config.get("msg3_offset_min", 2))
        s2 = m2_dt.strftime("%Y-%m-%d %H:%M")
        s3 = m3_dt.strftime("%Y-%m-%d %H:%M")

        rr, _ = cg_call_phone_fallback(creds, "message_send", phone_used,
                                       {"text": m2, "send_date": s2})
        if rr.get("result") == "success":
            result["msg2_id"] = rr.get("message_id")
            result["msg2_send_date"] = s2
        else:
            result["errs"].append(f"msg_2: {rr.get('description', rr)}")

        rr, _ = cg_call_phone_fallback(creds, "message_send", phone_used,
                                       {"text": m3, "send_date": s3})
        if rr.get("result") == "success":
            result["msg3_id"] = rr.get("message_id")
            result["msg3_send_date"] = s3
        else:
            result["errs"].append(f"msg_3: {rr.get('description', rr)}")

        # 8. Atividades Pipedrive — somente apos confirmar que chat_add deu certo.
        # Evita atividades-fantasma marcadas como "enviada" quando disparo nem aconteceu.
        if chat_add_ok:
            # 8a. Atividade WhatsApp concluida (registro)
            wa_note = (f"Mensagem de ativação enviada em 3 partes via ChatGuru:\n\n"
                       f"[1] {m1}\n\n[2] {m2}\n\n[3] {m3}")
            wa_due_utc = brt_to_utc_hhmm(config.get("wa_due_time_brt", "09:25"))
            rr = pd_post(creds, "/activities", {
                "subject": config.get("wa_subject", "Mensagem de ativação"),
                "type": "whatsapp",
                "deal_id": deal_id,
                "user_id": config["expert_id"],
                "due_date": now_brt().strftime("%Y-%m-%d"),
                "due_time": wa_due_utc,
                "note": wa_note,
                "done": 1,
            })
            if rr.get("success"):
                result["wa_activity_id"] = rr["data"]["id"]
            else:
                result["errs"].append(f"create_wa: {rr}")

            # 8b. Atividade Call (follow-up)
            call_due_utc = brt_to_utc_hhmm(config.get("call_due_time_brt", "11:30"))
            call_note = (f"Lead da campanha. Mensagem de ativacao em 3 partes ja disparada via ChatGuru.\n\n"
                         f"Telefone: {phone_used}\nEmpresa: {company or '(nao informada)'}")
            rr = pd_post(creds, "/activities", {
                "subject": config.get("call_subject", "Ligar - Follow-up"),
                "type": "call",
                "deal_id": deal_id,
                "user_id": sdr_id,
                "due_date": config.get("call_due_date", now_brt().strftime("%Y-%m-%d")),
                "due_time": call_due_utc,
                "duration": config.get("call_duration", "00:30"),
                "note": call_note,
            })
            if rr.get("success"):
                result["call_activity_id"] = rr["data"]["id"]
            else:
                result["errs"].append(f"create_call: {rr}")
        else:
            result["errs"].append("atividades_skipped: chat_add falhou — atividades nao foram criadas pra evitar registro fantasma")
            # 8c. Erro de disparo: cria task + move pra Lead Mapeado + label ERRO DE DISPARO
            try:
                pd_post(creds, "/activities", {
                    "subject": "Erro de disparo",
                    "type":    "task",
                    "deal_id": deal_id,
                    "user_id": config["expert_id"],
                    "done":    0,
                    "note":    f"chat_add falhou. Phone testado: {phone} (e variante 12<->13). Provavel numero invalido/sem WhatsApp.",
                })
                # Preserva labels existentes, adiciona ERRO_LABEL_ID
                cur_label = deal.get("label")
                cur_ids = []
                if isinstance(cur_label, int):
                    cur_ids = [cur_label]
                elif isinstance(cur_label, str) and cur_label:
                    cur_ids = [int(x) for x in cur_label.split(",") if x.strip().isdigit()]
                elif isinstance(cur_label, list):
                    cur_ids = [int(x) for x in cur_label if str(x).isdigit()]
                if ERRO_LABEL_ID not in cur_ids:
                    cur_ids.append(ERRO_LABEL_ID)
                pd_put(creds, f"/deals/{deal_id}", {
                    "stage_id": LEAD_MAPEADO_STAGE,
                    "label": ",".join(str(x) for x in cur_ids),
                })
                result["moved_to_lead_mapeado"] = True
            except Exception as _e:
                result["errs"].append(f"flag_erro_disparo: {_e}")

        # 9. CRM links + nota (so se chat_add deu certo)
        if chat_add_ok:
            rr, _ = cg_call_phone_fallback(creds, "chat_update_custom_fields", phone_used, {
                "field__CRM__Link_pessoa":  f"https://expertintegrado.pipedrive.com/person/{person_id}",
                "field__CRM__Link_negocio": f"https://expertintegrado.pipedrive.com/deal/{deal_id}",
            })
            if rr.get("result") != "success":
                result["errs"].append(f"crm_fields: {rr.get('description', rr)}")

            rr, _ = cg_call_phone_fallback(creds, "note_add", phone_used, {
                "note_text": f"Link do negócio no Pipedrive: https://expertintegrado.pipedrive.com/deal/{deal_id}",
            })
            if rr.get("result") != "success":
                result["errs"].append(f"note: {rr.get('description', rr)}")

        result["ok"] = len(result["errs"]) == 0

    except Exception as e:
        result["errs"].append(f"EXCEPTION: {e}")

    _append_jsonl(log_path, result)
    return result

# ---------- MAIN ----------
def run_batch(LEADS, config, log_path, dedupe=True, dry_run=False):
    """
    Processa LEADS sequencialmente. Cada lead: dict com keys deal_id, sdr.
    Faz dedupe via results.jsonl (filtra deals ja processados com ok=true).
    """
    creds = _load_creds()

    if dedupe:
        done = load_processed_ids(log_path)
        before = len(LEADS)
        LEADS = [l for l in LEADS if l["deal_id"] not in done]
        if before != len(LEADS):
            _log(f"DEDUPE: {before - len(LEADS)} leads ja processados (filtrados)", log_path)

    total = len(LEADS)
    _log(f"=== INICIO BATCH | {total} leads | sleep {config.get('sleep_between_leads', 30)}s ===", log_path)

    if dry_run:
        _log("DRY RUN — sem execucao", log_path)
        for l in LEADS:
            _log(f"  -> deal {l['deal_id']} {l['sdr']}", log_path)
        return []

    sucesso = falha = 0
    results = []
    for i, lead in enumerate(LEADS, start=1):
        try:
            r = process_lead(creds, lead, config, log_path)
            if r["ok"]:
                sucesso += 1
                _log(f"[{i}/{total}] OK   deal {r['deal_id']} {r.get('name','')} -> {r['sdr']}", log_path)
            else:
                falha += 1
                _log(f"[{i}/{total}] WARN deal {r['deal_id']} {r.get('name','')} -> {r['sdr']} | ERRS: {r['errs']}", log_path)
            results.append(r)
        except Exception as e:
            falha += 1
            _log(f"[{i}/{total}] FAIL deal {lead.get('deal_id')}: {e}", log_path)

        if i < total:
            time.sleep(config.get("sleep_between_leads", 30))

    _log(f"=== FIM BATCH | OK: {sucesso} | WARN/ERR: {falha} ===", log_path)
    return results
