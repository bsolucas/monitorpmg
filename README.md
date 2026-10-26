# Painel de Status · Guaíba

Site estático (HTML + CSS + JS, PWA) que mostra o status de VMs, sistemas, unidades e equipamentos de rede.
Lê `public/data/status.json`. Por enquanto os dados são de **demonstração**.

## Estrutura
- `public/` — o site (publicado no Vercel)
  - `index.html` login · `painel.html` painel · `css/` · `js/` · `data/status.json` · `sw.js` · `manifest.webmanifest`
- `collector/` — (a fazer) script na rede interna que lê o Zabbix e envia o JSON por HTTPS de saída
- `api/` — (a fazer) funções Vercel que recebem o JSON (com token) e entregam ao site

## Como funciona
```
Zabbix -> collector/collector.py (VM interna, cron 1 min) --HTTPS de saida--> /api/ingest (Vercel) -> Upstash Redis
navegador -> /api/login (cookie HttpOnly) -> /api/status -> painel
```
Nenhuma porta da rede interna e aberta. O JSON leva so nomes e estados (sem IP/MAC/credenciais).

## Configurar na Vercel (Settings -> Environment Variables)
| Variavel | Valor |
|---|---|
| `PAINEL_USER` / `PAINEL_PASS` | (opcional) login do painel; sem elas vale `admin` / `admin` |
| `SESSION_SECRET` | (opcional) texto aleatorio longo |
| `INGEST_TOKEN` | token aleatorio longo, o mesmo usado no coletor |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | criados ao adicionar Upstash Redis (Storage / Marketplace) |

## Coletor (na VM interna)
`ZBX_URL`, `ZBX_USER`, `ZBX_PASS`, `INGEST_TOKEN` no ambiente (arquivo `.env` com chmod 600, fora do git) e:
`python3 collector/collector.py --post https://SEU-SITE.vercel.app/api/ingest`
Cron: `* * * * * set -a; . /caminho/.env; set +a; python3 /caminho/collector/collector.py --post URL`

## Teste local (sem backend, dados de demonstracao)
`cd public && python3 -m http.server 8080` e abrir http://localhost:8080 (modo demo: admin / admin)

## Seguranca
Repositorio privado; coletor com usuario Zabbix somente leitura; trocar `INGEST_TOKEN` se vazar.
