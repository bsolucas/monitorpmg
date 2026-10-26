// Login no servidor (cookie HttpOnly). Sem API (teste local em http.server) cai no modo demonstração.
const Auth = (() => {
  const DEMO = 'painel.demo';
  const get = () => { try { return sessionStorage.getItem(DEMO); } catch (e) { return null; } };
  return {
    demo: () => !!get(),
    async entrar(usuario, senha) {
      let r;
      try {
        r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario, senha }) });
      } catch (e) { r = { status: 404 }; }
      if (r.status === 404 || r.status === 501) { // sem backend: demonstração local
        if (usuario === 'admin' && senha === 'admin') { try { sessionStorage.setItem(DEMO, '1'); } catch (e) {} return true; }
        return false;
      }
      return r.ok;
    },
    async sair() {
      try { sessionStorage.removeItem(DEMO); await fetch('/api/logout', { method: 'POST' }); } catch (e) {}
      location.replace('index.html');
    },
  };
})();
