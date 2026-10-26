#!/usr/bin/env python3
"""Lê o Zabbix (somente leitura) e gera o status.json do painel.

Uso:  collector.py [--out arquivo.json] [--post URL]
Config por variáveis de ambiente:
  ZBX_URL, ZBX_USER, ZBX_PASS   API do Zabbix
  INGEST_TOKEN                  token de envio (só com --post)
O JSON leva apenas nomes e estados: nunca IPs, MACs ou credenciais.
"""
import argparse, collections, datetime as dt, difflib, json, os, re, subprocess, sys, unicodedata, urllib.request

G_MIKROTIK, G_SERVIDORES = '22', '38'
G_EQUIP = {'switches': '44', 'aps': '45', 'ubiquiti': '46'}
G_DOWNDETECTOR, G_FIREWALL = '29', '24'
DOWN_RE = re.compile(r'unavailable by icmp ping|agent is not available|is not available|unreachable', re.I)


def rpc(url, method, params, tok=None):
    h = {'Content-Type': 'application/json-rpc'}
    if tok:
        h['Authorization'] = 'Bearer ' + tok
    req = urllib.request.Request(url, json.dumps({'jsonrpc': '2.0', 'method': method, 'params': params, 'id': 1}).encode(), h)
    d = json.load(urllib.request.urlopen(req, timeout=60))
    if 'error' in d:
        raise RuntimeError(d['error'].get('data') or d['error'])
    return d['result']


def iso(ts):
    return dt.datetime.fromtimestamp(int(ts), dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'\b(sta|sra|sr|s)\b\.?', lambda m: {'sta': 'santa', 'sra': 'senhora'}.get(m.group(1), m.group(1)), s)
    return re.sub(r'[^a-z0-9 ]', ' ', s).split() and ' '.join(re.sub(r'[^a-z0-9 ]', ' ', s).split())


def parte_unidade(nome):
    """'Switch - Casa do artesao - 062076' -> 'Casa do artesao'"""
    p = [x.strip() for x in nome.split(' - ')]
    if len(p) > 1:
        return p[1]
    return re.sub(r'\s+\d{5,}$', '', re.sub(r'^(AP|Switch|Mikrotik)\s+(TP-?Link|Unifi)?\s*', '', p[0], flags=re.I)).strip() or p[0]


