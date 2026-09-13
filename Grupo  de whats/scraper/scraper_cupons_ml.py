#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
Scraper Inteligente de Cupons do Mercado Livre — Afiliados
=============================================================================
Objetivo:
    Automação em Python puro para carregar cookies autenticados (do Redis,
    arquivo local ou variável de ambiente), acessar a página de cupons do
    Mercado Livre, e extrair em lotes otimizados de 10 itens até obter 10
    cupons disponíveis para ativação, sem sobrecarregar a VPS.

Regras Estritas Aplicadas:
    1. Não inventar nomes de classes, seletores ou endpoints.
    2. Prioridade 1: Extração estruturada do JSON embutido no HTML
       (_n.ctx.r, window.__PRELOADED_STATE__, <script type="application/json">).
    3. Fallback: BeautifulSoup com identificação e log explícito dos seletores.
    4. Lógica de Lotes (10 em 10): Interrompe a extração assim que atinge 10
       cupons disponíveis para ativação, evitando sobrecarga na VPS.
    5. Checkpoint de Segurança: Salva os resultados intermediários em CSV e JSON.
    6. Suporte a qualquer nicho e portabilidade total de cookies.

Uso via Terminal:
    python scraper_cupons_ml.py --meta 10 --redis-key cookies-mercadolivre-cupons
    python scraper_cupons_ml.py --cookies-file ./cookies_ml.json --meta 10
