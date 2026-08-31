# 🧠 Brain do Projeto — Sistema Automatizado de Grupos de Ofertas WhatsApp

> **Base de Conhecimento Central & Documento de Arquitetura Mestre**
> Este arquivo consolida todas as decisões técnicas, know-how das plataformas de afiliados, estratégias anti-banimento, esquemas de banco de dados e arquitetura de software desenvolvida ao longo do projeto.

---

## 🎯 1. Visão Geral e Modelo de Negócio

- **Objetivo**: Construir um sistema 100% automatizado para gerenciar grupos de ofertas no WhatsApp, capturando cupons e grandes descontos de e-commerces, convertendo em links de afiliado com tag rastreável, gerando títulos persuasivos via IA (Claude/Gemini/ChatGPT) e disparando com intervalo humanizado para monetizar via comissões.
- **Nicho de Entrada (MVP)**: **Tênis** (alta demanda, boas margens, público engajado).
- **Escalabilidade**: O sistema foi projetado para ser **multinicho** (`nicho` como parâmetro dinâmico), permitindo expandir facilmente para *Casa*, *Perfumes*, *Eletrônicos*, etc., apenas adicionando novas rotas e grupos.

---

## 🛠️ 2. Stack Tecnológica Definitiva

| Camada                        | Tecnologia                            | Justificativa                                                                                                   |
| ----------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Dashboard / Backend** | Next.js 15 (App Router, Standalone)   | Painel visual completo, SSR rápido, APIs nativas                                                               |
| **Banco de Dados**      | Supabase (PostgreSQL Cloud)           | 8 tabelas relacionais, RLS, triggers, views e functions                                                         |
| **Gateway WhatsApp**    | **EvoGO (Evolution Go)**        | Engine escrita em Go — ultra-leve, consumo mínimo de RAM e altíssima performance para múltiplas instâncias |
| **Orquestração**      | n8n (Self-hosted via Docker)          | Workflows visuais para agendamento, captura e envio                                                             |
| **IA Copywriting**      | Claude API (Sonnet 4)                 | Modelo otimizado para gerar títulos curtos e chamativos em pt-BR                                               |
| **Scraper Fallback**    | Python 3 (`httpx` + `selectolax`) | Coleta leve e async apenas quando as APIs oficiais não cobrirem                                                |
| **Proxy & SSL**         | Caddy v2                              | HTTPS/SSL automático para Dashboard, EvoGO e n8n                                                               |
| **Containers**          | Docker Compose                        | Tudo containerizado para deploy simples com 1 comando                                                           |

---

## 🛒 3. Know-How por Plataforma de Afiliados

### A. 📦 Amazon Brasil (Amazon Associates)

- **Conversão por ASIN**: Extração do código ASIN (10 caracteres) via Regex e montagem do link direto limpo: `https://www.amazon.com.br/dp/{ASIN}?tag={SUA_TAG-20}`.
- **Encurtador via Cookie (amzn.to)**: O n8n utiliza os cookies de sessão do Amazon Associates (`session-id` e `ubid-acbbr`) via nó HTTP Request para chamar o endpoint interno do SiteStripe e gerar o link encurtado oficial.

### B. 🟡 Mercado Livre (Mercado Livre Afiliados)

- **Técnica de Cookie Refresh**: O n8n renova e mantém os cookies de autenticação (`org_session`, `ssid`, `affiliate_tag`) ativos. Quando um link entra no fluxo, o n8n faz a requisição para o gerador interno do portal do ML, retornando o link rastreável oficial (`meli.la/XXXX` ou `mercadolivre.com/sec/XXXX`).
- **Lomadee API (Fallback)**: Integração com a API da Lomadee para geração de deeplinks caso a sessão expire.

### C. 🟠 Shopee (Shopee Affiliate Program)

- **GraphQL Open API Oficial**: Utilização da mutation `generateShortLink` via endpoint `open-api.affiliate.shopee.com.br/graphql` passando o `originUrl` e `subId`.
- **Universal Link**: Fallback via parâmetro `&sub_id=SEU_ID`.

### D. 🔵 Netshoes & Centauro

- Integrados via **API da Lomadee**, filtrando ofertas por `merchant_id` com desconto mínimo de 30%.

### E. 🧡 Shein BR

- Cadastro no programa de afiliados nativo BR (`br.shein.com`) ou via rede **Awin**.

---

