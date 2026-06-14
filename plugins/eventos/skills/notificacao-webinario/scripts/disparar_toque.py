"""disparar_toque.py — dispara UM toque da cadeia de notificacao de webinario.
MODO SEMI por padrao: sem --confirmar, so mostra PREVIEW (copy + lista), nao dispara.

Uso:
  # preview (nao dispara):
  python -X utf8 disparar_toque.py --inscritos "C:/.../invitees.csv" \
      --evento "O Imposto Invisivel do Empresario" --toque 6 \
      --zoom "https://us02web.zoom.us/j/..." --diag "https://expertintegrado.com.br/diagnostico"
  # dispara de verdade (apos Eric aprovar):
  ...mesmos args... --confirmar

LOGICA DE 2 CAMADAS (lições do Imposto Invisivel):
  Camada 1 (pertencimento): universo = EXPORT DE INSCRITOS (CSV), cruzado por TELEFONE
     com os deals de origem do evento no Pipedrive. NUNCA so o filtro de origem do CRM
     (infla com leads antigos). Telefone e a chave (nao deal_id — merge troca ID).
  Camada 2 (etapa): filtra por STAGE. Toques 6/7 (FUP) excluem quem ja agendou
     (stage 54 Apresentacao Agendada / 60 Realizada / 79 Reuniao agendada).

Toques: 1=T-12h 2=T-1h 3=T0 4=pitch 5=abertura-sessao 6=FUP1 7=FUP2
Regras: linha unica (template rejeita \\n), sem travessao, segmenta cargo (decisor/funcionario).
Credenciais SEMPRE do JSON local. dialog_execute OK != entrega (conferir no painel arquivados).
"""
import sys, json, re, os, csv, urllib.request, argparse
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from importlib.util import spec_from_file_location, module_from_spec

SYNC = r'C:/Users/Eric Luciano/OneDrive/Workspace/claude-sync'
spec = spec_from_file_location('eng', f'{SYNC}/scripts/whatsapp-api-fup-batch.py')
eng = module_from_spec(spec); spec.loader.exec_module(eng)
PD_TOKEN = json.load(open(f'{SYNC}/claude_desktop_config.json'))['mcpServers']['pipedrive']['env']['PIPEDRIVE_API_KEY']
PD_BASE = 'https://expertintegrado.pipedrive.com/api/v1'
DETALHE_KEY = 'c35bea7247f83fcb9cdc24abef1e4e793ae79d7d'  # Detalhes da origem da oportunidade
CARGO_KEY   = '055b68e8b474363c8c4e125eab49788193109ad0'
AGENDOU_STAGES = {54, 60, 79}  # Apresentacao Agendada/Realizada (Educ) + Reuniao agendada (Prosp)
LIXO = {'.','-','n','q','teste','test','outros','outra','outras','outro','','na','n/a','...','ll','ueh','ia','nenhuma','autonomo','autonoma','automo','eu','minha','particular','estudante'}
DECISOR_KW = ['ceo','socio','sócio','diretor','propriet','founder','fundador','presidente','dono','empresar','cfo','coo','cto','cmo','head']

def norm(p):
    d = re.sub(r'\D','',str(p or ''))
    if len(d) in (10,11): return '55'+d
    if len(d) in (12,13) and d.startswith('55'): return d
    return d
def alt(t):
    if len(t)==13 and t.startswith('55') and t[4]=='9': return t[:4]+t[5:]
    if len(t)==12 and t.startswith('55'): return t[:4]+'9'+t[4:]
    return None
def valido(x): return x and str(x).strip().lower() not in LIXO and len(str(x).strip())>1
def eh_decisor(c): return any(k in (c or '').lower() for k in DECISOR_KW)

def ler_inscritos(path):
    """Le CSV de inscritos (Calendly). Retorna dict telefone_normalizado -> {nome, empresa, cargo}."""
    idx = {}
    with open(path, encoding='utf-8') as fh:
        for r in csv.DictReader(fh):
            if (r.get('Canceled','') or '').strip().lower() == 'true': continue
            tel = norm(r.get('WhatsApp') or r.get('Telefone') or r.get('Phone') or '')
            if not tel: continue
            dados = {'nome': (r.get('First Name') or r.get('Name') or '').strip(),
                     'empresa': (r.get('Empresa') or '').strip(),
                     'cargo': (r.get('Cargo') or '').strip()}
            idx[tel] = dados
            a = alt(tel)
            if a: idx[a] = dados
    return idx

def deals_origem(evento):
    """Todos os deals open cujo Detalhe da origem casa com o evento (pipeline-agnostic)."""
    out=[]; start=0
    while True:
        url=f'{PD_BASE}/deals?api_token={PD_TOKEN}&status=open&start={start}&limit=500'
        with urllib.request.urlopen(url, timeout=60) as r:
            data=json.loads(r.read())
        for d in (data.get('data') or []):
            det=(d.get(DETALHE_KEY) or '')
            if isinstance(det,str) and evento.lower() in det.lower():
                out.append(d)
        more=(data.get('additional_data') or {}).get('pagination',{})
        if more.get('more_items_in_collection'): start=more.get('next_start',start+500)
        else: break
    return out