def coletar(url, user, pw):
    tok = rpc(url, 'user.login', {'username': user, 'password': pw})
    call = lambda m, p: rpc(url, m, p, tok)

    # triggers de indisponibilidade ativas: host -> lastchange
    trs = call('trigger.get', {'monitored': True, 'skipDependent': True, 'filter': {'value': 1},
                               'groupids': [G_MIKROTIK, G_SERVIDORES, G_FIREWALL, *G_EQUIP.values()],
                               'output': ['description', 'lastchange'], 'selectHosts': ['hostid', 'name'], 'limit': 20000})
    fora = {}
    for t in trs:
        if DOWN_RE.search(t['description']):
            h = t['hosts'][0]['hostid']
            fora[h] = min(int(t['lastchange']), fora.get(h, 1 << 60))

    # ---- unidades (Mikrotiks) + equipamentos fora
    mk = call('host.get', {'groupids': G_MIKROTIK, 'output': ['hostid', 'name'], 'filter': {'status': 0}})
    unidades = {}
    for h in mk:
        nome = parte_unidade(h['name'])
        unidades[norm(nome)] = {'nome': nome, 'mikrotik': {'estado': 'fora' if h['hostid'] in fora else 'ok',
                                'desde': iso(fora[h['hostid']]) if h['hostid'] in fora else None}, 'equipamentos_fora': []}
    chaves = list(unidades)
    totais = {}
    for tipo, gid in G_EQUIP.items():
        hs = call('host.get', {'groupids': gid, 'output': ['hostid', 'name'], 'filter': {'status': 0}})
        quedas = [h for h in hs if h['hostid'] in fora]
        totais[tipo] = {'total': len(hs), 'fora': len(quedas), 'on': len(hs) - len(quedas)}
        rot = {'switches': 'Switch', 'aps': 'AP', 'ubiquiti': 'AP'}[tipo]
        for h in quedas:
            nome = parte_unidade(h['name'])
            k = norm(nome)
            alvo = k if k in unidades else (difflib.get_close_matches(k, chaves, 1, 0.75) or [None])[0]
            if alvo is None:
                alvo = k
                unidades[k] = {'nome': nome, 'mikrotik': {'estado': 'ok', 'desde': None}, 'equipamentos_fora': []}
            partes = [x.strip() for x in h['name'].split(' - ')]
            rotulo = re.sub(r'\s*\d{5,}$', '', ' - '.join(partes[2:] if len(partes) > 2 else partes[1:2] or partes)).strip() or nome
            rotulo = re.sub(r'^(AP|Switch)\s+(TP-?Link|UniFI)\s*(-\s*)?', '', re.sub(r'[\s-]+$', '', rotulo), flags=re.I).strip() or nome
            unidades[alvo]['equipamentos_fora'].append({'tipo': rot, 'nome': rotulo, 'desde': iso(fora[h['hostid']])})
    lista_un = []
    for u in sorted(unidades.values(), key=lambda x: x['nome']):
        u['estado'] = 'fora' if u['mikrotik']['estado'] == 'fora' else ('parcial' if u['equipamentos_fora'] else 'ok')
        lista_un.append({'nome': u['nome'], 'estado': u['estado'], 'mikrotik': u['mikrotik'], 'equipamentos_fora': u['equipamentos_fora']})

    # ---- servidores
    sv = call('host.get', {'groupids': G_SERVIDORES, 'output': ['hostid', 'name'], 'filter': {'status': 0}})
    ids = [h['hostid'] for h in sv]
    met = collections.defaultdict(dict)
    for it in call('item.get', {'hostids': ids, 'monitored': True, 'output': ['hostid', 'key_', 'lastvalue'],
                                'search': {'key_': ['system.cpu.util', 'vm.memory.util', 'pused']}, 'searchByAny': True}):
        try:
            v = round(float(it['lastvalue']))
        except ValueError:
            continue
        m = met[it['hostid']]
        if it['key_'].startswith('system.cpu.util'):
            m['cpu'] = v
        elif it['key_'].startswith('vm.memory.util'):
            m['ram'] = v
        elif 'vfs.fs' in it['key_'] and it['key_'].endswith('pused]'):
            m['disco'] = max(v, m.get('disco', 0))
    servidores = []
    for h in sv:
        e = 'fora' if h['hostid'] in fora else 'ok'
        m = met.get(h['hostid'], {})
        if e == 'ok' and any(m.get(k, 0) >= 90 for k in ('cpu', 'ram', 'disco')):
            e = 'parcial'
        servidores.append({'nome': h['name'], 'estado': e, **({} if e == 'fora' else m)})
    servidores.sort(key=lambda s: ({'fora': 0, 'parcial': 1, 'ok': 2}[s['estado']], s['nome']))

    # ---- sistemas (firewalls + serviços externos do Downdetector)
    sistemas = []
    for h in call('host.get', {'groupids': G_FIREWALL, 'output': ['hostid', 'name'], 'filter': {'status': 0}}):
        sistemas.append({'nome': h['name'], 'detalhe': 'Firewall', 'estado': 'fora' if h['hostid'] in fora else 'ok',
                         'desde': iso(fora[h['hostid']]) if h['hostid'] in fora else None})
    for it in call('item.get', {'groupids': G_DOWNDETECTOR, 'monitored': True, 'output': ['key_', 'lastvalue']}):
        nome = re.search(r'\[(.+)\]', it['key_']).group(1).capitalize()
        sistemas.append({'nome': nome, 'detalhe': 'Serviço externo (Downdetector)',
                         'estado': 'ok' if it['lastvalue'] in ('0', '') else 'parcial', 'desde': None})

    return {'gerado_em': iso(dt.datetime.now(dt.timezone.utc).timestamp()),
            'vms': servidores, 'esxi': esxi(), 'sistemas': sistemas, 'unidades': lista_un, 'rede': totais}


