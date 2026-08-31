# Plano Mestre — Sistema de Grupos de Ofertas com IA (Nicho: Tênis)
### Documento de instruções para o agente Antigravity (Opus) — executar por FASES

---

## ⚠️ Leitura obrigatória antes de começar (não é código, é risco de negócio)

Antes de qualquer linha de código, três riscos reais que vão definir decisões técnicas abaixo:

1. **Scraping direto de Shopee/ML/Shein/Netshoes/Centauro viola os Termos de Uso** da maioria dessas plataformas e pode gerar bloqueio de IP/conta. Sempre que existir **API oficial de afiliados**, ela deve ser preferida ao scraper:
   - **Mercado Livre**: possui API de afiliados (via plataformas como Lomadee, Awin ou o programa próprio "Mercado Livre Afiliados"). Não precisa de scraper.
   - **Shopee**: tem o "Shopee Affiliate Program" com feed de produtos/cupons via API.
   - **Shein**: afiliação normalmente via redes como Awin/CJ Affiliate.
   - **Netshoes/Centauro**: normalmente via Awin ou Lomadee (Magazine Luiza também usa Lomadee).
   - **Scraper em Python só entra como fallback** para o que a API não cobrir (ex: monitorar preço/cupom em tempo real numa página específica), e mesmo assim com bom senso de rate-limit (não é tarefa do Antigravity decidir isso sozinho — é decisão sua, o humano, quais fontes usar).

2. **Automação de WhatsApp (criar grupos, redirecionar link ao encher, postar em massa) usando bibliotecas não-oficiais (Baileys/Evolution API) viola os Termos de Serviço do WhatsApp** e pode banir o número. Você já usa Evolution API no projeto Virattiva/Letícia Jheniffer — o mesmo risco se aplica aqui, ampliado pelo volume de mensagens em grupos com centenas de pessoas. Mitigação técnica (não elimina o risco, reduz): números aquecidos, múltiplos chips, throttling, WhatsApp Business API oficial para os canais que crescerem.

3. Essas ressalvas não impedem o projeto — só significam que a arquitetura abaixo prioriza **APIs oficiais de afiliados + Evolution API com throttling agressivo**, e isola o scraper como módulo plugável e opcional.

---

## Visão geral da arquitetura

```
[Coletores de Ofertas]  →  [Fila/DB Supabase]  →  [Validador + Ranker]  →  [Gerador de Título IA]
                                                                                     ↓
[Dashboard VPS] ←  [Módulo de Métricas]  ←  [Módulo de Envio WhatsApp c/ Throttle]  ←
                                                                                     ↓
                                                                    [Gestor de Grupos (criação/rotação)]
```

**Stack recomendada** (reaproveitando o que você já usa no Virattiva):
- **n8n** — orquestração dos workflows (coleta → validação → IA → fila → envio)
- **Supabase (Postgres)** — banco de dados (ofertas, grupos, envios, comissões)
- **Evolution API** — envio/gestão de grupos no WhatsApp
- **Claude API (Sonnet)** — geração de título chamativo + validação de qualidade da oferta
- **Python** — módulo de scraping/normalização (só onde não houver API de afiliados)
- **VPS** — hospeda n8n, Evolution API, Supabase (ou Supabase cloud) e o dashboard
- **Dashboard**: Next.js ou até um painel simples no próprio n8n/Supabase Studio no começo (não precisa nascer bonito, precisa nascer funcional)

---

## FASE 0 — Setup de contas e credenciais (SUA parte manual)

Isso o Antigravity não faz sozinho — precisa que você forneça:
- [ ] Conta de afiliado aprovada: Mercado Livre, Shopee, Shein/Awin, Netshoes/Centauro (Awin ou Lomadee)
- [ ] Chaves de API de cada rede de afiliados aprovada
- [ ] Número(s) de WhatsApp dedicados para os grupos (recomendo não usar seu número pessoal)
- [ ] VPS provisionada (mesma linha do que você já usa para Evolution API/n8n, ou nova instância)
- [ ] Conta Supabase (novo projeto, separado do projeto Virattiva, para não misturar dados)
- [ ] Chave da API Anthropic (Claude) — já deve ter, do projeto Letícia Jheniffer

**Instrução para o Antigravity**: aguardar confirmação explícita de que os itens acima existem antes de iniciar a Fase 1. Não gerar credenciais fictícias, não simular tokens.

---

## FASE 1 — Modelagem do banco (Supabase)

Tabelas mínimas:

