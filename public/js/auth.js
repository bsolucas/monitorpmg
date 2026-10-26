// Login provisório de demonstração (admin/admin), só no navegador.
// NÃO protege dados reais: antes de publicar dados verdadeiros, trocar por
// autenticação no servidor (função em /api com sessão/cookie).
const Auth = (() => {
  const CHAVE = 'painel.sessao';
  return {
    entrar(u, p) {
      if (u === 'admin' && p === 'admin') {
        sessionStorage.setItem(CHAVE, String(Date.now()));
        return true;
      }
      return false;
    },
    logado() { return !!sessionStorage.getItem(CHAVE); },
    sair() { sessionStorage.removeItem(CHAVE); location.replace('index.html'); },
  };
})();
