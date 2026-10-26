const $ = (s, r = document) => r.querySelector(s);
const ESTADO = { ok: 'No ar', parcial: 'Parcial', fora: 'Fora' };
let dados = null;
const esxiAberto = new Set();

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mini = (n, st, txt) => `<span class="mini ${st}${n ? '' : ' zero'}">${n} ${txt}</span>`;

function desde(iso) {
  if (!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ${m % 60} min` : `${Math.floor(h / 24)} d`;
}

function anel(ok, parcial, fora, total) {
  const R = 52, C = 2 * Math.PI * R, seg = (n, off, cor) =>
    n ? `<circle cx="64" cy="64" r="${R}" fill="none" stroke="${cor}" stroke-width="13" stroke-dasharray="${(n / total) * C} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 64 64)"/>` : '';
  const a = (ok / total) * C, b = (parcial / total) * C;
  return `<svg viewBox="0 0 128 128" class="anel" role="img" aria-label="${ok} de ${total} unidades no ar">
    <circle cx="64" cy="64" r="${R}" fill="none" stroke="var(--line)" stroke-width="13"/>
    ${seg(ok, 0, 'var(--ok)')}${seg(parcial, a, 'var(--parcial)')}${seg(fora, a + b, 'var(--fora)')}
    <text x="64" y="62" text-anchor="middle" class="anel-n">${ok}</text>
    <text x="64" y="82" text-anchor="middle" class="anel-t">de ${total}</text></svg>`;
}

function render() {
  const d = dados, un = d.unidades, total = un.length;
  const fora = un.filter(u => u.estado === 'fora'), parc = un.filter(u => u.estado === 'parcial'), ok = un.filter(u => u.estado === 'ok');
  const tudoOk = !fora.length && !parc.length;

  // ---- resumo
  $('#hero').className = 'hero card ' + (fora.length ? 'fora' : parc.length ? 'parcial' : 'ok');
  $('#hero').innerHTML = `
    ${anel(ok.length, parc.length, fora.length, total)}
    <div class="hero-txt">
      <h1>${tudoOk ? 'Tudo operacional' : fora.length ? `${fora.length} ${fora.length === 1 ? 'unidade sem link' : 'unidades sem link'}` : `${parc.length} com equipamento fora`}</h1>
      <p>${ok.length} de ${total} unidades no ar</p>
      <div class="stats">
        <span class="stat fora"><b>${fora.length}</b>sem link</span>
        <span class="stat parcial"><b>${parc.length}</b>parcial</span>
        <span class="stat ok"><b>${ok.length}</b>no ar</span>
      </div>
    </div>`;

  // ---- unidades com problema
  $('#prob-n').textContent = fora.length + parc.length || '';
  const luz = '<i class="dot fora glow"></i>';
  const cartao = u => `
    <article class="card un ${u.estado}">
      <header><h3>${esc(u.nome)}</h3><span class="tag ${u.estado}">${u.estado === 'fora' ? 'Sem link' : 'Parcial'}</span></header>
      <ul class="itens">
        ${u.estado === 'fora'
          ? `<li>${luz}<span><b>Mikrotik</b> sem link</span><time>${desde(u.mikrotik.desde)}</time></li>`
          : u.equipamentos_fora.map(e => `<li>${luz}<span><b>${esc(e.tipo)}</b> ${esc(e.nome)}</span><time>${desde(e.desde)}</time></li>`).join('')}
      </ul>
    </article>`;
  $('#prob').innerHTML = tudoOk ? '<div class="card vazio">✓ Todas as unidades estão no ar</div>' : [...fora, ...parc].map(cartao).join('');

  // ---- todas as unidades
  $('#todas-res').innerHTML = mini(ok.length, 'ok', 'no ar') + mini(parc.length, 'parcial', 'parcial') + mini(fora.length, 'fora', 'fora');
  tiles();

  // ---- equipamentos
  const r = d.rede, eqFora = un.flatMap(u => u.equipamentos_fora.map(e => ({ ...e, unidade: u.nome })))
    .sort((a, b) => new Date(a.desde) - new Date(b.desde));
  const nfora = r.switches.fora + r.aps.fora + r.ubiquiti.fora;
  $('#equip-res').innerHTML = mini(nfora, nfora ? 'parcial' : 'ok', 'fora');
  const caixa = (t, o) => `<div class="caixa"><span>${t}</span><b>${o.on}<small>/${o.total}</small></b><em class="${o.fora ? 'parcial' : 'ok'}">${o.fora ? o.fora + ' fora' : 'todos no ar'}</em></div>`;
  $('#equip-body').innerHTML = `
    <div class="caixas">${caixa('Switches TP-Link', r.switches)}${caixa('APs TP-Link', r.aps)}${caixa('APs Ubiquiti', r.ubiquiti)}</div>
    <h4>Equipamentos fora</h4>
    ${eqFora.length ? `<ul class="rows">${eqFora.map(e => `<li><i class="dot fora glow"></i>
      <span class="r-t"><b>${esc(e.nome)}</b><small>${esc(e.unidade)}</small></span><time>${desde(e.desde)}</time></li>`).join('')}</ul>`
      : '<p class="muted">Nenhum equipamento fora.</p>'}`;

  // ---- servidores
  const sv = d.vms, sOk = sv.filter(v => v.estado === 'ok').length, sFora = sv.filter(v => v.estado === 'fora').length, sPar = sv.length - sOk - sFora;
  $('#srv-res').innerHTML = mini(sOk, 'ok', 'no ar') + (sPar ? mini(sPar, 'parcial', 'alerta') : '') + mini(sFora, 'fora', 'fora');
  const barra = (n, v) => v == null ? '' : `<span class="bar" title="${n} ${v}%"><i style="--p:${v}"></i><em>${n} ${v}%</em></span>`;
  $('#srv-body').innerHTML = `<ul class="rows">${sv.map(v => `
    <li class="${v.estado}"><i class="dot ${v.estado}"></i>
      <span class="r-t"><b>${esc(v.nome)}</b>${v.estado === 'fora' ? '<small>sem resposta</small>' : ''}</span>
      <span class="barras">${v.estado === 'fora' ? '' : barra('CPU', v.cpu) + barra('RAM', v.ram) + barra('Disco', v.disco)}</span></li>`).join('')}</ul>`;

  // ---- hosts ESXi (temperaturas)
  const ex = d.esxi || [];
  $('#esxi').hidden = !ex.length;
  const eOk = ex.filter(h => h.estado === 'ok').length, eFora = ex.filter(h => h.estado === 'fora').length, ePar = ex.length - eOk - eFora;
  $('#esxi-res').innerHTML = mini(eOk, 'ok', 'normal') + (ePar ? mini(ePar, 'parcial', 'quente') : '') + (eFora ? mini(eFora, 'fora', 'fora') : '');
  const ROT = { ambiente: 'Ambiente', exaustao: 'Exaustão', cpu1: 'CPU 1', cpu2: 'CPU 2', memoria: 'Memória', pch: 'Chipset' };
  const grau = (k, v) => `<span class="temp ${v >= (k === 'ambiente' ? 35 : k === 'exaustao' ? 45 : 80) ? 'fora' : v >= (k === 'ambiente' ? 30 : k === 'exaustao' ? 40 : 70) ? 'parcial' : 'ok'}"><small>${ROT[k]}</small><b>${v}°C</b></span>`;
  $('#esxi-body').innerHTML = ex.map(h => `
    <details class="sub ${h.estado}" data-h="${esc(h.nome)}"${esxiAberto.has(h.nome) ? ' open' : ''}>
      <summary><i class="dot ${h.estado}"></i><span class="r-t"><b>${esc(h.nome)}</b><small>${h.estado === 'fora' ? 'sem resposta' : esc(h.modelo || '')}</small></span>
        <span class="temps">${['ambiente', 'cpu1', 'cpu2'].filter(k => h.temps && h.temps[k] != null).map(k => grau(k, h.temps[k])).join('')}</span></summary>
      <ul class="rows">${(h.sensores || []).map(x => `<li><i class="dot ${x.estado === 'Green' || x.estado === 'Unknown' ? 'ok' : x.estado === 'Yellow' ? 'parcial' : 'fora'}"></i>
        <span class="r-t"><b>${esc(x.nome)}</b></span><b class="grau">${x.valor}°C</b></li>`).join('') || '<li class="muted">Sem leitura de sensores.</li>'}</ul>
    </details>`).join('');
  $('#esxi-body').querySelectorAll('details.sub').forEach(el => el.addEventListener('toggle', () => esxiAberto[el.open ? 'add' : 'delete'](el.dataset.h)));

  // ---- sistemas
  const ss = d.sistemas, sProb = ss.filter(s => s.estado !== 'ok').length;
  $('#sis-res').innerHTML = mini(ss.length - sProb, 'ok', 'ok') + (sProb ? mini(sProb, 'parcial', 'com problema') : '');
  $('#sis-body').innerHTML = `<ul class="rows">${ss.map(s => `
    <li class="${s.estado}"><i class="dot ${s.estado}"></i>
      <span class="r-t"><b>${esc(s.nome)}</b><small>${esc(s.detalhe || '')}</small></span>
      <span class="tag ${s.estado}">${ESTADO[s.estado]}</span></li>`).join('')}</ul>`;

  // ---- topo
  const idade = (Date.now() - new Date(d.gerado_em)) / 60000, p = $('#atualizado');
  p.textContent = idade < 1 ? 'atualizado agora' : `há ${desde(d.gerado_em)}`;
  p.className = 'pill' + (idade > 10 ? ' velho' : '');
  const av = $('#aviso'); av.hidden = idade <= 10;
  av.textContent = `Atenção: os dados têm ${Math.round(idade)} min. O envio da rede interna pode estar parado.`;
}

function tiles() {
  const q = $('#busca').value.trim().toLowerCase();
  const ordem = { fora: 0, parcial: 1, ok: 2 };
  const l = dados.unidades.filter(u => u.nome.toLowerCase().includes(q)).sort((a, b) => ordem[a.estado] - ordem[b.estado] || a.nome.localeCompare(b.nome));
  $('#tiles').innerHTML = l.length ? l.map(u => `<span class="tile ${u.estado}" title="${ESTADO[u.estado]}"><i class="dot ${u.estado}"></i>${esc(u.nome)}</span>`).join('')
    : '<p class="muted">Nenhuma unidade encontrada.</p>';
}

async function carregar() {
  try {
    let r = await fetch('/api/status', { cache: 'no-store' }).catch(() => ({ status: 404 }));
    if (r.status === 401) return location.replace('index.html');
    if (r.status === 404 || r.status === 501) { // sem backend (teste local): dados de demonstração
      if (!Auth.demo()) return location.replace('index.html');
      r = await fetch('data/status.json?t=' + Date.now(), { cache: 'no-store' });
    }
    if (r.status === 204) throw new Error('ainda sem dados');
    if (!r.ok) throw new Error(r.status);
    dados = await r.json();
    render();
  } catch (e) {
    const av = $('#aviso'); av.hidden = false; av.textContent = 'Não foi possível carregar os dados.';
  }
}

// lembra quais listas ficaram abertas (a lista de unidades abre sozinha em tela grande)
const lido = k => { try { return localStorage.getItem('painel.' + k); } catch (e) { return null; } };
const grava = (k, v) => { try { localStorage.setItem('painel.' + k, v); } catch (e) {} };
document.querySelectorAll('details.acc').forEach(el => {
  const v = lido(el.dataset.k);
  el.open = v === null ? (el.id === 'todas' && innerWidth >= 820) : v === '1';
  el.addEventListener('toggle', () => grava(el.dataset.k, el.open ? '1' : '0'));
});

$('#busca').addEventListener('input', () => dados && tiles());
$('#sair').addEventListener('click', Auth.sair);
carregar();
setInterval(carregar, 60000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