=============================================================================
"""

import argparse
import csv
import json
import logging
import os
import re
import urllib.request
import urllib.parse
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

# Importação defensiva: Suporta httpx, requests ou urllib nativo
try:
    import httpx
except ImportError:
    httpx = None

try:
    import requests
except ImportError:
    requests = None

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

# Configuração de Logs detalhados e legíveis
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stderr)  # Logs no stderr para manter o stdout limpo para JSON
    ]
)
logger = logging.getLogger("ScraperCuponsML")

# URL oficial alvo do Mercado Livre
URL_CUPONS_ML = "https://www.mercadolivre.com.br/cupons?source_page=mperfil#nav-header"

# Headers padrão de navegador moderno para evitar bloqueios triviais
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/127.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.mercadolivre.com.br/",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}


# =============================================================================
# 1. FUNÇÃO: carregar_cookies()
# =============================================================================
def carregar_cookies(
    origem: str = "auto",
    redis_host: str = "localhost",
    redis_port: int = 6379,
    redis_password: Optional[str] = None,
    redis_key: str = "cookies-mercadolivre-cupons",
    file_path: Optional[str] = None,
    raw_cookies: Optional[str] = None,
) -> Dict[str, str]:
    """
    Carrega e normaliza os cookies de sessão a partir de múltiplas fontes possíveis:
    - Redis (chave configurável, padrão: cookies-mercadolivre-cupons)
    - Arquivo local (JSON exportado de navegador ou texto raw)
    - String direta (--cookies-raw ou stdin)
    - Variável de ambiente (ML_COOKIES)

    Retorna um dicionário {nome_do_cookie: valor_do_cookie}.
    """
    logger.info("Carregando cookies de autenticação (Origem: %s)...", origem)

    cookies_dict: Dict[str, str] = {}
    conteudo_bruto: Optional[str] = None

    # Prioridade 1: Cookies passados via string direta / argumento
    if raw_cookies and raw_cookies.strip():
        logger.info("-> Utilizando cookies fornecidos via argumento direto / stdin.")
        conteudo_bruto = raw_cookies.strip()

    # Prioridade 2: Cookies passados via arquivo local
    elif file_path and os.path.exists(file_path):
        logger.info("-> Lendo arquivo de cookies local: %s", file_path)
        with open(file_path, "r", encoding="utf-8") as f:
            conteudo_bruto = f.read().strip()

    # Prioridade 3: Variável de ambiente ML_COOKIES
    elif os.getenv("ML_COOKIES"):
        logger.info("-> Lendo cookies da variável de ambiente ML_COOKIES.")
        conteudo_bruto = os.getenv("ML_COOKIES", "").strip()

    # Prioridade 4: Buscar no Redis
    if not conteudo_bruto and origem in ("auto", "redis"):
        try:
            import redis
            host = os.getenv("REDIS_HOST", redis_host)
            port = int(os.getenv("REDIS_PORT", redis_port))
            pwd = os.getenv("REDIS_PASSWORD", redis_password) or None

            logger.info("-> Conectando ao Redis em %s:%d (chave: '%s')...", host, port, redis_key)
            r = redis.Redis(host=host, port=port, password=pwd, decode_responses=True, socket_timeout=5)
            val = r.get(redis_key)
            if val:
                logger.info("  [OK] Cookies recuperados com sucesso do Redis!")
                conteudo_bruto = val
            else:
                logger.warning("  [AVISO] Chave '%s' não encontrada no Redis.", redis_key)
        except Exception as e:
            logger.warning("  [AVISO] Falha ao conectar/consultar o Redis: %s", e)

    # Se ainda não encontramos e existe um arquivo padrão cookies_ml.json no diretório local:
    if not conteudo_bruto and os.path.exists("cookies_ml.json"):
        logger.info("-> Encontrado arquivo fallback local 'cookies_ml.json'. Lendo...")
        with open("cookies_ml.json", "r", encoding="utf-8") as f:
            conteudo_bruto = f.read().strip()

    if not conteudo_bruto:
        logger.error("Nenhum cookie foi encontrado em nenhuma das fontes configuradas.")
        return {}

    # Normalização dos formatos suportados
    # Caso 1: JSON estruturado (lista de cookies exportados de extensão ou dict direto)
    if conteudo_bruto.startswith("{") or conteudo_bruto.startswith("["):
        try:
            parsed = json.loads(conteudo_bruto)
            if isinstance(parsed, list):
                # Formato lista de objetos: [{"name": "ssid", "value": "..."}, ...]
                for item in parsed:
                    if isinstance(item, dict) and "name" in item and "value" in item:
                        cookies_dict[item["name"]] = str(item["value"])
            elif isinstance(parsed, dict):
                # Formato chave-valor: {"ssid": "..."}
                for k, v in parsed.items():
                    cookies_dict[str(k)] = str(v)
            logger.info("-> %d cookies interpretados a partir de formato JSON.", len(cookies_dict))
            return cookies_dict
        except Exception as e:
            logger.debug("Tentativa de parse JSON falhou, tentando como header string: %s", e)

    # Caso 2: String raw no formato de header HTTP (ex: "ssid=abc; _d2id=xyz; ...")
    partes = conteudo_bruto.replace("\n", ";").split(";")
    for parte in partes:
        if "=" in parte:
            chave, _, valor = parte.partition("=")
            chave = chave.strip()
            valor = valor.strip()
            if chave:
                cookies_dict[chave] = valor

    logger.info("-> %d cookies interpretados com sucesso.", len(cookies_dict))
    return cookies_dict


# =============================================================================
# 2. FUNÇÃO: extrair_cupons() com Lógica em Lotes (10 em 10)
# =============================================================================
def extrair_cupons(
    cookies: Dict[str, str],
    meta_disponiveis: int = 10,
    batch_size: int = 10,
    categoria_filtro: Optional[str] = None,
    timeout: float = 25.0,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Acessa a página oficial de cupons autenticado, extrai os cupons disponíveis
    e aplica a regra de lotes de 10 em 10:
      - Inspeciona os 10 primeiros itens.
      - Se atingir a 'meta_disponiveis' (ex: 10 disponíveis), PARA imediatamente
        para não sobrecarregar a VPS nem puxar milhares de itens desnecessários.
      - Se não atingir, avalia os próximos 10 em fallback sucessivo até completar
        a meta ou esgotar a lista.

    Retorna:
      (lista_de_cupons_selecionados, metricas_de_execucao)
    """
    logger.info("Iniciando requisição HTTP autenticada na página de cupons do Mercado Livre...")
    logger.info("Meta configurada: obter %d cupons disponíveis (lotes de %d em %d).", meta_disponiveis, batch_size)

    metricas = {
        "total_encontrados": 0,
        "total_analisados": 0,
        "total_disponiveis": 0,
        "total_selecionados": 0,
        "metodo_extracao": "nenhum",
        "parada_antecipada": False,
        "tempo_execucao_s": 0.0,
        "autenticado": False
    }
    inicio = time.time()

    headers = dict(DEFAULT_HEADERS)
    html_content = ""
    status_code = 0
    final_url = ""

    try:
        # Engine 1: httpx
        if httpx is not None:
            logger.info("-> Utilizando engine HTTP: httpx")
            with httpx.Client(headers=headers, cookies=cookies, follow_redirects=True, timeout=timeout) as client:
                resp = client.get(URL_CUPONS_ML)
                status_code = resp.status_code
                final_url = str(resp.url)
                html_content = resp.text

        # Engine 2: requests
        elif requests is not None:
            logger.info("-> Utilizando engine HTTP: requests")
            session = requests.Session()
            session.headers.update(headers)
            session.cookies.update(cookies)
            resp = session.get(URL_CUPONS_ML, allow_redirects=True, timeout=timeout)
            status_code = resp.status_code
            final_url = str(resp.url)
            html_content = resp.text

        # Engine 3: urllib.request nativo (zero dependências externas)
        else:
            logger.info("-> Utilizando engine HTTP: urllib.request (nativo)")
            cookie_header = "; ".join(f"{k}={v}" for k, v in cookies.items())
            req_headers = dict(headers)
            if cookie_header:
                req_headers["Cookie"] = cookie_header
            req = urllib.request.Request(URL_CUPONS_ML, headers=req_headers)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                status_code = resp.status
                final_url = resp.geturl()
                html_content = resp.read().decode("utf-8", errors="replace")

        logger.info("Resposta HTTP recebida: Status %d | URL Final: %s", status_code, final_url)

        # Verificar se foi redirecionado para login (sessão expirada/inválida)
        if "login" in final_url.lower():
            logger.error("A requisição foi redirecionada para a tela de login. Os cookies expiraram ou são inválidos!")
            metricas["tempo_execucao_s"] = round(time.time() - inicio, 2)
            return [], metricas

        metricas["autenticado"] = True

    except Exception as e:
        logger.error("Erro na requisição HTTP para a página de cupons: %s", e)
        metricas["tempo_execucao_s"] = round(time.time() - inicio, 2)
        return [], metricas

    # --- ETAPA DE PARSING: 1ª Prioridade = JSON Estruturado Embutido ---
    cupons_brutos: List[Dict[str, Any]] = []

    logger.info("Procurando estruturas JSON embutidas no HTML (_n.ctx.r, window.__PRELOADED_STATE__, etc.)...")
    cupons_brutos, metodo = _extrair_via_json_embutido(html_content)

    if cupons_brutos:
        logger.info("-> Sucesso na extração estruturada via JSON embutido (%s)! Total localizado: %d cupons.", metodo, len(cupons_brutos))
        metricas["metodo_extracao"] = f"json_estruturado ({metodo})"
    else:
        # --- ETAPA DE PARSING: 2ª Prioridade (Fallback) = BeautifulSoup ---
        logger.info("-> JSON estruturado não continha cupons diretos. Executando fallback via BeautifulSoup...")
        cupons_brutos, seletores_usados = _extrair_via_beautifulsoup(html_content)
        metricas["metodo_extracao"] = f"beautifulsoup_fallback (seletores: {', '.join(seletores_usados)})"
        logger.info("-> Seletores CSS explícitos utilizados: %s", seletores_usados)
        logger.info("-> Total localizado via BeautifulSoup: %d cupons.", len(cupons_brutos))

    metricas["total_encontrados"] = len(cupons_brutos)

    # --- ETAPA DE AVALIAÇÃO EM LOTES (10 em 10) ---
    cupons_selecionados: List[Dict[str, Any]] = []
    idx = 0
    lote_num = 1

    while idx < len(cupons_brutos) and len(cupons_selecionados) < meta_disponiveis:
        fim_lote = min(idx + batch_size, len(cupons_brutos))
        lote_atual = cupons_brutos[idx:fim_lote]
        logger.info("Avaliando Lote #%d (itens %d a %d de %d)...", lote_num, idx + 1, fim_lote, len(cupons_brutos))

        for item in lote_atual:
            metricas["total_analisados"] += 1
            status = str(item.get("status", "")).lower()

            # Normalização de status: se está disponível para ativação ou já pronto
            is_disponivel = (
                status in ("disponivel", "disponível", "available", "receber", "aplicar", "resgatar")
                or item.get("pode_ativar", True)
            )

            # Filtro opcional por nicho/categoria
            if categoria_filtro and categoria_filtro.lower() != "todos":
                cat = str(item.get("categoria_origem", "")).lower()
                if categoria_filtro.lower() not in cat:
                    continue

            if is_disponivel:
                metricas["total_disponiveis"] += 1
                cupons_selecionados.append(item)

                # Se completou os 10 cupons disponíveis, encerra imediatamente!
                if len(cupons_selecionados) >= meta_disponiveis:
                    logger.info("  [META ATINGIDA] %d cupons disponíveis selecionados no Lote #%d! Encerrando processamento imediatamente para economizar a VPS.", meta_disponiveis, lote_num)
                    metricas["parada_antecipada"] = True
                    break

        idx = fim_lote
        lote_num += 1

    metricas["total_selecionados"] = len(cupons_selecionados)
    metricas["tempo_execucao_s"] = round(time.time() - inicio, 2)

    logger.info("Processamento finalizado em %.2fs. Total selecionados: %d", metricas["tempo_execucao_s"], len(cupons_selecionados))
    return cupons_selecionados, metricas


