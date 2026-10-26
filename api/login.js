const { criarSessao, cookie, igual, DURACAO } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const { usuario = '', senha = '' } = req.body || {};
  const ok = igual(usuario, process.env.PAINEL_USER || 'admin') & igual(senha, process.env.PAINEL_PASS || 'admin');
  if (!ok) { await new Promise(r => setTimeout(r, 800)); return res.status(401).json({ erro: 'credenciais inválidas' }); }
  res.setHeader('Set-Cookie', cookie(criarSessao(), DURACAO));
  res.status(200).json({ ok: true });
};