```sql
-- ofertas brutas coletadas
create table ofertas (
  id uuid primary key default gen_random_uuid(),
  plataforma text not null, -- 'mercado_livre' | 'shopee' | 'shein' | 'netshoes' | 'centauro'
  categoria text not null,  -- 'tenis' no MVP
  titulo_original text,
  titulo_gerado text,       -- gerado pela IA
  preco_de numeric,
  preco_por numeric,
  desconto_pct numeric generated always as (round((1 - preco_por/preco_de)*100,1)) stored,
  cupom text,
  link_afiliado text not null,
  imagem_url text,
  fonte text, -- 'api_afiliado' | 'scraper'
  status text default 'pendente', -- pendente | aprovada | enviada | descartada
  criado_em timestamptz default now()
);

-- grupos de whatsapp
create table grupos (
  id uuid primary key default gen_random_uuid(),
  nicho text not null, -- 'tenis', 'casa', 'perfumes'...
  numero_sequencial int not null,
  whatsapp_group_id text not null,
  link_convite text not null,
  qtd_membros int default 0,
  capacidade_maxima int default 950, -- limite do WhatsApp é 1024; deixar margem
  status text default 'ativo', -- ativo | cheio | arquivado
  criado_em timestamptz default now()
);

-- fila/log de envios
create table envios (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid references ofertas(id),
  grupo_id uuid references grupos(id),
  enviado_em timestamptz,
  status text default 'agendado' -- agendado | enviado | falhou
);

-- comissões (input manual ou via API do afiliado, quando disponível)
create table comissoes (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid references ofertas(id),
  plataforma text,
  valor numeric,
  status text, -- pendente | aprovada | paga
  registrado_em timestamptz default now()
);
```

**Instrução para o Antigravity**: criar essas tabelas via migration no Supabase do projeto, não seguir para a Fase 2 sem confirmar que o schema subiu sem erro.

---

## FASE 2 — Coletores de oferta (loop 1 por fonte, não fazer todas juntas)

Ordem sugerida (cada uma é um sub-loop independente, testado isoladamente antes de ligar as próximas):

1. **Loop 2.1 — Mercado Livre**: workflow n8n que consulta a API de afiliados (Lomadee/Awin conforme o que você tiver aprovado) filtrando categoria "tênis" e desconto mínimo (ex: >30%). Grava em `ofertas` com `fonte = 'api_afiliado'`.
2. **Loop 2.2 — Shopee**: mesma lógica, endpoint do Shopee Affiliate.
3. **Loop 2.3 — Shein / Netshoes / Centauro**: via Awin (se todas estiverem na mesma rede, é um único conector reaproveitável, filtrando por `merchant_id`).
4. **Loop 2.4 (opcional/fallback) — Scraper Python**: só para o que nenhuma API cobrir. Deve rodar em horário espaçado (ex: a cada 30-60 min), respeitar `robots.txt`, usar delays entre requisições, e nunca ser o coletor primário.

**Critério de saída de cada loop**: rodar 1x manualmente, conferir que pelo menos 1 oferta real caiu na tabela `ofertas` com todos os campos preenchidos, só então seguir pro próximo loop.

---

## FASE 3 — Validação e ranking de ofertas

Workflow que roda sobre `ofertas` com `status = 'pendente'`:
- Regra de negócio (dura, não é a IA quem decide): desconto mínimo (ex: ≥30%), preço mínimo/máximo plausível para evitar erro de preço, link de afiliado válido (não vazio, não duplicado nas últimas 24h para o mesmo produto).
- Descarta duplicatas (mesmo produto/plataforma postado nas últimas X horas).
- Ofertas aprovadas mudam `status = 'aprovada'` e entram na fila do gerador de título.

---

## FASE 4 — Geração de título chamativo (Claude API)

Prompt sugerido para o node do Claude no n8n, calibrado no estilo do grupo que você mandou de exemplo (frase de efeito curta + nome do produto + condição de preço):

```
Você escreve títulos curtos e chamativos para ofertas de tênis em um grupo de WhatsApp de cupons,
no estilo: "ESSE GOSTA DE IR RÁPIDO MESMO" para um tênis de corrida, ou
"7 CONTO CADA MEIA PRA RAPAZIADA DO FUT" para um kit de meias.

Regras:
- Máximo 8 palavras, tom brincalhão/informal brasileiro, sem emoji em excesso.
- Deve remeter ao USO do produto, não só descrever ele.
- Não inventar dado de preço/desconto — isso vem à parte.
- Retornar só o título, sem aspas, sem explicação.

Produto: {{titulo_original}}
Categoria: {{categoria}}
```