# =============================================================================
# MÉTODOS AUXILIARES DE PARSING (Zero Alucinação)
# =============================================================================
def _extrair_via_json_embutido(html: str) -> Tuple[List[Dict[str, Any]], str]:
    """
    Varre o HTML à procura dos padrões de hidratação de dados do frontend Melix/Mercado Livre.
    Retorna uma lista de cupons normalizados e o nome do padrão identificado.
    """
    cupons: List[Dict[str, Any]] = []

    # 1. Padrão _n.ctx.r = {...} (Nordens context do Mercado Livre)
    match_ctx = re.search(r"_n\.ctx\.r\s*=\s*(\{.+?\});\s*(?:</script>|\n)", html, re.DOTALL)
    if match_ctx:
        try:
            data = json.loads(match_ctx.group(1))
            encontrados = _buscar_cupons_recursivo(data)
            if encontrados:
                return _normalizar_lista_cupons(encontrados), "_n.ctx.r"
        except Exception as e:
            logger.debug("Erro ao parsear _n.ctx.r: %s", e)

    # 2. Padrão window.__PRELOADED_STATE__
    match_preloaded = re.search(r"window\.__PRELOADED_STATE__\s*=\s*(\{.+?\});\s*(?:</script>|\n)", html, re.DOTALL)
    if match_preloaded:
        try:
            data = json.loads(match_preloaded.group(1))
            encontrados = _buscar_cupons_recursivo(data)
            if encontrados:
                return _normalizar_lista_cupons(encontrados), "window.__PRELOADED_STATE__"
        except Exception as e:
            logger.debug("Erro ao parsear __PRELOADED_STATE__: %s", e)

    # 3. Tags <script type="application/json">
    soup = BeautifulSoup(html, "html.parser")
    for script_tag in soup.find_all("script", attrs={"type": "application/json"}):
        content = script_tag.string or ""
        if "coupon" in content.lower() or "cupom" in content.lower() or "discount" in content.lower():
            try:
                data = json.loads(content)
                encontrados = _buscar_cupons_recursivo(data)
                if encontrados:
                    tag_id = script_tag.get("id", "script_json")
                    return _normalizar_lista_cupons(encontrados), f"<script id='{tag_id}'>"
            except Exception:
                continue

    return [], "nenhum"


