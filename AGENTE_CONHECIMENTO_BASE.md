# 🤖 Guia Operacional Autônomo — VPS Virattiva + n8n
> **Para agentes de IA**: Este documento é sua base de conhecimento completa para operar autonomamente a infraestrutura do Robert, corrigir problemas no n8n e construir novos projetos de afiliados sem intervenção humana (exceto para inserir credenciais novas).

---

## 📋 ÍNDICE
1. [Infraestrutura da VPS](#1-infraestrutura-da-vps)
2. [Acesso Autônomo à VPS via Python](#2-acesso-autônomo-à-vps-via-python)
3. [Arquitetura do n8n e Docker](#3-arquitetura-do-n8n-e-docker)
4. [Como Editar e Deployar Workflows no n8n](#4-como-editar-e-deployar-workflows-no-n8n)
5. [Credenciais e Serviços Ativos](#5-credenciais-e-serviços-ativos)
6. [Erros Conhecidos e Como Resolver](#6-erros-conhecidos-e-como-resolver)
7. [Padrões Corretos de Nós n8n](#7-padrões-corretos-de-nós-n8n)
8. [Workflows Existentes (Projeto SDR)](#8-workflows-existentes-projeto-sdr)
9. [Projeto de Afiliados — Shopee, Mercado Livre e Amazon](#9-projeto-de-afiliados--shopee-mercado-livre-e-amazon)
10. [Checklist de Deploy Seguro](#10-checklist-de-deploy-seguro)

---

## 1. Infraestrutura da VPS

| Item | Valor |
|------|-------|
| **IP** | `2.25.204.18` |
| **Domínio** | `virattiva.cloud` |
| **Usuário SSH** | `root` |
| **Senha SSH** | `[INSERIR — perguntar ao Robert]` |
| **Pasta do Projeto** | `/root/Prospects/` |
| **Proxy Reverso** | Caddy (gerencia HTTPS automático) |
| **n8n URL pública** | `https://n8n.virattiva.cloud` |
| **Evolution API** | `http://2.25.204.18:8080` |

### Containers Docker em execução
```
evolution_api_go       → WhatsApp API (Evolution GO)
evolution-postgres-1   → PostgreSQL 15 (porta 5432)
evolution-redis-1      → Redis (porta 6380 externo, 6379 interno)
evolution-n8n-1        → n8n (porta 5678)
evolution-mcp-server   → MCP Server n8n (porta 3000)
```

### Localização do SQLite do n8n
```
/var/lib/docker/volumes/prospects_n8n_data/_data/database.sqlite
```
> ⚠️ **IMPORTANTE**: O n8n usa **SQLite** (não PostgreSQL) para seus dados internos.
> O PostgreSQL é usado apenas pela Evolution API.

---

## 2. Acesso Autônomo à VPS via Python

### Dependência necessária
```bash
pip install paramiko
```

### Template de conexão SSH (use sempre)
```python
import paramiko, sys, json, os
sys.stdout.reconfigure(encoding='utf-8')

VPS_HOST = "2.25.204.18"
VPS_USER = "root"
VPS_PASS = "[SENHA_VPS]"  # Perguntar ao Robert
SQLITE_PATH = "/var/lib/docker/volumes/prospects_n8n_data/_data/database.sqlite"
N8N_CONTAINER = "evolution-n8n-1"

def conectar_vps():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
    return ssh

def executar_comando(ssh, cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    return stdout.read().decode('utf-8', errors='replace'), stderr.read().decode('utf-8', errors='replace')

def executar_python_remoto(ssh, codigo_python, remote_path="/tmp/agent_script.py"):
    """Escreve um script Python na VPS e o executa."""
    sftp = ssh.open_sftp()
    with sftp.open(remote_path, 'w') as f:
        f.write(codigo_python)
    sftp.close()
    out, err = executar_comando(ssh, f"python3 {remote_path} && rm {remote_path}")
    return out, err

def enviar_arquivo(ssh, local_path, remote_path):
    sftp = ssh.open_sftp()
    sftp.put(local_path, remote_path)
    sftp.close()
```

### Consultar SQLite do n8n
```python
ssh = conectar_vps()
out, _ = executar_python_remoto(ssh, """
import sqlite3
conn = sqlite3.connect('/var/lib/docker/volumes/prospects_n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT id, name, active FROM workflow_entity")
for r in c.fetchall():
    print(r)
conn.close()
""")
print(out)
ssh.close()
```

### Checar containers ativos
```python
ssh = conectar_vps()
out, _ = executar_comando(ssh, "docker ps --format '{{.Names}} {{.Status}}'")
print(out)
ssh.close()
```

---

## 3. Arquitetura do n8n e Docker

### Regras de Ouro (NUNCA violar)
1. **HTTPS obrigatório**: Sempre `https://n8n.virattiva.cloud` — nunca IP direto
2. **N8N_SECURE_COOKIE = true**: Necessário para OAuth (Google Calendar, etc.)
3. **WEBHOOK_URL**: Sempre `https://n8n.virattiva.cloud/` (com barra final)
4. **Banco SQLite**: Nunca migrar para o Postgres compartilhado
5. **Arquivos temporários**: Nunca deixar na VPS. Limpar /tmp/ após uso

### Parar/Iniciar o n8n (para editar SQLite)
```python
# SEMPRE parar ANTES de editar o SQLite
ssh.exec_command("docker stop evolution-n8n-1")[1].read()

# ... fazer edições ...

# SEMPRE iniciar DEPOIS de terminar
ssh.exec_command("docker start evolution-n8n-1")[1].read()
```

> ⚠️ **CRÍTICO**: O n8n mantém cache WAL em memória. Editou o SQLite com o container rodando?
> Ele vai sobrescrever suas edições ao reiniciar. SEMPRE pare primeiro.

### Após qualquer deploy
O agente deve instruir o Robert a:
1. Acessar `https://n8n.virattiva.cloud/workflow/ID_DO_WORKFLOW`
2. Pressionar **Ctrl+S** para compilar as rotas
3. Verificar toggle **Ativo** no canto superior direito

---

## 4. Como Editar e Deployar Workflows no n8n

### Fluxo obrigatório de deploy
```
1. Ler JSON local → aplicar modificações em Python → validar com json.load()
2. Enviar via SFTP para /tmp/ na VPS
3. docker stop evolution-n8n-1
4. Atualizar SQLite com script Python na VPS
5. docker start evolution-n8n-1
6. Limpar /tmp/
7. Instruir Robert: Ctrl+S no editor + verificar ativo
```

### Script de deploy universal
```python
def deploy_workflow(workflow_id: str, local_json_path: str, vps_pass: str):
    import paramiko, json, os
    
    VPS_HOST = "2.25.204.18"
    VPS_USER = "root"
    SQLITE_PATH = "/var/lib/docker/volumes/prospects_n8n_data/_data/database.sqlite"
    
    # Validar JSON local
    with open(local_json_path, 'r', encoding='utf-8') as f:
        wf_data = json.load(f)
    print(f"✅ JSON válido: {len(wf_data['nodes'])} nós")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(VPS_HOST, username=VPS_USER, password=vps_pass, timeout=15)
    
    remote_json = f"/tmp/{workflow_id}.json"
    sftp = ssh.open_sftp()
    sftp.put(local_json_path, remote_json)
    
    # Parar n8n
    ssh.exec_command("docker stop evolution-n8n-1")[1].read()
    print("✅ n8n parado")
    
    # Atualizar SQLite
    update_script = f"""
import sqlite3, json, sys
conn = sqlite3.connect('{SQLITE_PATH}')
c = conn.cursor()
with open('{remote_json}', 'r', encoding='utf-8') as f:
    data = json.load(f)
if isinstance(data, list): data = data[0]
nodes = json.dumps(data.get('nodes', []))
conns = json.dumps(data.get('connections', {{}}))
c.execute("SELECT id, name FROM workflow_entity WHERE id=?", ('{workflow_id}',))
row = c.fetchone()
if not row:
    print("ERRO: Workflow nao encontrado!")
    sys.exit(1)
c.execute("UPDATE workflow_entity SET nodes=?, connections=?, updatedAt=datetime('now') WHERE id=?",
          (nodes, conns, '{workflow_id}'))
conn.commit()
conn.close()
print(f"OK: {{row[1]}} atualizado com sucesso")
"""
    with sftp.open("/tmp/deploy_update.py", "w") as f:
        f.write(update_script)
    sftp.close()
    
    out, err = ssh.exec_command("python3 /tmp/deploy_update.py")
    print(out[1].read().decode())
    
    # Iniciar n8n
    ssh.exec_command("docker start evolution-n8n-1")[1].read()
    print("✅ n8n iniciado")
    
    # Limpar
    ssh.exec_command(f"rm /tmp/{workflow_id}.json /tmp/deploy_update.py")
    ssh.close()
    print("✅ Deploy concluído!")
```

### Localização dos arquivos de workflow (máquina do Robert)
```
C:\Users\Robert\Área de Trabalho\Material  N8N\Prospects\sdr-docker-stack\workflows\
```

### IDs dos workflows na VPS
| ID | Nome |
|----|------|
| `sdr-calendar-manager-id` | SDR Calendar Manager |
| `zYargWjnZDW7Qid0` | SDR Inbound |

---

## 5. Credenciais e Serviços Ativos

> ⚠️ Todas as senhas abaixo estão em:
> `C:\Users\Robert\Área de Trabalho\Material  N8N\Prospects\sdr-docker-stack\.env`

### VPS SSH
| Campo | Valor |
|-------|-------|
| Host | `2.25.204.18` |
| User | `root` |
| Password | `[PEDIR AO ROBERT]` |

### n8n
| Campo | Valor |
|-------|-------|
| URL Pública | `https://n8n.virattiva.cloud` |
| URL Interna | `http://n8n:5678` (dentro do Docker) / `http://localhost:5678` (na VPS) |
| Basic Auth User | `admin` |
| Basic Auth Pass | `admin123` |
| API Key | Ver `.env` → `N8N_API_KEY` |

### Supabase
| Campo | Valor |
|-------|-------|
| URL | `https://mplwhrejtumwuznxehyj.supabase.co` |
| Anon Key | Ver `.env` → `SUPABASE_ANON_KEY` |
| Tabelas | `leads`, `agendamentos`, `mensagens` |
| ID da credencial no n8n | `V326BJ8v0aA0PeXh` |

### Evolution API (WhatsApp)
| Campo | Valor |
|-------|-------|
| URL | `http://2.25.204.18:8080` |
| API Key | `429683C4C977415CAAFCCE10F7D57E11` |
| Instância WhatsApp | `Number_4847` |

### PostgreSQL (Evolution)
| Campo | Valor |
|-------|-------|
| Host externo | `2.25.204.18:5432` |
| Host interno Docker | `postgres:5432` |
| User | `postgres` |
| Password | `typebot` |
| Database | `evolution_db` |

### Telegram
| Campo | Valor |
|-------|-------|
| Bot Token | Credencial ID `5r0WLnoPorz2jYOk` no n8n |
| Chat ID do Gabriel | `6459082509` |

### IAs Disponíveis
| Serviço | Chave no .env |
|---------|---------------|
| OpenAI | `OPENAI_API_KEY` |
| Anthropic (Claude) | `ANTHROPIC_API_KEY` |
| Groq | `GROQ_API_KEY` |
| AWS Bedrock | `AWS_BEARER_TOKEN_BEDROCK` |
| NVIDIA | `NVIDIA_API_KEY` |

### MCP Server n8n
| Campo | Valor |
|-------|-------|
| URL | `http://2.25.204.18:3000` |
| Auth Token | Ver `.env` → `MCP_AUTH_TOKEN` |

---

## 6. Erros Conhecidos e Como Resolver

### ❌ Erro #1 — Botões Inline do Telegram aparecem vazios
**Sintoma**: Rows existem no editor do n8n, mas dentro de cada row aparece "+ Add Button" vazio.

**Causa**: n8n usa `fixedCollection` aninhado. Botões ficam em `row.buttons[]`, não em `row[]`.

**ERRADO**:
```json
"inlineKeyboard": {
  "rows": [{ "row": [{ "text": "Botão" }] }]
}
```
**CORRETO**:
```json
"inlineKeyboard": {
  "rows": [{ "row": { "buttons": [{ "text": "Botão", "additionalFields": { "callback_data": "=valor" } }] } }]
}
```

---

### ❌ Erro #2 — callback_data vem como string literal (sem avaliar)
**Sintoma**: Botão manda `"apr_c:{{ $json.id }}"` literalmente ao invés do UUID real.

**Causa**: Falta o prefixo `=` para o n8n avaliar a expressão.

**ERRADO**: `"callback_data": "apr_c:{{ $json.id }}"`
**CORRETO**: `"callback_data": "=apr_c:{{ $json.id }}"`

> 🔒 **Limite do Telegram**: `callback_data` suporta no máximo **64 bytes**.
> Nunca passe dados completos do lead — use UUID de um registro no Supabase.

---

### ❌ Erro #3 — Edição do SQLite revertida após reinício do n8n
**Causa**: n8n tem WAL cache em memória. Reiniciou limpo → sobrescreveu suas edições.

**Solução**: SEMPRE `docker stop evolution-n8n-1` ANTES de editar SQLite.

---

### ❌ Erro #4 — "Unused Respond to Webhook node"
**Causa**: Após editar via SQLite, o n8n não compila as rotas automaticamente.

**Solução**: Pedir ao Robert para abrir o workflow e pressionar **Ctrl+S**.

---

### ❌ Erro #5 — Google OAuth "Unauthorized"
**Causa**: OAuth foi iniciado de aba com `localhost` ou IP, mas callback usa o domínio.

**Solução**: Sempre acessar exclusivamente por `https://n8n.virattiva.cloud` antes de fazer login OAuth.

---

### ❌ Erro #6 — Horário errado nos agendamentos (−3h no Google Calendar)
**Causa**: Node.js interpreta string sem fuso como UTC, subtraindo 3h do horário de Brasília.

**Solução**: Sempre adicionar `-03:00` em strings de data/hora sem offset:
```javascript
if (!dataHoraStr.includes('Z') && !/[-+]\d{2}:\d{2}$/.test(dataHoraStr)) {
  dataHoraStr = dataHoraStr + '-03:00';
}
const dateStart = new Date(dataHoraStr);
```

---

### ❌ Erro #7 — NameError: name 'false' is not defined (Python)
**Causa**: Copiou valor JSON (`true`/`false`) diretamente para código Python.

**Solução**: Em Python use `True`/`False` (maiúsculas). Para gerar JSON, use `json.dumps()`.

---

### ❌ Erro #8 — Nó órfão (nunca executado)
**Sintoma**: Nó no canvas sem nenhuma seta de entrada — o fluxo nunca chega a ele.

**Como detectar**:
```python
node_names = {n['name'] for n in data['nodes']}
connected_targets = set()
for src, conn in data['connections'].items():
    for branch in conn.get('main', []):
        for target in branch:
            connected_targets.add(target['node'])
# Triggers legítimos: Webhook, Schedule, Telegram Trigger
orfaos = node_names - connected_targets
print("Nós potencialmente órfãos:", orfaos)
```

---

## 7. Padrões Corretos de Nós n8n

### Supabase — Insert
```json
{
  "parameters": {
    "tableId": "nome_tabela",
    "fieldsUi": {
      "fieldValues": [
        { "fieldId": "coluna", "fieldValue": "={{ $json.campo }}" },
        { "fieldId": "status", "fieldValue": "ativo" }
      ]
    }
  },
  "type": "n8n-nodes-base.supabase",
  "typeVersion": 1,
  "credentials": { "supabaseApi": { "id": "V326BJ8v0aA0PeXh", "name": "Supabase API" } }
}
```

### Supabase — GetAll com filtro
```json
{
  "parameters": {
    "operation": "getAll",
    "tableId": "nome_tabela",
    "returnAll": false,
    "limit": 1,
    "filterType": "manual",
    "filters": {
      "conditions": [
        { "id": "f1", "key": "coluna", "operator": "eq", "value": "={{ $json.valor }}" }
      ]
    }
  },
  "type": "n8n-nodes-base.supabase",
  "typeVersion": 1,
  "credentials": { "supabaseApi": { "id": "V326BJ8v0aA0PeXh", "name": "Supabase API" } }
}
```

### Telegram — Mensagem com botões inline (ESTRUTURA CORRETA)
```json
{
  "parameters": {
    "chatId": "6459082509",
    "text": "=Mensagem aqui com <b>HTML</b>",
    "replyMarkup": "inlineKeyboard",
    "inlineKeyboard": {
      "rows": [
        {
          "row": {
            "buttons": [
              {
                "text": "👍 Aprovar",
                "additionalFields": { "callback_data": "=apr:{{ $json.id }}" }
              }
            ]
          }
        },
        {
          "row": {
            "buttons": [
              {
                "text": "👎 Recusar",
                "additionalFields": { "callback_data": "=dec:{{ $json.id }}" }
              }
            ]
          }
        }
      ]
    },
    "additionalFields": { "parse_mode": "HTML" }
  },
  "type": "n8n-nodes-base.telegram",
  "typeVersion": 1.1,
  "credentials": { "telegramApi": { "id": "5r0WLnoPorz2jYOk", "name": "Telegram account" } }
}
```

### Telegram — Responder Callback (fechar "carregando" do botão)
```json
{
  "parameters": {
    "resource": "callbackQuery",
    "operation": "answer",
    "callbackQueryId": "={{ $json.callback_query_id }}",
    "text": "Processado com sucesso!"
  },
  "type": "n8n-nodes-base.telegram",
  "typeVersion": 1.1,
  "credentials": { "telegramApi": { "id": "5r0WLnoPorz2jYOk", "name": "Telegram account" } }
}
```

### Telegram — Editar mensagem (remover botões após clique)
```json
{
  "parameters": {
    "resource": "message",
    "operation": "edit",
    "chatId": "={{ $json.chat_id }}",
    "messageId": "={{ $json.message_id }}",
    "text": "=✅ Ação concluída: {{ $json.status }}",
    "replyMarkup": "none",
    "additionalFields": { "parse_mode": "HTML" }
  },
  "type": "n8n-nodes-base.telegram",
  "typeVersion": 1.1,
  "credentials": { "telegramApi": { "id": "5r0WLnoPorz2jYOk", "name": "Telegram account" } }
}
```

### Telegram Trigger — Capturar callback_query
```json
{
  "parameters": {
    "updates": ["callback_query"],
    "additionalFields": {}
  },
  "type": "n8n-nodes-base.telegramTrigger",
  "typeVersion": 1,
  "credentials": { "telegramApi": { "id": "5r0WLnoPorz2jYOk", "name": "Telegram account" } }
}
```

### IF — Condição booleana (versão correta 2.2)
```json
{
  "parameters": {
    "conditions": {
      "options": { "caseSensitive": true, "typeValidation": "strict", "version": 2.2 },
      "conditions": [
        {
          "id": "cond-1",
          "leftValue": "={{ $json.aprovado }}",
          "rightValue": true,
          "operator": { "type": "boolean", "operation": "true" }
        }
      ],
      "combinator": "and"
    },
    "options": {}
  },
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2
}
```

### Code Node — Processar callback do Telegram
```javascript
const cb = $input.first().json.callback_query;
const [acaoTipo, agendamentoId] = cb.data.split(':');
// acaoTipo: 'apr_c' | 'dec_c' | 'apr_r' | 'dec_r'
const approved = acaoTipo.startsWith('apr');
const isReschedule = acaoTipo.endsWith('r');

return [{
  json: {
    agendamento_id: agendamentoId,
    approved,
    is_reschedule: isReschedule,
    callback_query_id: cb.id,
    message_id: cb.message.message_id,
    chat_id: cb.message.chat.id
  }
}];
```

---

## 8. Workflows Existentes (Projeto SDR)

| Arquivo | ID no n8n | Função |
|---------|-----------|--------|
| `sdr-calendar-manager.json` | `sdr-calendar-manager-id` | Agendamentos: criar/remarcar/cancelar via webhook + aprovação Telegram |
| `sdr-inbound.json` | `zYargWjnZDW7Qid0` | Agente IA conversacional (WhatsApp → qualificação → agendamento) |
| `sdr-followup.json` | *(ver n8n)* | Follow-up automático de leads |
| `sdr-outbound.json` | *(ver n8n)* | Prospecção ativa |
| `sdr-post-meeting.json` | *(ver n8n)* | Ações pós-reunião |

### Webhooks Públicos Ativos
```
POST https://n8n.virattiva.cloud/webhook/sdr-calendar-action
     → Recebe ações de agendamento da tool do agente IA
```

### Supabase — Estrutura de Tabelas do SDR
```sql
-- leads
id, nome_contato, telefone, email, segmento, status, created_at

-- agendamentos
id (UUID), lead_id, data_hora, duracao_minutos, status, google_event_id, created_at
-- status: pendente_aprovacao | pendente_remarcacao | aprovado | recusado | cancelado
```

### Fluxo de Aprovação (Botões Telegram)
```
[Agendamento manhã] → Supabase INSERT (status=pendente) → Telegram (botões inline)
                                                               ↓ [clique do Gabriel]
                                            Telegram Trigger (callback_query)
                                                               ↓
                                      Processar → Buscar agendamento no Supabase
                                                               ↓
                                      IF aprovado → Google Calendar CREATE/UPDATE
                                                               ↓
                                      Telegram edit mensagem (remove botões, mostra resultado)
```

---

## 9. Projeto de Afiliados — Shopee, Mercado Livre e Amazon

### Visão Geral da Arquitetura
```
[APIs dos Marketplaces] → [n8n: Scraper + Filtro] → [Supabase: produtos]
                                                             ↓
                                          [n8n: Disparador] → WhatsApp/Telegram
```

### APIs dos Marketplaces

#### Shopee Affiliate API
- Endpoint: `https://open-api.affiliate.shopee.com.br/graphql`
- Auth: `appid` + HMAC-SHA256 signature com `secret`
- Cadastro: https://affiliate.shopee.com.br → Developer
- Gerar link: mutation `generateShortLink` com `originalURL`

#### Mercado Livre API
- Busca pública: `GET https://api.mercadolibre.com/sites/MLB/search?q=TERMO&sort=price_asc`
- Auth OAuth2: `https://auth.mercadolivre.com.br/authorization`
- Programa afiliados: https://www.mercadolivre.com.br/afiliados
- Link afiliado: `https://mercadolivre.com/LINK?affid=SEU_ID`

#### Amazon Associates (PA-API 5.0)
- Endpoint: `https://webservices.amazon.com.br/paapi5/searchitems`
- Auth: AWS Signature Version 4
- Cadastro: https://associados.amazon.com.br
- Campos necessários: `PartnerTag`, `AccessKey`, `SecretKey`

### Tabelas Supabase para criar (Projeto Afiliados)
```sql
CREATE TABLE produtos_afiliados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  marketplace TEXT NOT NULL,       -- 'shopee' | 'mercadolivre' | 'amazon'
  produto_id TEXT NOT NULL,
  nome TEXT,
  preco_original DECIMAL,
  preco_atual DECIMAL,
  desconto_percentual DECIMAL,
  link_afiliado TEXT,
  imagem_url TEXT,
  categoria TEXT,
  ativo BOOLEAN DEFAULT true,
  ultima_atualizacao TIMESTAMP DEFAULT NOW(),
  UNIQUE(marketplace, produto_id)
);

CREATE TABLE alertas_enviados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID REFERENCES produtos_afiliados(id),
  canal TEXT,                      -- 'telegram' | 'whatsapp'
  enviado_em TIMESTAMP DEFAULT NOW()
);
```

### Workflows a Criar (Projeto Afiliados)

#### Workflow 1: Scraper de Ofertas (a cada 30min)
```
Schedule Trigger (*/30 * * * *)
    ↓
[Em paralelo]
HTTP Request → Shopee GraphQL (ofertas do dia)
HTTP Request → ML API (buscar promoções)
HTTP Request → Amazon PA-API (best sellers)
    ↓
Code (filtrar: desconto > 30%, preço < R$500)
    ↓
Supabase UPSERT produtos_afiliados
    ↓
IF (produto novo OU queda de preço > 10%)
    ↓ [True]
Supabase marcar para envio
```

#### Workflow 2: Disparador de Alertas (a cada hora)
```
Schedule Trigger (0 * * * *)
    ↓
Supabase GET (produtos sem alerta nas últimas 24h)
    ↓
Split in Batches (5 por vez)
    ↓
Telegram/WhatsApp (enviar oferta formatada)
    ↓
Supabase INSERT alertas_enviados
```

#### Workflow 3: Webhook — Gerar Link Afiliado
```
Webhook POST /afiliado/gerar-link
    ↓
Code (detectar marketplace pelo URL)
    ↓
Switch (marketplace)
  → shopee: HTTP Request GraphQL generateShortLink
  → mercadolivre: Code (montar URL com tag afiliado)
  → amazon: HTTP Request PA-API GetItems
    ↓
Supabase UPSERT produto
    ↓
Respond (retornar link + dados do produto)
```

### Template de Mensagem de Oferta
```
🔥 *OFERTA IMPERDÍVEL* 🔥

🛍️ *NOME_DO_PRODUTO*

💰 De ~~R$ PRECO_ORIGINAL~~ por
✅ *R$ PRECO_ATUAL* — DESCONTO% OFF!

🛒 Comprar agora: LINK_AFILIADO

📦 Frete grátis | ⏰ Oferta por tempo limitado

_Notificações de ofertas diárias. Responda PARAR para sair._
```

### Credenciais que o Robert precisará fornecer (Afiliados)
- [ ] Shopee: `appid` + `secret` (gerado no painel de afiliados)
- [ ] Mercado Livre: `client_id` + `client_secret` (OAuth2)
- [ ] Amazon: `PartnerTag` + `AccessKey` + `SecretKey`
- [ ] Canal Telegram: Chat ID do grupo/canal de destino
- [ ] Número WhatsApp de destino para disparos

### Passo a passo de implantação
```
1. Robert fornece as 3 credenciais de marketplace
2. Agente cria tabelas no Supabase (SQL acima)
3. Agente gera os 3 JSONs de workflow e faz deploy via script Python
4. Agente testa um scraping manual de 5 produtos
5. Robert abre cada workflow no n8n → Ctrl+S → Ativar
6. Sistema começa a monitorar e disparar automaticamente
```

---

## 10. Checklist de Deploy Seguro

### Antes de editar o JSON
- [ ] Backup: `cp workflow.json workflow.json.bak`
- [ ] Validar JSON atual: `json.load(open('workflow.json'))`
- [ ] Mapear nós órfãos (ver código em Erro #8)

### Ao editar JSON via Python
- [ ] Usar `True`/`False` Python (não `true`/`false` JSON)
- [ ] Expressions sempre com `=` prefixado: `"={{ $json.campo }}"`
- [ ] `inlineKeyboard` usa `row.buttons[]` (não `row[]` diretamente)
- [ ] Validar JSON após edição: `json.load(open('workflow.json'))`
- [ ] Verificar nós órfãos após edição

### Deploy na VPS
- [ ] `docker stop evolution-n8n-1` ANTES de qualquer edição no SQLite
- [ ] Verificar que o workflow existe: `SELECT id FROM workflow_entity WHERE id=?`
- [ ] `docker start evolution-n8n-1` APÓS todas as edições
- [ ] Limpar: `rm /tmp/*.json /tmp/*.py`
- [ ] Verificar container rodando: `docker ps | grep evolution-n8n-1`

### Pós-deploy
- [ ] Instruir Robert: abrir workflow → **Ctrl+S** → verificar **Ativo**
- [ ] Se novo Telegram Trigger: testar enviando mensagem ao bot
- [ ] Se novo Webhook: testar com `curl -X POST URL -d '{}'`

---

## 📌 Referências Rápidas

### Comandos Docker na VPS (via SSH)
```bash
docker ps                           # listar containers
docker logs evolution-n8n-1 -n 50   # últimos 50 logs do n8n
docker restart evolution-n8n-1      # reiniciar n8n (não usar para deploy!)
docker exec evolution-n8n-1 env     # variáveis de ambiente do n8n
```

### Verificar webhook do Telegram Bot
```python
import requests
BOT_TOKEN = "TOKEN_DO_BOT"  # pegar da credencial no n8n
r = requests.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getWebhookInfo")
print(r.json())
```

### n8n API REST (operações via HTTP)
```
Base: https://n8n.virattiva.cloud/api/v1
Auth: X-N8N-API-KEY: [N8N_API_KEY do .env]

GET  /workflows          → listar workflows
GET  /workflows/:id      → ver workflow
POST /workflows/:id/activate   → ativar
POST /workflows/:id/deactivate → desativar
```

### Estrutura de pastas no PC do Robert
```
C:\Users\Robert\Área de Trabalho\
├── Material  N8N\Prospects\
│   ├── sdr-docker-stack\
│   │   ├── .env                    ← TODAS as credenciais
│   │   ├── docker-compose.yml      ← configuração dos containers
│   │   └── workflows\              ← JSONs dos workflows n8n
│   └── scratch\                    ← scripts Python de automação/debug
│       ├── vps_sync_workflows_safe.py  ← script de deploy principal
│       └── ...
└── Afiliado N8N\
    └── AGENTE_CONHECIMENTO_BASE.md     ← ESTE ARQUIVO
```

---

*Última atualização: Agosto 2026 | Gerado por agente Antigravity para uso de agentes futuros*
