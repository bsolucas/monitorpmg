// Utilitários das funções: sessão por cookie assinado e acesso ao Upstash Redis (REST).
const crypto = require('crypto');

const DURACAO = 12 * 3600; // segundos
const SEGREDO = () => process.env.SESSION_SECRET || process.env.INGEST_TOKEN || 'painel-guaiba-sessao';
const assinar = v => crypto.createHmac('sha256', SEGREDO()).update(v).digest('hex');
const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function criarSessao() {
  const exp = String(Math.floor(Date.now() / 1000) + DURACAO);
  return `${exp}.${assinar(exp)}`;
}
function sessaoValida(req) {
  const m = /(?:^|;\s*)painel=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const [exp, sig] = decodeURIComponent(m[1]).split('.');
  return !!sig && igual(sig, assinar(exp)) && Number(exp) > Date.now() / 1000;
}
const cookie = (v, seg) => `painel=${encodeURIComponent(v)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${seg}`;

// A Vercel cria as variáveis como UPSTASH_REDIS_REST_* ou KV_REST_API_*, conforme a integração.
const REDIS_URL = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function redis(cmd) {
  if (!REDIS_URL() || !REDIS_TOKEN()) throw new Error('redis não configurado');
  const r = await fetch(REDIS_URL(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).result;
}
module.exports = { criarSessao, sessaoValida, cookie, igual, redis, DURACAO };