Salvar resultado em `ofertas.titulo_gerado`. Ter uma segunda chamada de validação (ou o mesmo prompt com checagem) que rejeita títulos genéricos/repetidos e devolve pra fila de correção.

Mensagem final montada por template (fora da IA, determinístico, pra não ter alucinação de preço):

```
{{titulo_gerado}}

{{titulo_original}}

De R$ {{preco_de}} por R$ {{preco_por}}
Use o Cupom: {{cupom}}
{{link_afiliado}}
```

---

## FASE 5 — Fila de envio com throttle (1 a cada 5–10 min)

- Tabela `envios` funciona como fila: ao aprovar o título, criar registro `status = 'agendado'` com `enviado_em` calculado (próximo slot livre, respeitando o intervalo mínimo configurado por grupo).
- Workflow n8n com **Cron a cada 1 min** que verifica se há algum envio "vencido" (agendado para agora ou antes) e dispara via Evolution API — não um cron a cada 5-10 min direto, para não perder timing por reinício do worker.
- Intervalo aleatorizado dentro da janela (ex: entre 5 e 10 min, sorteado) para não parecer robótico e reduzir risco de bloqueio.
- Log de falhas de envio (`status = 'falhou'`) com retry.

---

## FASE 6 — Gestão de grupos (criação e rotação ao encher)

Esta é a parte tecnicamente mais delicada. Como o WhatsApp não expõe redirecionamento nativo de link de grupo, a solução realista é:

1. Monitorar `qtd_membros` via webhook da Evolution API (evento de entrada de membro) e atualizar `grupos.qtd_membros`.
2. Ao atingir `capacidade_maxima`, o workflow:
   - Marca o grupo atual como `status = 'cheio'`.
   - Cria um novo grupo via Evolution API (`numero_sequencial + 1`), gera o link de convite, grava em `grupos`.
   - **Não existe forma de "redirecionar" automaticamente quem clica no link antigo** — o link de um grupo cheio simplesmente não deixa mais entrar. A solução prática usada por canais grandes é: manter uma **página/bio curta (ex: linktr.ee ou uma landing simples sua)** que sempre aponta para "o grupo ativo mais recente", e usar ESSE link nas divulgações externas (bio do Instagram, etc.), não o link direto do grupo. Dentro do próprio grupo cheio, a última mensagem fixada informa o link do novo grupo.
3. Esse "link estável" pode ser uma rota simples no seu dashboard (`seudominio.com/entrar`) que faz redirect 302 para `grupos.link_convite` do grupo com `status = 'ativo'` mais recente daquele nicho — isso sim é 100% automatizável e é a peça que resolve o problema de verdade.

**Instrução para o Antigravity**: implementar o redirect (item 3) como rota HTTP simples antes de tentar qualquer solução mais complexa — é a parte que realmente funciona.

### 6.1 Uso com tráfego pago

Essa mesma rota de redirect é exatamente o link que você deve usar nos anúncios pagos (Meta Ads, Google Ads etc.) — nunca o link direto de um grupo específico. Vantagens de fazer assim:
- O anúncio sempre aponta pro grupo ativo correto, mesmo depois de rotacionar 10 vezes — você nunca precisa editar o anúncio.
- A rota pode receber os parâmetros de UTM do anúncio (`?utm_source=meta&utm_campaign=x`) e gravar isso numa tabela `cliques` antes de redirecionar, te dando métrica de custo por entrada no grupo (CPA real) separada por campanha/nicho.
- Dá pra segmentar: se um dia você tiver campanhas diferentes por nicho (tênis vs. casa), a própria rota escolhe o grupo certo com base num parâmetro (`?nicho=tenis`), sem precisar de link diferente por campanha.

```sql
create table cliques (
  id uuid primary key default gen_random_uuid(),
  nicho text,
  utm_source text,
  utm_campaign text,
  grupo_destino_id uuid references grupos(id),
  criado_em timestamptz default now()
);
```

### 6.2 O grupo ser "privado, só eu falo" reduz risco — mas não zera

