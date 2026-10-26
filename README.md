# Painel de Status · Guaíba

Site estático (HTML + CSS + JS, PWA) que mostra o status de VMs, sistemas, unidades e equipamentos de rede.
Lê `public/data/status.json`. Por enquanto os dados são de **demonstração**.

## Estrutura
- `public/` — o site (publicado no Vercel)
  - `index.html` login · `painel.html` painel · `css/` · `js/` · `data/status.json` · `sw.js` · `manifest.webmanifest`
- `collector/` — (a fazer) script na rede interna que lê o Zabbix e envia o JSON por HTTPS de saída
- `api/` — (a fazer) funções Vercel que recebem o JSON (com token) e entregam ao site

## Rodar localmente
`cd public && python3 -m http.server 8080` e abrir http://localhost:8080 (login provisório: admin / admin)

## Segurança (antes de usar dados reais)
O login admin/admin é só do navegador e **não protege nada**. Para dados reais: autenticação no servidor
(função em `api/`), JSON sem IPs/credenciais, token de envio só na VM, repositório privado.
