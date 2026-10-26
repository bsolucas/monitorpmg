const { criarSessao, cookie, igual, DURACAO } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.PAINEL_USER || !process.env.PAINEL_PASS || !process.env.SESSION_SECRET)
    return res.status(503).json({ erro: 'servidor não configurado' });
  const { usuario = '', senha = '' } = req.body || {};
  const ok = igual(usuario, process.env.PAINEL_USER) & igual(senha, process.env.PAINEL_PASS);
  if (!ok) { await new Promise(r => setTimeout(r, 800)); return res.status(401).json({ erro: 'credenciais inválidas' }); }
  res.setHeader('Set-Cookie', cookie(criarSessao(), DURACAO));
  res.status(200).json({ ok: true });
};