O bloqueio do WhatsApp não é sobre quem responde, é sobre **padrão de automação detectado no número**. Os principais gatilhos, mesmo num grupo silencioso onde só o admin posta:
- Uso de biblioteca não-oficial (Evolution/Baileys) em si já é o maior fator de risco — o WhatsApp tem heurísticas para reconhecer esse tipo de conexão (fingerprint diferente do app oficial).
- Volume e frequência de ações administrativas automatizadas: criar grupos em sequência, adicionar/remover membros em massa, trocar links de convite repetidamente.
- Links de afiliado (`meli.la`, encurtadores, domínios de cupom) sendo compartilhados em massa por um número novo podem ser sinalizados como spam pelos próprios sistemas anti-spam da Meta, independente de grupo.
- Denúncias: mesmo em grupo silencioso, se muita gente sair e denunciar o número (comum quando a pessoa entra só pra pegar 1 cupom e depois marca como spam), isso pesa.
- Entrada de muita gente nova em curto espaço de tempo vindo de anúncio pago é, paradoxalmente, um padrão que se parece com comportamento de bot recrutando contatos — vale aquecer o número gradualmente e não escalar tráfego pago de forma abrupta logo no primeiro grupo.

Ou seja: o risco existe mesmo no seu cenário (mensagem só do admin, entrada só por link de produto), só é menor do que ficar mandando mensagem individual pra milhares de contatos. Mitigação prática: números aquecidos por semanas antes de escalar tráfego pago, um chip por lote de grupos (não todos os grupos no mesmo número), e monitorar taxa de saída/denúncia como métrica de risco no próprio dashboard.

### 6.3 Fallback com API oficial da Meta (WhatsApp Business Platform / Cloud API)

Importante alinhar expectativa: **a API oficial da Meta não tem conceito de "grupo"** — ela serve para conversas 1:1 iniciadas pela empresa via mensagens de template aprovadas, com opt-in do usuário. Ela não substitui o grupo, mas serve como fallback em dois cenários:
- **Canal de recuperação**: se um número usado via Evolution API levar restrição/banimento, a API oficial pode manter um canal de contato direto (via template aprovado) com quem já era membro do grupo (desde que tenham opt-in), evitando perda total de audiência.
- **Alternativa de distribuição**: para nichos que crescerem muito, migrar parte da distribuição para os **Canais do WhatsApp** ("Channels") — recurso nativo de broadcast, sem limite de "membros" no sentido de grupo, feito pra esse tipo de uso (canais de notícias/ofertas já usam isso hoje). Não é acessível via API oficial da Meta (é recurso do app comum/Business App), mas é operacionalmente mais parecido com o que você quer do que a API 1:1, e tem menor risco de bloqueio por ser um formato pensado justamente pra broadcast em massa.

**Instrução para o Antigravity**: implementar o módulo de envio (Fase 5) com uma interface abstrata (`enviar_mensagem(canal, destino, conteudo)`), onde o canal pode ser `evolution_api` hoje e `whatsapp_cloud_api` ou `canal_whatsapp` amanhã, sem reescrever a lógica de fila/throttle.

---

## FASE 7 — Dashboard (VPS)

MVP mínimo, sem exagero de frontend:
- Página 1: lista de grupos ativos por nicho, com `qtd_membros`, link, status.
- Página 2: ofertas enviadas (histórico), com plataforma, desconto, data.
- Página 3: comissões (input manual no começo — a maioria das redes de afiliado não expõe API de comissão em tempo real; isso normalmente é relatório baixado do painel da rede e importado).
- Autenticação simples (só você acessa).

Tecnicamente: Next.js consumindo Supabase direto (Supabase já dá API REST/Realtime pronta), hospedado na mesma VPS via PM2/Docker.

---

## FASE 8 — Expansão para outros nichos

Só depois do nicho "tênis" rodando estável por algumas semanas com métricas reais (cliques, entradas, comissões):
- Duplicar a Fase 2–7 trocando `categoria`/`nicho` (casa, perfumes) — o schema já foi desenhado para isso (`categoria`/`nicho` como campo, não como tabela separada), então é configuração, não código novo.

---

## Ordem de execução resumida (para o Antigravity seguir literalmente)

1. Confirmar Fase 0 completa (não avançar sem credenciais reais).
2. Fase 1 — schema Supabase.
3. Fase 2 — coletores, um de cada vez, validando antes de ligar o próximo.
4. Fase 3 — validação/ranking.
5. Fase 4 — geração de título IA + template de mensagem.
6. Fase 5 — fila de envio com throttle.
7. Fase 6 — gestão de grupos + rota de redirect estável.
8. Fase 7 — dashboard.
9. Só então Fase 8.

Cada fase deve ser tratada como checkpoint: testar isoladamente, reportar o que funcionou/quebrou, e só então seguir para a próxima — evita o efeito de "loop de erro" que você mencionou.
