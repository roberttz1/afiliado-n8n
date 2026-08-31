# afiliado-n8n

**Sistema Automatizado de Grupos de Ofertas no WhatsApp**

Stack: n8n + EvoGO (WhatsApp) + Supabase (PostgreSQL) + Claude Sonnet 4 + Next.js 15 Dashboard

## Nicho MVP
- 🎯 **Tênis** (alta demanda, boas margens, público engajado)
- Arquitetura **multi-nicho** pronta para expansão (Casa, Perfumes, Eletrônicos, etc.)

## Arquitetura
```
[Coletores de Ofertas]  →  [Supabase: ofertas]  →  [Validador + IA Claude Sonnet 4]
                                                          ↓
[Dashboard Next.js] ←  [Métricas]  ←  [Fila de Envio c/ Throttle]
                                                          ↓
                                      [EvoGO WhatsApp API + Rotação de Grupos]
```

## Stack Técnica
| Camada | Tecnologia |
|---|---|
| **Dashboard/Backend** | Next.js 15 (App Router) |
| **Banco de Dados** | Supabase (PostgreSQL Cloud) |
| **Gateway WhatsApp** | EvoGO (Evolution Go) |
| **Orquestração** | n8n (Self-hosted na VPS Virattiva) |
| **IA Copywriting** | Claude API (Sonnet 4) |
| **Proxy & SSL** | Caddy v2 |

## Workflows n8n (Suíte Completa)
1. **wf_01** — Coletor e Conversor Universal (Amazon ASIN, Shopee GraphQL, Mercado Livre)
2. **wf_02** — Validador + Copywriter IA (Claude Sonnet 4)
3. **wf_03** — Agendador de Fila de Envios (throttle 5-10min + jitter 8h-22h)
4. **wf_04** — Disparador WhatsApp via EvoGO (`sendMedia`)
5. **wf_05** — Monitor de Grupos + Rotação Automática (950 membros)
6. **wf_06** — Reset Diário de Contadores

## Estrutura do Repositório
```
/
├── Produção/             ← Arquivos validados e prontos para uso
│   ├── .env              ← Variáveis de ambiente (NÃO commitar - gitignored)
│   ├── migrations/       ← Schema Supabase (SQL)
│   ├── n8n-workflows/    ← JSONs dos 6 workflows n8n
│   └── deploy_workflows.py ← Deploy autônomo na VPS
├── Grupo de whats/       ← Documentação, brainstorming e arquivos de desenvolvimento
│   ├── brain-projeto-grupos-ofertas.md
│   ├── dashboard/        ← Next.js 15 app
│   ├── docker/           ← docker-compose.yml + Caddyfile
│   └── scraper/          ← Python scraper (fallback)
└── AGENTE_CONHECIMENTO_BASE.md
```

## Política de Commits
> Somente commits para mudanças **estruturais significativas** que alterem a arquitetura do sistema ou representem risco à operação.

## Configuração
```bash
cp Produção/.env.example Produção/.env
# Preencha as variáveis obrigatórias: Supabase, ANTHROPIC_API_KEY, EVOGO_API_KEY
```

## Deploy
```bash
# 1. Rodar schema no Supabase (SQL Editor)
# 2. Deploy dos workflows no n8n
python Produção/deploy_workflows.py --vps-pass SENHA_ROOT

# 3. Ativar workflows no painel: https://n8n.virattiva.cloud
```
