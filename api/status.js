const { sessaoValida, redis } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!sessaoValida(req)) return res.status(401).json({ erro: 'não autenticado' });
  try {
    const txt = await redis(['GET', 'painel:status']);
    if (!txt) return res.status(204).end();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(txt);
  } catch (e) { res.status(502).json({ erro: 'armazenamento indisponível' }); }
};
