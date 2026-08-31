# 🚀 Guia Mestre — Automação de Links de Afiliados (Amazon, Mercado Livre & Shopee) no n8n + EvoGO

> **Documento de Especificação Técnica e Manual Operacional**
> Extraído das técnicas apresentadas nos vídeos de referência (geração automática de links de afiliados via cookie/API + interface de gestão com dashboard visual).

---

## 📌 1. Visão Geral da Solução

O objetivo desta automação é **eliminar 100% o trabalho manual** de pegar ofertas na **Amazon**, **Mercado Livre** e **Shopee**, converter em links com a sua tag de afiliado, gerar copys chamativas com IA e enviar automaticamente para os grupos de WhatsApp gerenciados via **EvoGO**.

```
[Link de Oferta / Busca] 
       │
       ▼
[Conversor de Links (n8n)] ── (Cookie Refresh / API oficial) ──► [Link de Afiliado Gerado]
       │
       ▼
[IA (Claude Sonnet 4)] ────── (Gera título chamativo & emoji) ──► [Copy Formatada]
       │
       ▼
[Supabase (DB)] ──────────── (Persiste oferta, hash & slot) ────► [Dashboard VPS]
       │
       ▼
[EvoGO (WhatsApp API)] ────── (Throttle 5-10 min) ──────────────► [Grupos de Ofertas]
```

---

## 🛠️ 2. Como Funciona a Conversão de Links (Know-How dos Vídeos)

As plataformas de e-commerce utilizam mecanismos diferentes para atribuir comissão aos afiliados. A automação resolve cada uma delas:

### A. 📦 Amazon Brasil (Amazon Associates)
1. **Estrutura de Link Direto**: A Amazon permite a conversão determinística por identificador **ASIN** (código de 10 caracteres do produto).
   - Exemplo de URL original: `https://www.amazon.com.br/dp/B0CXXXXXXX/...`
   - O n8n extrai o ASIN (`B0CXXXXXXX`) via Regex.
   - Monta o link limpo com sua tag: `https://www.amazon.com.br/dp/B0CXXXXXXX?tag=SUA_TAG-20`
2. **Método por Cookie / SiteStripe (Link Encurtado amzn.to)**:
   - Para links curtos (`amzn.to`), o n8n utiliza o nó HTTP Request com seus **cookies de sessão do Amazon Associates** (`session-id` e `ubid-acbbr`).
   - O n8n faz a chamada à rota interna da ferramenta SiteStripe para gerar a URL encurtada oficial instantaneamente.

### B. 🟡 Mercado Livre (Mercado Livre Afiliados)
1. **Método por Cookie Refresh (Vídeo de Referência)**:
   - O Mercado Livre possui uma ferramenta interna no portal de afiliados (`afiliados.mercadolivre.com.br`).
   - O n8n mantém os cookies de autenticação (`org_session`, `ssid`, `affiliate_tag`) ativos usando a técnica de **Cookie Refresh**.
   - Quando um link de produto (ex: `https://produto.mercadolivre.com.br/MLB-123456789...`) entra no fluxo, o n8n executa uma requisição `POST/GET` para a rota do gerador interno do ML enviando o cookie ativo.
   - O retorno é o link rastreável oficial (`https://meli.la/XXXXX` ou `https://mercadolivre.com/sec/XXXXX`).
2. **Fallback por Parâmetros de Rastreio**:
   - Caso a sessão expire, o fluxo aplica a tag global de afiliado diretamente no link canonical: `?matt_tool=XXXXX&matt_word=XXXXX`.

### C. 🟠 Shopee (Shopee Affiliate Program)
1. **Shopee GraphQL Open API (Oficial & Recomendada)**:
   - A Shopee disponibiliza a mutation `generateShortLink` na GraphQL API.
   - O n8n envia a URL original + seu `app_id` e a API retorna a URL curta oficial (`https://s.shopee.com.br/XXXXX`).
2. **Método Universal Link**:
   - Append do identificador de afiliado na URL padrão: `https://shopee.com.br/product/...&sub_id=SEU_ID`.

---

## ⚙️ 3. Configuração dos Workflows no n8n

### Workflow 1: Conversor Universal de Links (Node por Node)

```json
{
  "nodes": [
    {
      "name": "Receber Link Bruto",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300]
    },
    {
      "name": "Identificar Plataforma",
      "type": "n8n-nodes-base.switch",
      "position": [470, 300],
      "parameters": {
        "rules": [
          { "value": "amazon.com.br" },
          { "value": "mercadolivre.com.br" },
          { "value": "shopee.com.br" }
        ]
      }
    },
    {
      "name": "Converter Amazon (ASIN)",
      "type": "n8n-nodes-base.code",
      "position": [700, 150]
    },
    {
      "name": "Converter Mercado Livre (Cookie)",
      "type": "n8n-nodes-base.httpRequest",
      "position": [700, 300]
    },
    {
      "name": "Converter Shopee (GraphQL)",
      "type": "n8n-nodes-base.httpRequest",
      "position": [700, 450]
    },
    {
      "name": "Gerar Copy com IA (Claude)",
      "type": "n8n-nodes-base.httpRequest",
      "position": [950, 300]
    },
    {
      "name": "Salvar no Supabase",
      "type": "n8n-nodes-base.httpRequest",
      "position": [1180, 300]
    },
    {
      "name": "Enviar via EvoGO",
      "type": "n8n-nodes-base.httpRequest",
      "position": [1400, 300]
    }
  ]
}
```

