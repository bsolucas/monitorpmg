const { cookie } = require('./_lib');
module.exports = (req, res) => { res.setHeader('Set-Cookie', cookie('', 0)); res.status(200).json({ ok: true }); };
