// Instalação como app (PWA). Qualquer elemento com [data-instalar] vira o botão "Instalar app".
const Pwa = (() => {
  let evento = null;
  const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const botoes = () => document.querySelectorAll('[data-instalar]');
  const atualizar = () => botoes().forEach(b => { b.hidden = instalado(); });

  function dica() {
    let d = document.getElementById('dica-instalar');
    if (!d) {
      d = document.createElement('dialog');
      d.id = 'dica-instalar';
      d.innerHTML = '<h3>Instalar o painel</h3><div class="dica-corpo"></div><button class="btn" type="button">Entendi</button>';
      d.querySelector('button').onclick = () => d.close();
      d.addEventListener('click', e => { if (e.target === d) d.close(); });
      document.body.appendChild(d);
    }
    d.querySelector('.dica-corpo').innerHTML = ios()
      ? '<ol><li>Toque no botão <b>Compartilhar</b> (quadrado com seta para cima), na barra do Safari.</li><li>Role e toque em <b>Adicionar à Tela de Início</b>.</li><li>Toque em <b>Adicionar</b>.</li></ol>'
      : '<ol><li>Abra o menu do navegador (⋮ ou ⋯).</li><li>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li></ol><p class="muted">No Chrome ou Edge do computador, use o ícone de instalar na barra de endereço.</p>';
    d.showModal();
  }

  async function instalar() {
    if (!evento) return dica();
    evento.prompt();
    await evento.userChoice.catch(() => {});
    evento = null;
    atualizar();
  }

  addEventListener('beforeinstallprompt', e => { e.preventDefault(); evento = e; atualizar(); });
  addEventListener('appinstalled', () => { evento = null; atualizar(); });
  document.addEventListener('DOMContentLoaded', () => {
    botoes().forEach(b => b.addEventListener('click', instalar));
    atualizar();
  });
  return { instalar };
})();
