const { igual, redis } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const tok = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!process.env.INGEST_TOKEN || !igual(tok, process.env.INGEST_TOKEN)) return res.status(401).end();
  const d = req.body;
  if (!d || !Array.isArray(d.unidades) || !Array.isArray(d.vms) || !d.gerado_em) return res.status(400).json({ erro: 'formato inválido' });
  const txt = JSON.stringify(d);
  if (txt.length > 500000) return res.status(413).end();
  try { await redis(['SET', 'painel:status', txt]); res.status(200).json({ ok: true }); }
  catch (e) { res.status(502).json({ erro: 'armazenamento indisponível' }); }
};