## 🛡️ 4. Gestão de Grupos & Protocolo Anti-Banimento WhatsApp

### A. Rotação Automática e o "Link Estável" (`/api/entrar`)

O WhatsApp não possui redirecionamento nativo quando um grupo atinge a capacidade (950 membros).

- **A Solução**: O sistema disponibiliza a rota HTTP 302 `/api/entrar?nicho=tenis`.
- **Como funciona**: Esta é a URL colocada na bio do Instagram, anúncios ou TikTok. Quando o usuário clica:
  1. O backend busca o grupo ativo mais recente do nicho no Supabase.
  2. Registra o clique e os parâmetros de UTM na tabela `cliques` (com hash de IP para conformidade com a LGPD).
  3. Redireciona o usuário para o link de convite do grupo ativo.
- Quando o grupo atinge 950 membros, o sistema cria o próximo grupo (`Tênis Ofertas | N+1`) via EvoGO e altera o status do antigo para `cheio`. A URL de divulgação **nunca muda**.

### B. Protocolo de Aquecimento de Chips (10 Passos)

1. Ativar chip SIM pré-pago físico em celular real por 3 dias.
2. Criar perfil completo (foto real, nome, bio).
3. Ativar verificação em 2 etapas (2FA).
4. Conversar e trocar mensagens com 10+ contatos reais.
5. Fazer 3+ chamadas de voz.
6. Entrar em 5+ grupos ativos do dia a dia (sem disparar links).
7. Manter uso humano por 10 dias sem automação.
8. Só então conectar à instância do EvoGO.
9. Iniciar automação em 1 grupo de teste (máx. 5 ofertas/dia).
10. Escalar gradualmente ao longo de 2 semanas.

### C. Regras de Throttle Inteligente

- **Intervalo de Envio**: 5 a 10 minutos (configurável via dashboard), com variação aleatória de jitter (±30s) para simular envio humano.
- **Janela de Operação**: Envios somente entre **8h e 22h** (BRT).
- **Rate Limit por Instância**: Máximo de 20 mensagens/hora por chip.

---

## 🗄️ 5. Esquema do Banco de Dados (Supabase PostgreSQL)

O banco é composto por **8 tabelas interligadas**, views e funções automatizadas em PL/pgSQL:

1. `ofertas`: Armazena os produtos coletados, títulos originais, títulos gerados por IA, preços, cupons, links de afiliado e hash de desduplicação.
2. `instancias`: Gerencia as conexões de WhatsApp no EvoGO, limites por hora e status dos chips.
3. `grupos`: Registra cada grupo de WhatsApp (nicho, sequencial, qtd_membros, capacidade, status).
4. `envios`: Fila de agendamento de mensagens com cálculo de slot futuro.
5. `comissoes`: Registro de vendas e comissões por plataforma (manual ou via API).
6. `cliques`: Log de tráfego da rota `/api/entrar` com UTMs (`utm_source`, `utm_campaign`, etc.).
7. `log_saude`: Registro de eventos (entradas/saídas de membros, erros de envio, denúncias).
8. `configuracoes`: Parâmetros do sistema editáveis ao vivo via Dashboard (sem re-deploy).

### Principais Funções SQL

- `proximo_slot_envio(p_grupo_id)`: Calcula o horário exato do próximo disparo respeitando intervalos, jitter e janela 8h-22h.
- `is_oferta_duplicata(p_hash)`: Verifica se a oferta foi enviada nas últimas 24h.
- `taxa_saida_grupo(p_grupo_id)`: Retorna a % de membros que saíram nas últimas 24h para indicar o nível de risco do grupo.

---

## 📊 6. Estudo de Telas do Dashboard VPS (Next.js 15)

O dashboard possui **9 páginas operacionais** com design system Dark Premium e Glassmorphism:

