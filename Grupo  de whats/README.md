# Grupos de Ofertas WhatsApp — Sistema Automatizado

Sistema profissional de automação de grupos de ofertas no WhatsApp com afiliados.

## Stack
- **Backend/API**: Node.js (Next.js API Routes)
- **Dashboard**: Next.js 15 (App Router)
- **Banco de Dados**: Supabase (PostgreSQL)
- **Orquestração**: n8n (self-hosted)
- **WhatsApp Gateway**: EvoGO (Evolution Go — alta performance em Go)
- **IA**: Claude API (Sonnet 4)
- **Scraper**: Python (httpx + selectolax)
- **Infra**: Docker Compose + Caddy

## Estrutura
```
├── dashboard/          # Next.js dashboard + API
├── scraper/            # Python scraper (fallback)
├── migrations/         # SQL migrations para Supabase
├── n8n-workflows/      # Workflows exportados do n8n
├── docker/             # Docker Compose e configs
├── docs/               # Documentação
└── .env.example        # Template de variáveis de ambiente
```

## Como rodar
1. Preencha o `.env` com suas credenciais (veja `checklist-credenciais.md`)
2. Execute as migrations no Supabase
3. Suba os containers Docker (`docker compose up -d`)
4. Acesse o dashboard em `https://seudominio.com`
