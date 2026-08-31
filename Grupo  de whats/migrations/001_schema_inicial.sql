-- ============================================================
-- MIGRATION: Schema inicial do Sistema de Grupos de Ofertas
-- Executar no Supabase SQL Editor (ou via CLI supabase db push)
-- ============================================================

-- Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. OFERTAS (core do sistema)
-- ============================================================
CREATE TABLE IF NOT EXISTS ofertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma TEXT NOT NULL CHECK (plataforma IN ('shopee', 'mercado_livre', 'amazon', 'shein', 'netshoes', 'centauro')),
  categoria TEXT NOT NULL DEFAULT 'tenis',
  titulo_original TEXT NOT NULL,
  titulo_gerado TEXT,
  preco_de NUMERIC(10,2),
  preco_por NUMERIC(10,2),
  desconto_pct NUMERIC(5,1) GENERATED ALWAYS AS (
    CASE WHEN preco_de > 0 AND preco_por > 0 
    THEN ROUND((1 - preco_por / preco_de) * 100, 1) 
    ELSE 0 END
  ) STORED,
  cupom TEXT,
  link_original TEXT,
  link_afiliado TEXT NOT NULL,
  imagem_url TEXT,
  fonte TEXT NOT NULL DEFAULT 'api_afiliado' CHECK (fonte IN ('api_afiliado', 'scraper', 'manual')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'enviada', 'descartada', 'erro_ia')),
  hash_produto TEXT,
  motivo_descarte TEXT,
  tentativas_ia INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ofertas_status ON ofertas(status);
CREATE INDEX IF NOT EXISTS idx_ofertas_status_criado ON ofertas(status, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ofertas_plataforma ON ofertas(plataforma);
CREATE INDEX IF NOT EXISTS idx_ofertas_hash ON ofertas(hash_produto);
CREATE INDEX IF NOT EXISTS idx_ofertas_criado ON ofertas(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ofertas_categoria ON ofertas(categoria);

-- ============================================================
-- 2. INSTÂNCIAS EVOGO (multi-chip)
-- ============================================================
CREATE TABLE IF NOT EXISTS instancias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  numero_whatsapp TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'pausado', 'banido', 'aquecendo')),
  qtd_grupos INT DEFAULT 0,
  max_grupos INT DEFAULT 5,
  max_mensagens_hora INT DEFAULT 20,
  mensagens_hoje INT DEFAULT 0,
  ultimo_reset_contagem DATE DEFAULT CURRENT_DATE,
  ultimo_envio_em TIMESTAMPTZ,
  notas TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. GRUPOS DE WHATSAPP
-- ============================================================
CREATE TABLE IF NOT EXISTS grupos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nicho TEXT NOT NULL DEFAULT 'tenis',
  numero_sequencial INT NOT NULL,
  nome_grupo TEXT NOT NULL,
  whatsapp_group_id TEXT UNIQUE,
  link_convite TEXT,
  instancia_id UUID REFERENCES instancias(id),
  qtd_membros INT DEFAULT 0,
  capacidade_maxima INT DEFAULT 950,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'cheio', 'arquivado', 'banido')),
  ultimo_envio_em TIMESTAMPTZ,
  total_ofertas_enviadas INT DEFAULT 0,
  ofertas_hoje INT DEFAULT 0,
  ultimo_reset_ofertas DATE DEFAULT CURRENT_DATE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(nicho, numero_sequencial)
);

CREATE INDEX IF NOT EXISTS idx_grupos_nicho_status ON grupos(nicho, status);
CREATE INDEX IF NOT EXISTS idx_grupos_status ON grupos(status);

-- ============================================================
-- 4. FILA/LOG DE ENVIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id UUID NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
  grupo_id UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  instancia_id UUID REFERENCES instancias(id),
  mensagem_completa TEXT,
  agendado_para TIMESTAMPTZ NOT NULL,
  enviado_em TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'enviando', 'enviado', 'falhou', 'cancelado')),
  tentativas INT DEFAULT 0,
  max_tentativas INT DEFAULT 3,
  erro TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_envios_agendado ON envios(agendado_para) WHERE status = 'agendado';
