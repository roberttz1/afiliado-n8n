# Workflows n8n — Templates

Este diretório contém documentação dos workflows que devem ser criados no n8n.

> **NOTA:** Os workflows do n8n são criados diretamente na interface web do n8n.
> Os JSONs exportáveis serão gerados quando o n8n estiver rodando e conectado
> ao Supabase e EvoGO API. Abaixo está a documentação de cada workflow.

---

## Workflow 1: Coletor Shopee

**Trigger:** Cron (a cada 15 min)

```
[Cron 15min] → [HTTP Request: Shopee GraphQL API]
             → [Filtrar: categoria=tenis, desconto≥30%]
             → [Gerar hash_produto]
             → [Checar duplicata no Supabase]
             → [Se novo: Inserir em ofertas (status=pendente)]
```

**Nodes necessários:**
1. `Schedule Trigger` — cron `*/15 * * * *`
2. `HTTP Request` — POST para `open-api.affiliate.shopee.com.br/graphql`
   - Headers: Auth token (gerado via App ID + Secret)
   - Body: GraphQL query para buscar produtos de tênis em promoção
3. `Code` — filtrar por desconto mínimo, gerar hash
4. `Supabase` — SELECT para checar duplicata
5. `IF` — se não é duplicata
6. `Supabase` — INSERT na tabela `ofertas`

---

## Workflow 2: Coletor Lomadee (ML/Netshoes/Centauro)

**Trigger:** Cron (a cada 20 min)

```
[Cron 20min] → [HTTP Request: Lomadee API - buscar ofertas]
             → [Filtrar: categoria=tenis, desconto≥30%]
             → [Separar por merchant (ML, Netshoes, Centauro)]
             → [Gerar hash + checar duplicata]
             → [Se novo: Inserir em ofertas]
```

**Endpoint Lomadee:**
- `GET https://api.lomadee.com/v3/{appToken}/offer/_search`
- Parâmetros: `keyword=tenis&category=Esporte&sourceId={sourceId}`

---

## Workflow 3: Validador + Gerador de Título IA

**Trigger:** Cron (a cada 2 min)

```
[Cron 2min] → [Supabase: SELECT ofertas WHERE status='pendente' LIMIT 5]
            → [Validar: desconto≥30%, preço plausível, link válido]
            → [Se válida: status='aprovada']
            → [Se inválida: status='descartada' + motivo]
            → [Para aprovadas: HTTP Request → Claude API]
            → [Validar título gerado (não genérico, não repetido)]
            → [UPDATE ofertas SET titulo_gerado, status='aprovada']
```

**Prompt Claude (node HTTP Request):**
- URL: `https://api.anthropic.com/v1/messages`
- Model: `claude-sonnet-4-20250514`
- Max tokens: 50
- Prompt: (ver implementation_plan.md, Fase 4)

---

## Workflow 4: Fila de Envio

**Trigger:** Cron (a cada 1 min)

```
[Cron 1min] → [Supabase: SELECT envios WHERE status='agendado' AND agendado_para <= NOW()]
            → [Para cada envio:]
              → [Buscar dados da oferta]
              → [Montar mensagem final (template)]
              → [Checar se instância está dentro do rate limit]
              → [Se sim: Evolution API → enviar mensagem ao grupo]
              → [UPDATE envios SET status='enviado']
              → [Se erro: tentativas++ → retry ou status='falhou']
```

**Template da mensagem:**
```
{{titulo_gerado}}

{{titulo_original}}

De R$ {{preco_de}} por R$ {{preco_por}} 🔥
{{#if cupom}}Use o Cupom: {{cupom}} ou{{/if}}
AGORAVAI ou PIPOCA 🍿 + Selecione Pix
{{link_afiliado}}
```

---

## Workflow 5: Agendador (ofertas aprovadas → fila)

**Trigger:** Cron (a cada 2 min)

```
[Cron 2min] → [Supabase: SELECT ofertas WHERE status='aprovada' AND titulo_gerado IS NOT NULL]
            → [Para cada oferta:]
              → [Selecionar grupo(s) ativo(s)]
              → [Calcular próximo slot (função proximo_slot_envio)]
              → [INSERT em envios (status='agendado')]
              → [UPDATE ofertas SET status='enviada']
```

---

## Workflow 6: Monitor de Grupos

**Trigger:** Webhook (Evolution API events)

```
[Webhook: group-participants-update]
  → [Se membro entrou: UPDATE grupos SET qtd_membros += 1]
  → [Se membro saiu: UPDATE grupos SET qtd_membros -= 1]
  → [Log em log_saude]
  → [Se qtd_membros >= capacidade_maxima:]
    → [Marcar grupo como 'cheio']
    → [Evolution API: criar novo grupo]
    → [Inserir novo grupo na tabela]
    → [Fixar mensagem no grupo cheio com link do novo]
```

---

## Workflow 7: Reset Diário

**Trigger:** Cron (meia-noite BRT)

```
[Cron 0 3 * * *] → [Supabase: CALL reset_contadores_diarios()]
```

---

## Ordem de implementação

1. Workflow 7 (reset) — mais simples, testa conexão
2. Workflow 1 (Shopee) — primeiro coletor
3. Workflow 3 (validador + IA) — processa ofertas
4. Workflow 5 (agendador) — cria fila
5. Workflow 4 (envio) — envia de fato
6. Workflow 2 (Lomadee) — mais coletores
7. Workflow 6 (monitor) — gestão de grupos