def esxi():
    """Hosts ESXi e temperaturas dos sensores, via govc (GOVC_URL/GOVC_USERNAME/GOVC_PASSWORD/GOVC_INSECURE).
    Sem govc ou sem acesso ao vCenter devolve lista vazia (o resto do painel continua)."""
    def govc(*a):
        return subprocess.run(['/usr/local/bin/govc', *a], capture_output=True, text=True, timeout=60, check=True).stdout
    try:
        caminhos = sorted(govc('find', '/', '-type', 'h').split('\n'))
    except Exception as e:
        print('esxi: ' + str(e), file=sys.stderr)
        return []
    ordem = {'Green': 0, 'Unknown': 0, 'Yellow': 1, 'Red': 2}
    hosts = []
    try:  # VMs agrupadas pelo moid do host
        vms = collections.defaultdict(list)
        for v in json.loads(govc('vm.info', '-json', *filter(None, govc('find', '/', '-type', 'm').split('\n')))).get('virtualMachines', []):
            vms[v['runtime']['host']['value']].append(v)
    except Exception as e:
        print('esxi (vms): ' + str(e), file=sys.stderr)
        vms = {}
    for c in filter(None, caminhos):
        nome = c.rsplit('/', 1)[-1].split('.')[0].upper()
        try:
            props = {o['name']: o['val'] for o in json.loads(govc('object.collect', '-json', c,
                     'runtime.healthSystemRuntime.systemHealthInfo', 'summary.runtime.connectionState',
                     'summary.hardware.model', 'summary.hardware.cpuMhz'))}
            moid = govc('find', '-i', '/', '-type', 'h', '-name', c.rsplit('/', 1)[-1]).strip().split(':')[-1]
        except Exception:
            hosts.append({'nome': nome, 'estado': 'fora', 'temps': {}})
            continue
        temps, sensores, pior = [], [], 0
        for sn in props.get('runtime.healthSystemRuntime.systemHealthInfo', {}).get('numericSensorInfo', []):
            if sn.get('sensorType') != 'temperature' or sn.get('baseUnits') != 'degrees C' \
                    or 'DTS' in sn['name'] or sn['name'].lower().endswith('overtemp'):
                continue
            pior = max(pior, ordem.get(sn['healthState']['key'], 0))
            temps.append((sn['name'], round(sn['currentReading'] * 10 ** sn['unitModifier'])))
            sensores.append({'nome': re.sub(r'^(Memory Device|Processor/IO Module|Processor|Add-in Card|External Environment) \d+ ', '', sn['name'])
                             .replace('Ambient', 'Ambiente').replace('Exhaust', 'Exaustão'),
                             'valor': temps[-1][1], 'estado': sn['healthState']['key']})

        def pega(*chaves):
            v = [t for n, t in temps if any(k in n for k in chaves)]
            return max(v) if v else None
        t = {'ambiente': pega('Ambient'), 'exaustao': pega('Exhaust'), 'cpu1': pega('CPU 1'), 'cpu2': pega('CPU 2'),
             'memoria': pega('DIMM'), 'pch': pega('PCH')}
        online = props.get('summary.runtime.connectionState') == 'connected'
        mhz = props.get('summary.hardware.cpuMhz') or 0
        lista_vm = []
        for v in sorted(vms.get(moid, []), key=lambda x: x['name'].lower()):
            sm = v['summary']
            q = sm.get('quickStats', {})
            ligada = v['runtime']['powerState'] == 'poweredOn'
            ncpu, mem = sm['config']['numCpu'], sm['config']['memorySizeMB']
            item = {'nome': v['name'], 'estado': 'ok' if ligada else 'fora', 'vcpu': ncpu, 'ram_gb': round(mem / 1024)}
            if ligada:
                item['ram'] = min(100, round(q.get('guestMemoryUsage', 0) / mem * 100))
                if mhz:
                    item['cpu'] = min(100, round(q.get('overallCpuUsage', 0) / (ncpu * mhz) * 100))
            lista_vm.append(item)
        hosts.append({'nome': nome, 'modelo': props.get('summary.hardware.model'),
                      'estado': 'fora' if not online else ('parcial' if pior else 'ok'),
                      'temps': {k: v for k, v in t.items() if v is not None}, 'sensores': sensores, 'vms': lista_vm})
    return hosts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out')
    ap.add_argument('--post')
    a = ap.parse_args()
    d = coletar(os.environ['ZBX_URL'], os.environ['ZBX_USER'], os.environ['ZBX_PASS'])
    txt = json.dumps(d, ensure_ascii=False, separators=(',', ':'))
    if a.out:
        open(a.out, 'w').write(txt)
    if a.post:
        req = urllib.request.Request(a.post, txt.encode(), {'Content-Type': 'application/json',
                                     'Authorization': 'Bearer ' + os.environ['INGEST_TOKEN']})
        urllib.request.urlopen(req, timeout=30).read()
    print(f"ok: {len(d['unidades'])} unidades ({sum(u['estado']!='ok' for u in d['unidades'])} com problema), "
          f"{len(d['vms'])} servidores, {len(d['esxi'])} ESXi, {len(d['sistemas'])} sistemas", file=sys.stderr)


if __name__ == '__main__':
    main()
