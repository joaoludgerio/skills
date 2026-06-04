"""disparar_toque.py — dispara UM toque da cadeia de notificacao de webinario.

Uso:
  python -X utf8 disparar_toque.py --evento "O Imposto Invisivel do Empresario" \
      --toque 6 --zoom "https://us02web.zoom.us/j/..." \
      --diag "https://expertintegrado.com.br/diagnostico"

Toques: 1=T-12h 2=T-1h 3=T0 4=pitch 5=abertura-sessao 6=FUP1 7=FUP2
Toques 1-5 usam link Zoom (1-4) ou Diag (5). Toques 5/6/7 sao link Diag.
Toques 6/7 filtram so pipeline Prospeccao (7) — quem agendou (Educacional) sai.

Regras embutidas: linha unica (template rejeita \\n), sem travessao, filtro por
evento (campo Detalhes da origem), dedup por log proprio do toque.
Credenciais SEMPRE do JSON local (claude-sync), nunca hardcoded.
"""
import sys, json, re, os, urllib.request, argparse
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from importlib.util import spec_from_file_location, module_from_spec

SYNC = r'C:/Users/Eric Luciano/OneDrive/Workspace/claude-sync'
spec = spec_from_file_location('eng', f'{SYNC}/scripts/whatsapp-api-fup-batch.py')
eng = module_from_spec(spec); spec.loader.exec_module(eng)
PD_TOKEN = json.load(open(f'{SYNC}/claude_desktop_config.json'))['mcpServers']['pipedrive']['env']['PIPEDRIVE_API_KEY']
PD_BASE = 'https://expertintegrado.pipedrive.com/api/v1'
PROSPECCAO = 7
DETALHE_KEY = 'c35bea7247f83fcb9cdc24abef1e4e793ae79d7d'  # Detalhes da origem da oportunidade
CARGO_KEY = '055b68e8b474363c8c4e125eab49788193109ad0'
LIXO = {'.','-','n','q','teste','test','outros','outra','outras','outro','','na','n/a','...','ll','ueh','ia','nenhuma','autonomo','autonoma','automo','eu','minha','particular','estudante'}

def norm(p):
    d = re.sub(r'\D','',str(p or ''))
    if len(d) in (10,11): return '55'+d
    if len(d) in (12,13) and d.startswith('55'): return d
    return d
def valido(x): return x and str(x).strip().lower() not in LIXO and len(str(x).strip())>1

def miolo(toque, nome, emp, zoom, diag, evento):
    e = emp if valido(emp) else None
    M = {
      1: f'{nome}, falta pouco pro {evento}! E ao vivo e sem reprise, separa o horario que o conteudo vai direto ao ponto pra sua empresa. Salva o link e te vejo la 👉 {zoom}',
      2: f'{nome}, comecamos em 1 hora! Deixa tudo pronto pra entrar ao vivo. Link do Zoom aqui 👉 {zoom}',
      3: f'{nome}, comecamos agora! Entra que ja vamos abrir, microfone mutado e camera a teu criterio 👉 {zoom}',
      4: f'{nome}, chegou a parte mais importante do {evento}, o que vem agora muda como voce opera com IA. Nao sai! Se ainda nao entrou, corre 👉 {zoom}',
      5: f'Tenho um presente pra voce, {nome}! Liberamos um diagnostico gratuito de IA individual pra {("a "+e) if e else "sua empresa"}, 45 minutos com um consultor pra voce sair com um plano pratico. Vagas limitadas, agenda 👉 {diag}',
      6: f'{nome}, nao quero que voce perca: o diagnostico gratuito de IA que liberamos ainda ta de pe, mas as vagas tao acabando. 45 minutos pra sair com um plano pratico pra sua empresa. Garante o seu 👉 {diag}',
      7: f'{nome}, ultima chamada: hoje fechamos as vagas do diagnostico gratuito de IA. Nao deixa passar, sao 45 minutos que podem mudar o rumo da sua empresa 👉 {diag}',
    }
    return M[toque]

def deals_do_evento(evento, so_prospeccao):
    """Itera deals open dos pipelines relevantes e filtra pelo Detalhe da origem == evento."""
    pipelines = [PROSPECCAO] if so_prospeccao else [PROSPECCAO, 6]
    achados = []
    for pid_pipe in pipelines:
        start = 0
        while True:
            url = f'{PD_BASE}/deals?api_token={PD_TOKEN}&status=open&pipeline_id={pid_pipe}&start={start}&limit=100'
            with urllib.request.urlopen(url, timeout=30) as r:
                data = json.loads(r.read())
            for d in (data.get('data') or []):
                det = (d.get(DETALHE_KEY) or '')
                if isinstance(det, str) and evento.lower() in det.lower():
                    achados.append(d)
            more = (data.get('additional_data') or {}).get('pagination', {})
            if more.get('more_items_in_collection'):
                start = more.get('next_start', start+100)
            else:
                break
    return achados

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--evento', required=True)
    ap.add_argument('--toque', type=int, required=True, choices=range(1,8))
    ap.add_argument('--zoom', default='')
    ap.add_argument('--diag', default='https://expertintegrado.com.br/diagnostico')
    a = ap.parse_args()

    so_prosp = a.toque in (6,7)
    deals = deals_do_evento(a.evento, so_prosp)
    log = f'C:/tmp/notificacao-webinario/{a.evento[:20].replace(" ","_")}_toque{a.toque}.jsonl'
    os.makedirs(os.path.dirname(log), exist_ok=True)

    leads=[]
    for d in deals:
        person = d.get('person_id') or {}
        pid = person.get('value') if isinstance(person, dict) else None
        if not pid: continue
        # phone + cargo + empresa via person
        with urllib.request.urlopen(f'{PD_BASE}/persons/{pid}?api_token={PD_TOKEN}', timeout=30) as r:
            p = json.loads(r.read())['data']
        phones = p.get('phone') or []
        phone = ''
        for ph in phones:
            v = norm(ph.get('value','') if isinstance(ph, dict) else ph)
            if v.startswith('55') and len(v) in (12,13): phone=v; break
        if not phone: continue
        nome = (p.get('name','') or '').split()[0] or 'Prezado'
        emp = p.get('org_id', {}).get('name','') if isinstance(p.get('org_id'), dict) else ''
        leads.append({'deal_id':d['id'],'person_id':pid,'phone':phone,'name':nome,
                      'miolo':miolo(a.toque, nome, emp, a.zoom, a.diag, a.evento)})

    print(f'Toque {a.toque} | evento "{a.evento}" | {len(leads)} leads (so_prospeccao={so_prosp})', flush=True)
    results = eng.run_batch(leads, dialog_id=eng.DIALOG_TEMPLATE_DISPARO, log_path=log)
    ok = sum(1 for r in results if r['ok'])
    print(f'\n=== TOQUE {a.toque}: {ok}/{len(results)} OK | {len(results)-ok} ERROS ===', flush=True)
    for r in results:
        if not r['ok']: print(f'  ERRO {r["deal_id"]} ({r["name"]}): {str(r["erro"])[:70]}', flush=True)

if __name__ == '__main__':
    main()