---

## 💻 4. Scripts de Código para o n8n (Code Nodes)

### Code Node 1: Extrair e Converter Link Amazon
```javascript
// Input: $input.first().json.url (URL bruta do produto Amazon)
const rawUrl = $input.first().json.url || "";
const tagAfiliado = $env.AMAZON_ASSOCIATE_TAG || "seu_tag-20";

// Regex para extrair ASIN da Amazon (ex: B0CXXXXXXX)
const asinMatch = rawUrl.match(/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);

if (!asinMatch) {
  throw new Error("Não foi possível extrair o ASIN da URL da Amazon.");
}

const asin = asinMatch[1];
const linkAfiliado = `https://www.amazon.com.br/dp/${asin}?tag=${tagAfiliado}`;

return {
  json: {
    plataforma: "amazon",
    asin: asin,
    link_original: rawUrl,
    link_afiliado: linkAfiliado,
  }
};
```

### Code Node 2: Extrair ID e Converter Link Mercado Livre
```javascript
// Input: $input.first().json.url
const rawUrl = $input.first().json.url || "";

// Extrair ID do item MLB
const mlbMatch = rawUrl.match(/(MLB-?\d+)/i);
const mlbId = mlbMatch ? mlbMatch[1].replace("-", "") : null;

// Se você usa a técnica de Cookie Refresh no gerador do ML:
const cookieSessao = $env.ML_AFFILIATE_COOKIE;

return {
  json: {
    plataforma: "mercado_livre",
    mlb_id: mlbId,
    link_original: rawUrl,
    cookie_header: cookieSessao,
    // O próximo nó de HTTP Request enviará este cookie para o endpoint do ML
  }
};
```

### Code Node 3: GraphQL Payload para Shopee API
```javascript
const rawUrl = $input.first().json.url || "";
const appId = $env.SHOPEE_APP_ID;

const query = `
mutation {
  generateShortLink(input: { originUrl: "${rawUrl}", subId: "n8n_bot" }) {
    shortLink
  }
}
`;

return {
  json: {
    plataforma: "shopee",
    query: query,
    link_original: rawUrl
  }
};
```

---

## 🤖 5. Prompt de IA para Geração de Copys (Claude Sonnet 4)

Payload do nó `HTTP Request` apontando para Anthropic API (`https://api.anthropic.com/v1/messages`):

```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 100,
  "messages": [
    {
      "role": "user",
      "content": "Você é um copywriter brasileiro especialista em grupos de WhatsApp de ofertas e cupons.\nCrie um título super chamativo de no máximo 8 palavras no estilo dos grupos reais (ex: 'ESSE TA DADO DEMAIS 🔥', 'MENOR PREÇO HISTÓRICO ⚡', 'DESCONTO INSANO NA AMAZON 📦').\n\nProduto: {{ $json.titulo_original }}\nPlataforma: {{ $json.plataforma }}\nDesconto: {{ $json.desconto_pct }}%\n\nRetorne APENAS o título, sem aspas, sem texto adicional."
    }
  ]
}
```

---

## 💬 6. Template de Disparo Formatado para EvoGO

Corpo do envio de mensagem com mídia/imagem via EvoGO (`POST http://evogo-api:8080/message/sendMedia/{{$json.instancia}}`):

```json
{
  "number": "{{ $json.whatsapp_group_id }}",
  "mediaMessage": {
    "mediatype": "image",
    "media": "{{ $json.imagem_url }}",
    "caption": "*{{ $json.titulo_gerado }}*\n\n{{ $json.titulo_original }}\n\nDe: ~R$ {{ $json.preco_de }}~\nPor apenas: *R$ {{ $json.preco_por }}* 🔥\n{{#if $json.cupom}}🎟️ Cupom: *{{ $json.cupom }}*\n{{/if}}\n🛒 Compre aqui: {{ $json.link_afiliado }}\n\n⚡ _Oferta por tempo limitado!_"
  }
}
```

---

## 📊 7. Atualização do Banco de Dados Supabase (Adicionando Amazon)

Para permitir a Amazon no banco de dados existente, execute este comando no Supabase SQL Editor:

```sql
-- Atualizar a restrição de verificação na tabela ofertas para incluir 'amazon'
ALTER TABLE ofertas DROP CONSTRAINT IF EXISTS ofertas_plataforma_check;

ALTER TABLE ofertas ADD CONSTRAINT ofertas_plataforma_check 
  CHECK (plataforma IN ('shopee', 'mercado_livre', 'amazon', 'shein', 'netshoes', 'centauro'));
```

---

## 📋 8. Checklist de Execução

1. [ ] **Amazon**: Pegar sua tag de afiliado no portal Amazon Associates (ex: `seusite-20`) e adicionar no `.env` (`AMAZON_ASSOCIATE_TAG`).
2. [ ] **Mercado Livre**: Configurar o nó HTTP Request com os cookies da sua conta de afiliado ML ou usar o gerador de deeplink.
3. [ ] **Shopee**: Garantir que o `SHOPEE_APP_ID` e `SHOPEE_APP_SECRET` estejam no `.env`.
4. [ ] **Supabase**: Executar a migration SQL acima para aceitar produtos da Amazon.
5. [ ] **n8n**: Importar o fluxo universal e configurar os webhooks de entrada.
6. [ ] **EvoGO**: Conectar a instância do WhatsApp para realizar o disparo automático com a imagem do produto.
