if (!Auth.logado()) location.replace('index.html');

const $ = (s, r = document) => r.querySelector(s);
const ESTADO = { ok: 'No ar', parcial: 'Parcial', fora: 'Fora' };
const ICO = { ok: '●', parcial: '▲', fora: '✕' };
let dados = null, filtro = 'todas';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const badge = st => `<span class="badge ${st}">${ICO[st]} ${ESTADO[st]}</span>`;

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

function render() {
  const d = dados, vmsOn = d.vms.filter(v => v.estado === 'ok').length;
  const sisProb = d.sistemas.filter(s => s.estado !== 'ok').length;
  const uniFora = d.unidades.filter(u => u.estado === 'fora').length;
  const r = d.rede;
  $('#kpis').innerHTML =
    kpi('VMs no ar', `${vmsOn}/${d.vms.length}`, 'servidores virtuais', vmsOn === d.vms.length ? 'ok' : 'parcial') +
    kpi('Sistemas com problema', sisProb, `de ${d.sistemas.length} monitorados`, sisProb ? 'fora' : 'ok') +
    kpi('Unidades fora', uniFora, `de ${d.unidades.length} unidades`, uniFora ? 'fora' : 'ok') +
    kpi('Equipamentos fora', r.switches.fora + r.aps.fora, 'switches e APs', (r.switches.fora + r.aps.fora) ? 'parcial' : 'ok');

  $('#vms-n').textContent = `${vmsOn}/${d.vms.length}`;
  $('#vms-grid').innerHTML = d.vms.map(v => `
    <article class="card item ${v.estado}">
      <header><h3>${esc(v.nome)}</h3>${badge(v.estado)}</header>
      <p class="muted">${esc(v.funcao)}</p>
      <div class="meters">
        <label>CPU <i style="--p:${v.cpu}"></i><em>${v.cpu}%</em></label>
        <label>RAM <i style="--p:${v.ram}"></i><em>${v.ram}%</em></label>
        <label>Disco <i style="--p:${v.disco}"></i><em>${v.disco}%</em></label>
      </div>
    </article>`).join('');

  $('#sis-n').textContent = `${d.sistemas.length - sisProb}/${d.sistemas.length} ok`;
  $('#sis-grid').innerHTML = d.sistemas.map(s => `
    <article class="card item ${s.estado}">
      <header><h3>${esc(s.nome)}</h3>${badge(s.estado)}</header>
      <p class="muted">${esc(s.detalhe)}</p>
      <small class="muted">${s.latencia_ms != null ? `${s.latencia_ms} ms` : 'sem resposta'}${s.desde ? ' · ' + desde(s.desde) : ''}</small>
    </article>`).join('');

  renderUnidades();

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

function renderUnidades() {
  const q = $('#busca').value.trim().toLowerCase();
  const lista = dados.unidades.filter(u =>
    (filtro === 'todas' || u.estado === filtro) && u.nome.toLowerCase().includes(q));
  $('#uni-n').textContent = `${dados.unidades.filter(u => u.estado === 'ok').length}/${dados.unidades.length} no ar`;
  $('#uni-grid').innerHTML = lista.length ? lista.map(u => `
    <article class="card item ${u.estado}">
      <header><h3>${esc(u.nome)}</h3>${badge(u.estado)}</header>
      <small class="muted">${u.estado === 'ok' ? 'tudo normal' : `${esc(u.motivo)} · ${desde(u.desde)}`}</small>
    </article>`).join('') : '<p class="muted">Nenhuma unidade encontrada.</p>';
}

async function carregar() {
  try {
    const r = await fetch('data/status.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    dados = await r.json();
    render();
  } catch (e) {
    const av = $('#aviso'); av.hidden = false; av.textContent = 'Não foi possível carregar os dados.';
  }
}

$('#sair').addEventListener('click', Auth.sair);
$('#busca').addEventListener('input', () => dados && renderUnidades());
$('#filtro').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  filtro = b.dataset.f;
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
  dados && renderUnidades();
});
document.querySelectorAll('#tabs a').forEach(a => a.addEventListener('click', () => {
  document.querySelectorAll('#tabs a').forEach(x => x.classList.toggle('on', x === a));
}));

carregar();
setInterval(carregar, 60000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
