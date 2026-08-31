# 📋 Checklist de Credenciais — Preencha Antes de Começar

> **IMPORTANTE:** Preencha cada item abaixo com as informações solicitadas.
> Quando tiver tudo pronto (ou o máximo possível), me envie este arquivo atualizado.
> **Não compartilhe secrets/senhas diretamente no chat** — use variáveis de ambiente ou um `.env` que eu configuro na VPS.

---

## 1. 🛒 Shopee Affiliate Program

**Link de cadastro:** [affiliate.shopee.com.br](https://affiliate.shopee.com.br)

| Campo | Seu Valor | Instruções |
|---|---|---|
| Conta aprovada? | `[ ] Sim / [ ] Não` | Cadastre e aguarde 5-15 dias |
| App ID | `_______________` | No painel → Open API → Solicitar credenciais |
| App Secret | `[NÃO COLE AQUI - guarde em .env]` | Mesmo local acima |
| Endpoint BR | `open-api.affiliate.shopee.com.br/graphql` | Já preenchido |

**Como conseguir:**
1. Acesse [affiliate.shopee.com.br](https://affiliate.shopee.com.br)
2. Faça cadastro com seus dados e canais de divulgação
3. Aguarde aprovação (5-15 dias)
4. Após aprovado, vá em **Open API** no painel
5. Solicite App ID e App Secret
6. Guarde num arquivo `.env` seguro

---

## 2. 🟡 Mercado Livre — Programa de Afiliados

**Link de cadastro:** [afiliados.mercadolivre.com.br](https://afiliados.mercadolivre.com.br)

| Campo | Seu Valor | Instruções |
|---|---|---|
| Conta aprovada? | `[ ] Sim / [ ] Não` | Precisa ter conta ML ativa |
| Acesso ao Gerador de Links? | `[ ] Sim / [ ] Não` | Dentro do painel de afiliado |
| Usa Lomadee para ML? | `[ ] Sim / [ ] Não` | Lomadee gera deeplinks via API |

**Como conseguir:**
1. Acesse [afiliados.mercadolivre.com.br](https://afiliados.mercadolivre.com.br)
2. Faça login com sua conta ML
3. Complete o cadastro de afiliado
4. Aguarde aprovação
5. O ML **não tem API pública** de afiliado — se tiver Lomadee, ela faz o papel

---

## 3. 🔵 Lomadee (Netshoes, Centauro, ML e outros)

**Link de cadastro:** [lomadee.com](https://www.lomadee.com)

| Campo | Seu Valor | Instruções |
|---|---|---|
| Conta aprovada? | `[ ] Sim / [ ] Não` | |
| Token da API | `[NÃO COLE AQUI - guarde em .env]` | Perfil → Credenciais de API |
| Campanha Netshoes aprovada? | `[ ] Sim / [ ] Não` | Precisa aprovar dentro do painel |
| Campanha Centauro aprovada? | `[ ] Sim / [ ] Não` | Precisa aprovar dentro do painel |
| Campanha ML aprovada? | `[ ] Sim / [ ] Não` | Se disponível |

**Como conseguir:**
1. Acesse [lomadee.com](https://www.lomadee.com)
2. Crie conta e complete o perfil
3. Navegue até **Credenciais de API** nas configurações
4. Copie o Token de API → salve no `.env`
5. No painel, procure as campanhas de **Netshoes** e **Centauro** e solicite aprovação em cada uma

---

## 4. 🧡 Shein BR — Programa de Afiliados

**Link de cadastro:** App ou site da Shein → seção "Afiliados"

| Campo | Seu Valor | Instruções |
|---|---|---|
| Conta aprovada? | `[ ] Sim / [ ] Não` | Via app/site oficial br.shein.com |
| Tem acesso ao painel de afiliado? | `[ ] Sim / [ ] Não` | |
| Usa Awin para Shein? | `[ ] Sim / [ ] Não` | Alternativa |

**Como conseguir:**
1. Acesse [br.shein.com](https://br.shein.com) ou o app
2. Procure a seção de **Afiliados**
3. Preencha o formulário com seus canais
4. Aguarde aprovação
5. No painel, você terá acesso a gerador de links e cupons

---

## 5. 🟣 Awin (complemento/alternativa)

**Link de cadastro:** [awin.com](https://www.awin.com)

| Campo | Seu Valor | Instruções |
|---|---|---|
| Conta aprovada? | `[ ] Sim / [ ] Não` | |
| Publisher ID | `_______________` | No painel após aprovação |
| API Token | `[NÃO COLE AQUI - guarde em .env]` | Configurações → API |

---

## 6. 🗄️ Supabase

**Link:** [supabase.com](https://supabase.com)

| Campo | Seu Valor | Instruções |
|---|---|---|
| Projeto criado? | `[ ] Sim / [ ] Não` | Criar projeto NOVO (não misturar com outros) |
| Nome do projeto | `_______________` | Ex: "grupos-ofertas" |
| URL do projeto | `_______________` | Ex: `https://xxxx.supabase.co` |
| Anon Key | `[NÃO COLE AQUI - guarde em .env]` | Settings → API |
| Service Role Key | `[NÃO COLE AQUI - guarde em .env]` | Settings → API (nunca expor no frontend) |
| Database URL | `[NÃO COLE AQUI - guarde em .env]` | Settings → Database |

---

## 7. 🖥️ VPS

| Campo | Seu Valor | Instruções |
|---|---|---|
| Provider | `_______________` | Hetzner / Contabo / DigitalOcean / outro |
| IP da VPS | `_______________` | |
| RAM | `_______________` | Mínimo 4GB recomendado |
| CPU | `_______________` | Mínimo 2 vCPU |
| Docker instalado? | `[ ] Sim / [ ] Não` | |
| Docker Compose? | `[ ] Sim / [ ] Não` | |
| Acesso SSH? | `[ ] Sim / [ ] Não` | Preciso de chave SSH ou senha |

---

## 8. 📱 EvoGO (Evolution Go API)

| Campo | Seu Valor | Instruções |
|---|---|---|
| Já tem rodando? | `[ ] Sim / [ ] Não` | Novo container EvoGO ou existente |
| URL da API | `_______________` | Ex: `https://evogo.seudominio.com` |
| API Key global | `[NÃO COLE AQUI - guarde em .env]` | |
| Instância(s) criada(s) | `_______________` | Nome(s) |

---

## 9. ⚙️ n8n

| Campo | Seu Valor | Instruções |
|---|---|---|
| Já tem rodando? | `[ ] Sim / [ ] Não` | |
| URL do n8n | `_______________` | Ex: `https://n8n.seudominio.com` |
| Versão | `_______________` | |
| Posso criar workflows nessa instância? | `[ ] Sim / [ ] Não` | |

---

## 10. 🤖 Claude API (Anthropic)

| Campo | Seu Valor | Instruções |
|---|---|---|
| Tem API key? | `[ ] Sim / [ ] Não` | [console.anthropic.com](https://console.anthropic.com) |
| API Key | `[NÃO COLE AQUI - guarde em .env]` | |
| Modelo preferido | `claude-sonnet-4-20250514` | Sonnet = melhor custo-benefício para títulos |

---

## 11. 🌐 Domínio

| Campo | Seu Valor | Instruções |
|---|---|---|
| Tem domínio? | `[ ] Sim / [ ] Não` | Precisa de 1 domínio para redirect + dashboard |
| Domínio | `_______________` | Ex: `tenisoferta.com.br` |
| DNS gerenciado por | `_______________` | Cloudflare / Registro.br / outro |
| SSL configurado? | `[ ] Sim / [ ] Não` | Caddy faz automático |

---

## 12. 📞 Chips WhatsApp

| Chip | Número | Operadora | Status Aquecimento | Data Início |
|---|---|---|---|---|
| Chip 1 (principal) | `_______________` | `_______________` | `[ ] Não iniciado / [ ] Em aquecimento / [ ] Pronto` | `___/___/___` |
| Chip 2 (backup) | `_______________` | `_______________` | `[ ] Não iniciado / [ ] Em aquecimento / [ ] Pronto` | `___/___/___` |

**Lembrete:** Mínimo 10 dias de aquecimento antes de conectar à automação!

---

## Como me enviar

1. Preencha todos os campos acima
2. Para secrets/senhas/tokens: **crie um arquivo `.env`** na VPS com todas as variáveis
3. Me informe que preencheu e quais itens estão prontos
4. Eu vou começar pelas fases que já têm credenciais disponíveis

### Formato do `.env` na VPS:

```env
# Shopee
SHOPEE_APP_ID=seu_app_id
SHOPEE_APP_SECRET=seu_app_secret

# Lomadee
LOMADEE_TOKEN=seu_token

# Awin
AWIN_PUBLISHER_ID=seu_id
AWIN_API_TOKEN=seu_token

# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_KEY=sua_service_key
SUPABASE_DB_URL=postgresql://postgres:senha@host:5432/postgres

# Claude
ANTHROPIC_API_KEY=sua_chave

# Evolution API
EVOLUTION_API_URL=https://evolution.seudominio.com
EVOLUTION_API_KEY=sua_chave

# n8n
N8N_URL=https://n8n.seudominio.com
```