CREATE INDEX IF NOT EXISTS idx_envios_status ON envios(status);
CREATE INDEX IF NOT EXISTS idx_envios_grupo ON envios(grupo_id);
CREATE INDEX IF NOT EXISTS idx_envios_oferta ON envios(oferta_id);

-- ============================================================
-- 5. COMISSÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS comissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id UUID REFERENCES ofertas(id),
  plataforma TEXT NOT NULL,
  valor_venda NUMERIC(10,2),
  valor_comissao NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'paga', 'cancelada')),
  referencia_externa TEXT,
  notas TEXT,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comissoes_status ON comissoes(status);
CREATE INDEX IF NOT EXISTS idx_comissoes_plataforma ON comissoes(plataforma);
CREATE INDEX IF NOT EXISTS idx_comissoes_registrado ON comissoes(registrado_em DESC);

-- ============================================================
-- 6. CLIQUES (tracking do link de redirect)
-- ============================================================
CREATE TABLE IF NOT EXISTS cliques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nicho TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  grupo_destino_id UUID REFERENCES grupos(id),
  ip_hash TEXT,
  user_agent TEXT,
  referer TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cliques_nicho ON cliques(nicho);
CREATE INDEX IF NOT EXISTS idx_cliques_criado ON cliques(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_cliques_utm ON cliques(utm_source, utm_campaign);

-- ============================================================
-- 7. LOG DE SAÚDE / MONITORAMENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS log_saude (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id UUID REFERENCES instancias(id),
  grupo_id UUID REFERENCES grupos(id),
  evento TEXT NOT NULL CHECK (evento IN (
    'membro_entrou', 'membro_saiu', 'denuncia', 
    'erro_envio', 'grupo_criado', 'grupo_cheio',
    'instancia_pausada', 'instancia_banida',
    'rotacao_grupo', 'alerta_saida'
  )),
  detalhes JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_saude_evento ON log_saude(evento);
CREATE INDEX IF NOT EXISTS idx_log_saude_criado ON log_saude(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_log_saude_grupo ON log_saude(grupo_id);

-- ============================================================
-- 8. CONFIGURAÇÕES DO SISTEMA
-- ============================================================
CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY,
  valor JSONB NOT NULL,
  descricao TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO configuracoes (chave, valor, descricao) VALUES
  ('intervalo_envio_min', '5', 'Minutos mínimos entre envios por grupo'),
  ('intervalo_envio_max', '10', 'Minutos máximos entre envios por grupo'),
  ('desconto_minimo', '30', 'Desconto mínimo (%) para aprovar oferta'),
  ('preco_min_tenis', '30', 'Preço mínimo (R$) plausível para tênis'),
  ('preco_max_tenis', '500', 'Preço máximo (R$) plausível para tênis'),
  ('max_ofertas_dia_grupo', '60', 'Máximo de ofertas por dia por grupo'),
  ('capacidade_maxima_grupo', '950', 'Membros máx antes de rotacionar'),
  ('horario_inicio', '8', 'Hora de início dos envios (BRT)'),
  ('horario_fim', '22', 'Hora de fim dos envios (BRT)'),
  ('max_mensagens_hora_instancia', '20', 'Máximo mensagens por hora por instância'),
  ('taxa_saida_alerta', '5', 'Taxa de saída (%) que gera alerta'),
  ('jitter_segundos', '30', 'Variação em segundos no envio (humanização)')
ON CONFLICT (chave) DO NOTHING;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Função para calcular próximo slot de envio
CREATE OR REPLACE FUNCTION proximo_slot_envio(p_grupo_id UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  ultimo TIMESTAMPTZ;
  intervalo_min INT;
  intervalo_max INT;
  jitter INT;
  proximo TIMESTAMPTZ;
  hora_inicio INT;
  hora_fim INT;
BEGIN
  SELECT MAX(agendado_para) INTO ultimo
  FROM envios
  WHERE grupo_id = p_grupo_id AND status IN ('agendado', 'enviado', 'enviando');

  IF ultimo IS NULL OR ultimo < NOW() THEN
    ultimo := NOW();
  END IF;

  SELECT (valor#>>'{}')::INT INTO intervalo_min FROM configuracoes WHERE chave = 'intervalo_envio_min';
  SELECT (valor#>>'{}')::INT INTO intervalo_max FROM configuracoes WHERE chave = 'intervalo_envio_max';
  SELECT (valor#>>'{}')::INT INTO jitter FROM configuracoes WHERE chave = 'jitter_segundos';
  SELECT (valor#>>'{}')::INT INTO hora_inicio FROM configuracoes WHERE chave = 'horario_inicio';
  SELECT (valor#>>'{}')::INT INTO hora_fim FROM configuracoes WHERE chave = 'horario_fim';

  -- Defaults
  intervalo_min := COALESCE(intervalo_min, 5);
  intervalo_max := COALESCE(intervalo_max, 10);
  jitter := COALESCE(jitter, 30);
  hora_inicio := COALESCE(hora_inicio, 8);
  hora_fim := COALESCE(hora_fim, 22);

  -- Calcular próximo slot com variação aleatória
  proximo := ultimo + (
    (intervalo_min + floor(random() * (intervalo_max - intervalo_min + 1)))::INT * INTERVAL '1 minute'
  ) + (floor(random() * jitter * 2) - jitter)::INT * INTERVAL '1 second';

  -- Se cair fora do horário, empurrar para o próximo dia
  IF EXTRACT(HOUR FROM proximo AT TIME ZONE 'America/Sao_Paulo') >= hora_fim THEN
    proximo := (proximo AT TIME ZONE 'America/Sao_Paulo')::DATE + 1 + hora_inicio * INTERVAL '1 hour';
    proximo := proximo AT TIME ZONE 'America/Sao_Paulo';
  ELSIF EXTRACT(HOUR FROM proximo AT TIME ZONE 'America/Sao_Paulo') < hora_inicio THEN
    proximo := (proximo AT TIME ZONE 'America/Sao_Paulo')::DATE + hora_inicio * INTERVAL '1 hour';
    proximo := proximo AT TIME ZONE 'America/Sao_Paulo';
  END IF;

  RETURN proximo;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar se uma oferta é duplicata
CREATE OR REPLACE FUNCTION is_oferta_duplicata(p_hash TEXT, p_horas INT DEFAULT 24)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM ofertas
    WHERE hash_produto = p_hash
    AND criado_em > NOW() - (p_horas || ' hours')::INTERVAL
    AND status NOT IN ('descartada')
  );
END;
$$ LANGUAGE plpgsql;

-- Função para pegar o grupo ativo mais recente de um nicho
CREATE OR REPLACE FUNCTION grupo_ativo(p_nicho TEXT DEFAULT 'tenis')
RETURNS TABLE(id UUID, nome_grupo TEXT, link_convite TEXT, qtd_membros INT) AS $$
BEGIN
  RETURN QUERY
  SELECT g.id, g.nome_grupo, g.link_convite, g.qtd_membros
  FROM grupos g
  WHERE g.nicho = p_nicho AND g.status = 'ativo'
  ORDER BY g.numero_sequencial DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Função para calcular taxa de saída de um grupo nas últimas N horas
CREATE OR REPLACE FUNCTION taxa_saida_grupo(p_grupo_id UUID, p_horas INT DEFAULT 24)
RETURNS NUMERIC AS $$
DECLARE
  total_saidas INT;
  total_entradas INT;
BEGIN
  SELECT COUNT(*) INTO total_saidas
  FROM log_saude
  WHERE grupo_id = p_grupo_id
  AND evento = 'membro_saiu'
  AND criado_em > NOW() - (p_horas || ' hours')::INTERVAL;

  SELECT COUNT(*) INTO total_entradas
  FROM log_saude
  WHERE grupo_id = p_grupo_id
  AND evento = 'membro_entrou'
  AND criado_em > NOW() - (p_horas || ' hours')::INTERVAL;

  IF total_entradas = 0 THEN RETURN 0; END IF;
  RETURN ROUND((total_saidas::NUMERIC / GREATEST(total_entradas, 1)) * 100, 1);
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar campo atualizado_em
CREATE OR REPLACE FUNCTION update_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ofertas_updated
  BEFORE UPDATE ON ofertas
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

-- Função para resetar contadores diários
CREATE OR REPLACE FUNCTION reset_contadores_diarios()
RETURNS void AS $$
BEGIN
  UPDATE instancias
  SET mensagens_hoje = 0, ultimo_reset_contagem = CURRENT_DATE
  WHERE ultimo_reset_contagem < CURRENT_DATE;

  UPDATE grupos
  SET ofertas_hoje = 0, ultimo_reset_ofertas = CURRENT_DATE
  WHERE ultimo_reset_ofertas < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE ofertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliques ENABLE ROW LEVEL SECURITY;
ALTER TABLE instancias ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_saude ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

-- Política: usuário autenticado tem acesso total
CREATE POLICY "auth_full_access" ON ofertas FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_full_access" ON grupos FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_full_access" ON envios FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_full_access" ON comissoes FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_full_access" ON cliques FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_full_access" ON instancias FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_full_access" ON log_saude FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_full_access" ON configuracoes FOR ALL USING (auth.uid() IS NOT NULL);

-- Política para service role (n8n/backend usa service key, bypassa RLS)
-- O service_role key do Supabase já bypassa RLS por padrão.

-- ============================================================
-- VIEWS para o Dashboard
-- ============================================================

-- KPIs principais
CREATE OR REPLACE VIEW vw_kpis AS
SELECT
  (SELECT COUNT(*) FROM grupos WHERE status = 'ativo') AS grupos_ativos,
  (SELECT COALESCE(SUM(qtd_membros), 0) FROM grupos WHERE status IN ('ativo', 'cheio')) AS total_membros,
  (SELECT COUNT(*) FROM ofertas WHERE criado_em::DATE = CURRENT_DATE) AS ofertas_hoje,
  (SELECT COUNT(*) FROM envios WHERE status = 'enviado' AND enviado_em::DATE = CURRENT_DATE) AS enviadas_hoje,
  (SELECT COALESCE(SUM(valor_comissao), 0) FROM comissoes WHERE status IN ('aprovada', 'paga') AND registrado_em >= DATE_TRUNC('month', NOW())) AS comissoes_mes,
  (SELECT COUNT(*) FROM comissoes WHERE status IN ('aprovada', 'paga') AND registrado_em >= DATE_TRUNC('month', NOW())) AS vendas_mes,
  (SELECT COUNT(*) FROM cliques WHERE criado_em::DATE = CURRENT_DATE) AS cliques_hoje;

-- Ofertas por plataforma (últimos 7 dias)
CREATE OR REPLACE VIEW vw_ofertas_por_plataforma AS
SELECT
  plataforma,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'enviada') AS enviadas,
  COUNT(*) FILTER (WHERE status = 'descartada') AS descartadas,
  ROUND(AVG(desconto_pct), 1) AS desconto_medio
FROM ofertas
WHERE criado_em >= NOW() - INTERVAL '7 days'
GROUP BY plataforma
ORDER BY total DESC;

-- Saúde dos grupos
CREATE OR REPLACE VIEW vw_saude_grupos AS
SELECT
  g.id,
  g.nome_grupo,
  g.nicho,
  g.qtd_membros,
  g.status,
  g.ofertas_hoje,
  g.total_ofertas_enviadas,
  taxa_saida_grupo(g.id, 24) AS taxa_saida_24h,
  g.ultimo_envio_em,
  g.criado_em
FROM grupos g
ORDER BY g.nicho, g.numero_sequencial;

-- ============================================================
-- 9. SEED DATA INICIAL
-- ============================================================
INSERT INTO instancias (nome, numero_whatsapp, status, qtd_grupos, max_grupos, max_mensagens_hora)
VALUES ('Number_4847', '554899999999', 'ativo', 1, 5, 20)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO grupos (nicho, numero_sequencial, nome_grupo, link_convite, status, capacidade_maxima)
SELECT 'tenis', 1, '🔥 Tênis Ofertas VIP #1', 'https://chat.whatsapp.com/sample-group-invite', 'ativo', 950
WHERE NOT EXISTS (SELECT 1 FROM grupos WHERE nicho = 'tenis' AND numero_sequencial = 1);