def miolo(toque, nome, emp, zoom, diag, evento):
    e = emp if valido(emp) else None
    M = {
      1:f'{nome}, falta pouco pro {evento}! É ao vivo e sem reprise, separa o horário que o conteúdo vai direto ao ponto pra sua empresa. Salva o link e te vejo lá 👉 {zoom}',
      2:f'{nome}, começamos em 1 hora! Deixa tudo pronto pra entrar ao vivo. Link do Zoom aqui 👉 {zoom}',
      3:f'{nome}, começamos agora! Entra que já vamos abrir, microfone mutado e câmera a teu critério 👉 {zoom}',
      4:f'{nome}, chegou a parte mais importante do {evento}, o que vem agora muda como você opera com IA. Não sai! Se ainda não entrou, corre 👉 {zoom}',
      5:f'Tenho um presente pra você, {nome}! Liberamos um diagnóstico gratuito de IA individual pra {("a "+e) if e else "sua empresa"}, 45 minutos com um consultor pra você sair com um plano prático. Vagas limitadas, agenda 👉 {diag}',
      6:f'{nome}, não quero que você perca: o diagnóstico gratuito de IA que liberamos ainda tá de pé, mas as vagas tão acabando. 45 minutos pra sair com um plano prático pra sua empresa. Garante o seu 👉 {diag}',
      7:f'{nome}, última chamada: hoje fechamos as vagas do diagnóstico gratuito de IA. Não deixa passar, são 45 minutos que podem mudar o rumo da sua empresa 👉 {diag}',
    }
    return M[toque]

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--inscritos', required=True, help='CSV export de inscritos (Calendly)')
    ap.add_argument('--evento', required=True, help='Detalhe da origem (nome do evento no Pipedrive)')
    ap.add_argument('--toque', type=int, required=True, choices=range(1,8))
    ap.add_argument('--zoom', default='')
    ap.add_argument('--diag', default='https://expertintegrado.com.br/diagnostico')
    ap.add_argument('--delay', type=int, default=8, help='segundos entre disparos (anti-throttle)')
    ap.add_argument('--confirmar', action='store_true', help='dispara de verdade; sem isso = preview')
    a=ap.parse_args()

    inscritos = ler_inscritos(a.inscritos)   # CAMADA 1: universo = inscritos
    tel_unicos = {t for t in inscritos if not (len(t)==12)}  # aprox (ignora as formas alt de 12 digitos)
    print(f'Inscritos no CSV (telefones indexados): {len(inscritos)} entradas', flush=True)
    deals = deals_origem(a.evento)

    fup = a.toque in (6,7)
    leads=[]; agendaram=0; nao_inscrito=0
    for d in deals:
        person=d.get('person_id') or {}; pid=person.get('value') if isinstance(person,dict) else None
        if not pid: continue
        phones = person.get('phone',[]) if isinstance(person,dict) else []
        phone=''
        for ph in phones:
            v=norm(ph.get('value','') if isinstance(ph,dict) else ph)
            if v in inscritos: phone=v; break
        if not phone:  # CAMADA 1: nao e inscrito real -> fora (lead antigo)
            nao_inscrito+=1; continue
        if fup and d.get('stage_id') in AGENDOU_STAGES:  # CAMADA 2: ja agendou -> nao recebe FUP
            agendaram+=1; continue
        dados = inscritos[phone]
        nome = (dados['nome'] or '').split()[0] or 'Prezado'
        # personalizacao: cargo/empresa vem do CSV (fonte de inscricao)
        leads.append({'deal_id':d['id'],'person_id':pid,'phone':phone,'name':nome,
                      'cargo':dados['cargo'],'empresa':dados['empresa'],
                      'miolo':miolo(a.toque, nome, dados['empresa'], a.zoom, a.diag, a.evento)})

    print(f'\n=== TOQUE {a.toque} | evento "{a.evento}" ===')
    print(f'Deals origem do evento: {len(deals)} | descartados (nao inscritos/leads antigos): {nao_inscrito}')
    if fup: print(f'Ja agendaram (excluidos do FUP): {agendaram}')
    print(f'>>> VAO RECEBER: {len(leads)}')
    dec=sum(1 for l in leads if eh_decisor(l['cargo']))
    print(f'    decisores (pitch A): {dec} | funcionarios (pitch B): {len(leads)-dec}')
    print('\nEXEMPLOS DE COPY:')
    for l in leads[:3]:
        print(f'  • {l["name"]} ({l["cargo"] or "s/cargo"} | {l["empresa"] or "s/empresa"}):')
        print(f'    Olá. {l["miolo"]} Obrigado.')

    if not a.confirmar:
        print('\n[PREVIEW] Nada foi disparado. Revise a copy/lista acima.')
        print('Pra disparar de verdade, rode o mesmo comando com --confirmar')
        return

    log=f'C:/tmp/notificacao-webinario/{a.evento[:20].replace(" ","_")}_toque{a.toque}.jsonl'
    os.makedirs(os.path.dirname(log), exist_ok=True)
    print(f'\n>>> DISPARANDO {len(leads)} (delay {a.delay}s)...', flush=True)
    import time
    results=[]
    for i,l in enumerate(leads,1):
        r=eng.run_batch([l], dialog_id=eng.DIALOG_TEMPLATE_DISPARO, log_path=log, verbose=False)[0]
        results.append(r)
        print(f'  [{i}/{len(leads)}] {l["name"]}: {"OK" if r["ok"] else "ERRO"}', flush=True)
        if i<len(leads): time.sleep(a.delay)
    ok=sum(1 for r in results if r['ok'])
    print(f'\n=== {ok}/{len(results)} OK ===')

if __name__=='__main__':
    main()