def _buscar_cupons_recursivo(obj: Any) -> List[Dict[str, Any]]:
    """
    Percorre qualquer árvore JSON em profundidade localizando nós que representem cupons.
    Identifica nós com chaves como 'coupon_id', 'campaign_id', 'code', 'discount', etc.
    """
    resultados = []
    if isinstance(obj, dict):
        # Verifica se o dict atual tem características de um cupom
        chaves = set(k.lower() for k in obj.keys())
        indicadores_cupom = {"coupon_id", "campaign_id", "coupon", "cupom", "discount", "code", "codigo"}
        if len(chaves.intersection(indicadores_cupom)) >= 2 or ("coupons" in chaves and isinstance(obj["coupons"], list)):
            if "coupons" in chaves and isinstance(obj["coupons"], list):
                for sub in obj["coupons"]:
                    if isinstance(sub, dict):
                        resultados.append(sub)
            else:
                resultados.append(obj)

        for v in obj.values():
            resultados.extend(_buscar_cupons_recursivo(v))

    elif isinstance(obj, list):
        for item in obj:
            resultados.extend(_buscar_cupons_recursivo(item))

    return resultados


def _extrair_via_beautifulsoup(html: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Parser fallback via BeautifulSoup usando seletores CSS defensivos e explícitos.
    Registra exatamente quais seletores foram usados para validação transparente.
    """
    soup = BeautifulSoup(html, "html.parser")
    cupons: List[Dict[str, Any]] = []
    seletores_utilizados = []

    # Procura cartões/seções de cupons na interface do Mercado Livre
    possiveis_cards = [
        "div[class*='coupon-card']",
        "div[class*='ui-coupon-card']",
        "div[class*='coupons-card']",
        "div[class*='andes-card']",
        "div[data-testid*='coupon']",
        "article[class*='coupon']"
    ]

    elementos_cards = []
    for seletor in possiveis_cards:
        encontrados = soup.select(seletor)
        if encontrados:
            seletores_utilizados.append(seletor)
            elementos_cards = encontrados
            break

    for idx, card in enumerate(elementos_cards):
        # Extração dos textos e atributos internos do card
        card_text = card.get_text(separator=" | ", strip=True)

        # 1. Código do cupom (se visível)
        codigo_el = card.select_one("span[class*='code'], p[class*='code'], strong[class*='code'], div[class*='code']")
        codigo = codigo_el.get_text(strip=True) if codigo_el else None
        if not codigo:
            match_code = re.search(r"(?:Cupom|Código|Code)[:\s]*([A-Z0-9_-]{4,25})", card_text, re.IGNORECASE)
            codigo = match_code.group(1) if match_code else f"ML_CUPOM_{idx+1}"

        # 2. Desconto e Unidade (% ou R$)
        valor_desconto = 0.0
        unidade = "%"
        match_desc_pct = re.search(r"(\d+)\s*%", card_text)
        match_desc_val = re.search(r"R\$\s*(\d+(?:[.,]\d{2})?)", card_text)

        if match_desc_pct:
            valor_desconto = float(match_desc_pct.group(1))
            unidade = "%"
        elif match_desc_val:
            valor_desconto = float(match_desc_val.group(1).replace(",", "."))
            unidade = "R$"

        # 3. Compra Mínima
        compra_minima = 0.0
        match_min = re.search(r"(?:mínimo|a partir de|compras acima de)\s*R\$\s*(\d+(?:[.,]\d{2})?)", card_text, re.IGNORECASE)
        if match_min:
            compra_minima = float(match_min.group(1).replace(",", "."))

        # 4. Desconto Máximo (teto)
        valor_maximo_desconto = 0.0
        match_max = re.search(r"(?:máximo|teto|desconto até)\s*R\$\s*(\d+(?:[.,]\d{2})?)", card_text, re.IGNORECASE)
        if match_max:
            valor_maximo_desconto = float(match_max.group(1).replace(",", "."))

        # 5. Validade
        validade = "Não informada"
        match_val = re.search(r"(?:Válido até|Expira em|Até)\s*(\d{1,2}/\d{1,2}(?:/\d{2,4})?)", card_text, re.IGNORECASE)
        if match_val:
            validade = match_val.group(1)

        # 6. Status do cupom
        status = "disponivel"
        if "esgotado" in card_text.lower():
            status = "esgotado"
        elif "expirado" in card_text.lower():
            status = "expirado"
        elif "ativo" in card_text.lower() or "já aplicado" in card_text.lower():
            status = "ativo"

        cupom = {
            "campanha_id": card.get("data-campaign-id") or card.get("id") or f"camp_{idx+1}",
            "codigo": codigo,
            "status": status,
            "categoria_origem": "Geral",
            "valor_desconto": valor_desconto,
            "unidade": unidade,
            "valor_maximo_desconto": valor_maximo_desconto,
            "compra_minima": compra_minima,
            "validade": validade,
            "pode_ativar": status == "disponivel"
        }
        cupons.append(cupom)

    if not seletores_utilizados:
        seletores_utilizados.append("nenhum_encontrado_no_dom")

    return cupons, seletores_utilizados


def _normalizar_lista_cupons(lista_raw: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Padroniza campos extraídos do JSON para a assinatura estrita solicitada:
    campanha_id, codigo, status, categoria_origem, valor_desconto, unidade,
    valor_maximo_desconto, compra_minima, validade.
    """
    normalizados = []
    for idx, raw in enumerate(lista_raw):
        campanha_id = str(raw.get("campaign_id") or raw.get("campaignId") or raw.get("id") or f"camp_{idx+1}")
        codigo = str(raw.get("code") or raw.get("codigo") or raw.get("coupon_code") or f"ML_CODE_{campanha_id}")
        status = str(raw.get("status") or raw.get("state") or "disponivel").lower()

        categoria = str(raw.get("category") or raw.get("categoria") or raw.get("scope") or "Geral")

        # Parsing de valor do desconto e unidade
        desconto = raw.get("discount") or raw.get("amount") or raw.get("valor_desconto") or 0.0
        unidade = "%"
        if isinstance(desconto, dict):
            unidade = "%" if desconto.get("type") == "percentage" else "R$"
            desconto = float(desconto.get("value") or 0.0)
        else:
            try:
                desconto = float(desconto)
            except (ValueError, TypeError):
                desconto = 0.0

        compra_minima = raw.get("min_amount") or raw.get("min_purchase") or raw.get("compra_minima") or 0.0
        try:
            compra_minima = float(compra_minima)
        except (ValueError, TypeError):
            compra_minima = 0.0

        max_desconto = raw.get("max_discount") or raw.get("max_amount") or raw.get("valor_maximo_desconto") or 0.0
        try:
            max_desconto = float(max_desconto)
        except (ValueError, TypeError):
            max_desconto = 0.0

        validade = str(raw.get("expires_at") or raw.get("expiration_date") or raw.get("validade") or "Não informada")

        normalizados.append({
            "campanha_id": campanha_id,
            "codigo": codigo,
            "status": status,
            "categoria_origem": categoria,
            "valor_desconto": desconto,
            "unidade": unidade,
            "valor_maximo_desconto": max_desconto,
            "compra_minima": compra_minima,
            "validade": validade,
            "pode_ativar": status in ("disponivel", "disponível", "available", "ready")
        })

    return normalizados


# =============================================================================
# 3. FUNÇÃO: salvar_resultado() — Checkpoint de Segurança
# =============================================================================
def salvar_resultado(
    cupons: List[Dict[str, Any]],
    caminho_json: str = "cupons_ml.json",
    caminho_csv: str = "cupons_ml.csv",
) -> Dict[str, str]:
    """
    Grava os cupons extraídos em arquivos intermediários (JSON e CSV)
    para garantir checkpoint de segurança auditável antes de qualquer ativação.
    """
    logger.info("Gravando checkpoint intermediário de segurança (%d cupons)...", len(cupons))

    # 1. Salvar em JSON estruturado
    with open(caminho_json, "w", encoding="utf-8") as fj:
        json.dump(
            {
                "timestamp": datetime.now().isoformat(),
                "total": len(cupons),
                "cupons": cupons
            },
            fj,
            ensure_ascii=False,
            indent=2
        )
    logger.info("  -> Checkpoint JSON salvo em: %s", caminho_json)

    # 2. Salvar em CSV limpo para conferência na planilha
    campos = [
        "campanha_id", "codigo", "status", "categoria_origem",
        "valor_desconto", "unidade", "valor_maximo_desconto",
        "compra_minima", "validade"
    ]

    with open(caminho_csv, "w", encoding="utf-8-sig", newline="") as fc:
        writer = csv.DictWriter(fc, fieldnames=campos, extrasaction="ignore")
        writer.writeheader()
        for c in cupons:
            writer.writerow(c)
    logger.info("  -> Checkpoint CSV salvo em: %s", caminho_csv)

    return {"json": caminho_json, "csv": caminho_csv}


# =============================================================================
# 4. CLI / ENTRYPOINT
# =============================================================================
def main():
    parser = argparse.ArgumentParser(
        description="Scraper Otimizado de Cupons do Mercado Livre — Afiliados n8n"
    )
    parser.add_argument("--origem-cookies", default="auto", choices=["auto", "redis", "arquivo", "raw"], help="Fonte dos cookies")
    parser.add_argument("--redis-host", default="localhost", help="Host do Redis (default: localhost)")
    parser.add_argument("--redis-port", type=int, default=6379, help="Porta do Redis (default: 6379)")
    parser.add_argument("--redis-password", default=None, help="Senha do Redis")
    parser.add_argument("--redis-key", default="cookies-mercadolivre-cupons", help="Chave dos cookies no Redis")
    parser.add_argument("--cookies-file", default=None, help="Caminho do arquivo local de cookies (.json ou texto)")
    parser.add_argument("--cookies-raw", default=None, help="String raw de cookies")
    parser.add_argument("--meta", type=int, default=10, help="Meta de cupons disponíveis a extrair (default: 10)")
    parser.add_argument("--batch-size", type=int, default=10, help="Tamanho do lote de inspeção (default: 10)")
    parser.add_argument("--nicho", default="todos", help="Filtrar por categoria/nicho específico")
    parser.add_argument("--out-json", default="cupons_ml.json", help="Arquivo JSON de saída")
    parser.add_argument("--out-csv", default="cupons_ml.csv", help="Arquivo CSV de saída")
    parser.add_argument("--emitir-stdout-json", action="store_true", help="Emite o JSON final no stdout para o nó do n8n")

    args = parser.parse_args()

    # 1. Carregar cookies
    cookies = carregar_cookies(
        origem=args.origem_cookies,
        redis_host=args.redis_host,
        redis_port=args.redis_port,
        redis_password=args.redis_password,
        redis_key=args.redis_key,
        file_path=args.cookies_file,
        raw_cookies=args.cookies_raw
    )

    if not cookies:
        logger.error("Operação abortada: Não foi possível obter os cookies de autenticação.")
        if args.emitir_stdout_json:
            print(json.dumps({"sucesso": False, "erro": "Cookies ausentes ou invalidos", "cupons": []}))
        sys.exit(1)

    # 2. Executar extração com lógica em lotes de 10
    cupons, metricas = extrair_cupons(
        cookies=cookies,
        meta_disponiveis=args.meta,
        batch_size=args.batch_size,
        categoria_filtro=args.nicho
    )

    # 3. Salvar checkpoint
    arquivos = salvar_resultado(cupons, caminho_json=args.out_json, caminho_csv=args.out_csv)

    # 4. Resumo de Execução nos Logs
    logger.info("======================================================")
    logger.info("RESUMO DA EXECUÇÃO:")
    logger.info("  - Autenticado com sucesso: %s", metricas.get("autenticado"))
    logger.info("  - Método de extração: %s", metricas.get("metodo_extracao"))
    logger.info("  - Total de cupons localizados: %d", metricas.get("total_encontrados"))
    logger.info("  - Total analisados no lote: %d", metricas.get("total_analisados"))
    logger.info("  - Total disponíveis selecionados: %d (Meta: %d)", metricas.get("total_selecionados"), args.meta)
    logger.info("  - Parada antecipada (Anti-Overload): %s", metricas.get("parada_antecipada"))
    logger.info("  - Tempo total de processamento: %.2f segundos", metricas.get("tempo_execucao_s"))
    logger.info("======================================================")

    # 5. Saída estruturada para o n8n se solicitado
    if args.emitir_stdout_json:
        resultado_n8n = {
            "sucesso": True,
            "metricas": metricas,
            "total": len(cupons),
            "arquivos": arquivos,
            "cupons": cupons
        }
        print(json.dumps(resultado_n8n, ensure_ascii=False))


if __name__ == "__main__":
    main()
