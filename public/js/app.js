const $ = (s, r = document) => r.querySelector(s);
const ESTADO = { ok: 'No ar', parcial: 'Parcial', fora: 'Fora' };
const ICO = { ok: '●', parcial: '▲', fora: '✕' };
let dados = null;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const badge = st => `<span class="badge ${st}">${ICO[st]} ${ESTADO[st]}</span>`;
const chip = (n, st, txt) => `<span class="mini ${st}${n ? '' : ' zero'}">${n} ${txt}</span>`;

function desde(iso) {
  if (!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `há ${h} h ${m % 60} min` : `há ${Math.floor(h / 24)} d`;
}

function kpi(rotulo, valor, sub, tom) {
  return `<div class="card kpi ${tom || ''}"><span>${esc(rotulo)}</span><b>${esc(valor)}</b><small>${esc(sub || '')}</small></div>`;
}

function cartaoServidor(v) {
  return `
    <article class="card item ${v.estado}">
      <header><h3>${esc(v.nome)}</h3>${badge(v.estado)}</header>
      ${v.funcao ? `<p class="muted">${esc(v.funcao)}</p>` : ''}
      ${v.estado === 'fora' ? '<small class="muted">sem resposta</small>' : `
      <div class="meters">${[['CPU', v.cpu], ['RAM', v.ram], ['Disco', v.disco]].filter(m => m[1] != null)
        .map(m => `<label>${m[0]} <i style="--p:${m[1]}"></i><em>${m[1]}%</em></label>`).join('')}</div>`}
    </article>`;
}

function grupo(titulo, st, lista, html) {
  if (!lista.length) return '';
  return `<h3 class="grp ${st}">${titulo} <span>${lista.length}</span></h3><div class="grid">${lista.map(html).join('')}</div>`;
}

function render() {
  const d = dados, r = d.rede;
  const srvOk = d.vms.filter(v => v.estado === 'ok'), srvPar = d.vms.filter(v => v.estado === 'parcial'), srvFora = d.vms.filter(v => v.estado === 'fora');
  const sisProb = d.sistemas.filter(s => s.estado !== 'ok');
  const uniProb = d.unidades.filter(u => u.estado !== 'ok');
  const uniFora = d.unidades.filter(u => u.estado === 'fora').length;
  const redeFora = r.switches.fora + r.aps.fora + r.ubiquiti.fora;

  $('#kpis').innerHTML =
    kpi('Unidades com problema', uniProb.length, `${uniFora} sem link · de ${d.unidades.length}`, uniProb.length ? 'fora' : 'ok') +
    kpi('Servidores no ar', `${srvOk.length + srvPar.length}/${d.vms.length}`, `${srvFora.length} fora`, srvFora.length ? 'fora' : 'ok') +
    kpi('Sistemas com problema', sisProb.length, `de ${d.sistemas.length} monitorados`, sisProb.length ? 'parcial' : 'ok') +
    kpi('Equipamentos fora', redeFora, 'switches e APs', redeFora ? 'parcial' : 'ok');

  // Unidades: sempre aberta, só o que está fora
  $('#uni-res').innerHTML = chip(uniFora, 'fora', 'sem link') + chip(uniProb.length - uniFora, 'parcial', 'parcial');
  $('#uni-body').innerHTML = uniProb.length ? `<div class="grid">${uniProb.map(u => `
    <article class="card item ${u.estado}">
      <header><h3>${esc(u.nome)}</h3>${badge(u.estado)}</header>
      <ul class="lista">
        ${u.mikrotik.estado === 'fora' ? `<li><b>Mikrotik</b> sem link <small>${desde(u.mikrotik.desde)}</small></li>` : ''}
        ${u.equipamentos_fora.map(e => `<li><b>${esc(e.tipo)}</b> ${esc(e.nome)} <small>${desde(e.desde)}</small></li>`).join('')}
      </ul>
    </article>`).join('')}</div>`
    : '<div class="card vazio">✓ Todas as unidades estão no ar</div>';

  // Servidores
  $('#srv-res').innerHTML = chip(srvOk.length, 'ok', 'no ar') + chip(srvPar.length, 'parcial', 'alerta') + chip(srvFora.length, 'fora', 'fora');
  $('#srv-body').innerHTML =
    grupo('Fora', 'fora', srvFora, cartaoServidor) + grupo('Com alerta', 'parcial', srvPar, cartaoServidor) + grupo('No ar', 'ok', srvOk, cartaoServidor);

  // Sistemas
  $('#sis-res').innerHTML = chip(d.sistemas.length - sisProb.length, 'ok', 'ok') + chip(sisProb.length, sisProb.length ? 'parcial' : 'ok', 'com problema');
  $('#sis-grid').innerHTML = d.sistemas.map(s => `
    <article class="card item ${s.estado}">
      <header><h3>${esc(s.nome)}</h3>${badge(s.estado)}</header>
      <p class="muted">${esc(s.detalhe)}</p>
      <small class="muted">${s.latencia_ms != null ? `${s.latencia_ms} ms` : 'sem resposta'}${s.desde ? ' · ' + desde(s.desde) : ''}</small>
    </article>`).join('');

  // Rede
  $('#rede-res').innerHTML = chip(redeFora, redeFora ? 'parcial' : 'ok', 'fora');
  const linha = (t, o) => `
    <article class="card item ${o.fora ? 'parcial' : 'ok'}">
      <header><h3>${t}</h3>${badge(o.fora ? 'parcial' : 'ok')}</header>
      <div class="big"><b>${o.on}</b><span>/ ${o.total} no ar</span></div>
      <small class="muted">${o.fora} fora</small>
    </article>`;
  $('#rede-grid').innerHTML = linha('Switches TP-Link', r.switches) + linha('APs TP-Link', r.aps) + linha('APs Ubiquiti', r.ubiquiti);

  const idade = (Date.now() - new Date(d.gerado_em)) / 60000;
  const p = $('#atualizado');
  p.textContent = idade < 1 ? 'atualizado agora' : `atualizado ${desde(d.gerado_em)}`;
  p.className = 'pill' + (idade > 10 ? ' velho' : '');
  const av = $('#aviso');
  av.hidden = idade <= 10;
  av.textContent = `Atenção: os dados têm ${Math.round(idade)} min. O envio da rede interna pode estar parado.`;
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

// lembra quais seções o usuário deixou abertas
const lembrar = (k, v) => { try { v === undefined ? localStorage.getItem('painel.' + k) : localStorage.setItem('painel.' + k, v); } catch (e) {} };
const lido = k => { try { return localStorage.getItem('painel.' + k); } catch (e) { return null; } };
document.querySelectorAll('details.sec').forEach(el => {
  if (lido(el.dataset.k) === '1') el.open = true;
  el.addEventListener('toggle', () => lembrar(el.dataset.k, el.open ? '1' : '0'));
});

// aba abre a seção correspondente
document.querySelectorAll('#tabs a').forEach(a => a.addEventListener('click', () => {
  document.querySelectorAll('#tabs a').forEach(x => x.classList.toggle('on', x === a));
  const alvo = document.querySelector(a.getAttribute('href'));
  if (alvo && alvo.tagName === 'DETAILS') alvo.open = true;
}));

$('#sair').addEventListener('click', Auth.sair);
carregar();
setInterval(carregar, 60000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