1. **`/` (Home)**: Visão geral com KPI Cards (membros, ofertas hoje, comissões mês, cliques), tabela de grupos ativos com barra de progresso visual, comissões recentes e últimas ofertas.
2. **`/grupos`**: Gestão detalhada dos grupos por nicho, contadores de membros e exibição do link estável de redirect.
3. **`/ofertas`**: Histórico completo com filtros por status (`pendente`, `aprovada`, `enviada`, `descartada`) e plataforma (`amazon`, `shopee`, `mercado_livre`, etc.).
4. **`/comissoes`**: Painel de faturamento com quebra por plataforma e status (`pendente`, `aprovada`, `paga`).
5. **`/fila`**: Lista dos próximos disparos agendados com contagem regressiva em tempo real.
6. **`/saude`**: Diagnóstico do sistema, níveis de risco dos grupos baseados em taxa de saída e checklist de segurança.
7. **`/cliques`**: Analytics detalhado dos acessos ao link de redirect por UTM (`utm_source`, `utm_campaign`) com gráfico de barras horizontais.
8. **`/config`**: Formulário de alteração de parâmetros do sistema em tempo real.
9. **`/manual`**: Formulário para adicionar ofertas avulsas com cálculo de desconto instantâneo.

---

## 🔄 7. Evolução das Decisões de Arquitetura

1. **Substituição do Evolution API pelo EvoGO**:
   - *Motivo*: O Evolution API padrão (Node.js) consome considerável memória RAM e recursos da VPS em instâncias simultâneas. O **EvoGO (Evolution Go)** reescreve a engine em Go (Golang), garantindo consumo mínimo, inicialização instantânea e máxima estabilidade.
2. **Adição do Suporte à Amazon Brasil**:
   - *Motivo*: Ampliar a conversão e variedade de produtos ao lado da Shopee e Mercado Livre.
3. **Anonimização de IP via Hash (LGPD)**:
   - *Motivo*: Garantir conformidade jurídica ao rastrear cliques de UTMs sem armazenar dados pessoais brutos dos usuários.

---

## 📁 8. Estrutura dos Arquivos do Projeto

```
Grupo de whats/
├── brain-projeto-grupos-ofertas.md        <-- (Este arquivo)
├── guia-automacao-amazon-ml-shopee.md     <-- Guia de automação n8n + cookies
├── checklist-credenciais.md               <-- Lista de chaves/contas a preencher
├── plano-grupos-ofertas-antigravity.md    <-- Plano mestre original
├── README.md                              <-- Visão geral do repositório
├── .env.example                           <-- Template de variáveis de ambiente
├── migrations/
│   └── 001_schema_inicial.sql            <-- Migration SQL completa para Supabase
├── docker/
│   ├── docker-compose.yml                 <-- Stack Docker (EvoGO, n8n, Redis, Caddy)
│   └── Caddyfile                          <-- Proxy Caddy com SSL
├── dashboard/                             <-- Aplicação Next.js 15
│   ├── app/                               <-- Rotas e Páginas (App Router)
│   │   ├── page.js                        <-- Home / KPIs
│   │   ├── grupos/page.js                 <-- Gestão de Grupos
│   │   ├── ofertas/page.js                <-- Lista de Ofertas
│   │   ├── comissoes/page.js              <-- Faturamento
│   │   ├── fila/page.js                   <-- Fila de Envio
│   │   ├── saude/page.js                  <-- Monitoramento de Risco
│   │   ├── cliques/page.js                <-- Analytics UTMs
│   │   ├── config/page.js                 <-- Ajustes do Sistema
│   │   ├── manual/page.js                 <-- Adicionar Oferta Manual
│   │   └── api/entrar/route.js            <-- Link Estável (Redirect HTTP 302)
│   ├── components/                        <-- Design System & Badges
│   ├── lib/                               <-- Supabase Client & Demo Data
│   └── Dockerfile                         <-- Multi-stage build
├── scraper/
│   ├── monitor.py                         <-- Scraper Fallback em Python
│   └── requirements.txt
└── n8n-workflows/
    ├── README.md                          <-- Especificação dos 7 Workflows
    └── sample_workflow.json               <-- Template exportável para o n8n
```

---

## 🚀 9. Guia Rápido de Deploy

1. **Preencher o `.env`**: Copie o `.env.example` para `.env` e insira as chaves do Supabase, EvoGO, Anthropic (Claude) e afiliados.
2. **Rodar Migration no Supabase**: Copie o conteúdo de `migrations/001_schema_inicial.sql` e execute no **SQL Editor** do Supabase.
3. **Iniciar a Infraestrutura**: Na pasta do projeto na VPS, execute:
   ```bash
   docker compose -f docker/docker-compose.yml up -d
   ```
4. **Conectar o WhatsApp no EvoGO**: Acesse a API/Painel do EvoGO e escaneie o QR Code usando seu chip pré-aquecido.
5. **Importar Workflows no n8n**: Importe os modelos de workflow e ative os agendadores (Crons).
