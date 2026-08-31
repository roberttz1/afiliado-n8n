"""
Scraper de Ofertas — Módulo Fallback
====================================

ATENÇÃO: Este módulo é um FALLBACK. A fonte primária de ofertas deve ser
as APIs oficiais de afiliados (Shopee, Lomadee, Awin, etc.).

O scraper só deve ser usado para:
- Verificar se um produto específico está em promoção
- Monitorar preço de produtos que a API não cobre
- Capturar cupons que não aparecem nas APIs

NUNCA para coleta em massa. Sempre com rate-limit conservador.

Uso:
    python -m scraper.monitor --platform netshoes --category tenis
"""

import asyncio
import hashlib
import json
import os
import random
import time
from dataclasses import dataclass, asdict
from typing import Optional
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv

load_dotenv()


# ============================================================
# Configuração
# ============================================================

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
]

# Rate limit: máximo 1 request por 30 segundos por domínio
RATE_LIMIT_SECONDS = 30

# Supabase config
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")


# ============================================================
# Model
# ============================================================

@dataclass
class Oferta:
    """Representa uma oferta normalizada de qualquer plataforma."""
    plataforma: str
    categoria: str
    titulo_original: str
    preco_de: float
    preco_por: float
    cupom: Optional[str] = None
    link_original: str = ""
    link_afiliado: str = ""
    imagem_url: Optional[str] = None
    fonte: str = "scraper"
    
    @property
    def desconto_pct(self) -> float:
        if self.preco_de > 0:
            return round((1 - self.preco_por / self.preco_de) * 100, 1)
        return 0.0
    
    @property
    def hash_produto(self) -> str:
        """Hash para detecção de duplicatas."""
        key = f"{self.plataforma}:{self.titulo_original}:{self.preco_por}"
        return hashlib.md5(key.encode()).hexdigest()
    
    def to_dict(self) -> dict:
        d = asdict(self)
        d["desconto_pct"] = self.desconto_pct
        d["hash_produto"] = self.hash_produto
        d["status"] = "pendente"
        return d


# ============================================================
# Rate Limiter
# ============================================================

class RateLimiter:
    """Rate limiter por domínio."""
    
    def __init__(self, min_interval: float = RATE_LIMIT_SECONDS):
        self._last_request: dict[str, float] = {}
        self._min_interval = min_interval
    
    async def wait(self, domain: str):
        """Aguarda o tempo necessário antes de fazer request."""
        now = time.time()
        last = self._last_request.get(domain, 0)
        wait_time = self._min_interval - (now - last)
        
        if wait_time > 0:
            # Adicionar jitter para parecer mais humano
            jitter = random.uniform(0, 5)
            total_wait = wait_time + jitter
            print(f"  ⏱️  Rate limit: aguardando {total_wait:.1f}s para {domain}")
            await asyncio.sleep(total_wait)
        
        self._last_request[domain] = time.time()


# ============================================================
# Base Scraper
# ============================================================

class BaseScraper:
    """Classe base para scrapers de plataforma."""
    
    PLATFORM = "generic"
    BASE_URL = ""
    
    def __init__(self, rate_limiter: Optional[RateLimiter] = None):
        self.rate_limiter = rate_limiter or RateLimiter()
        self.client = httpx.AsyncClient(
            timeout=30,
            follow_redirects=True,
            headers={
                "User-Agent": random.choice(USER_AGENTS),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "DNT": "1",
            },
        )
    
    @property
    def domain(self) -> str:
        return urlparse(self.BASE_URL).netloc
    
    async def fetch(self, url: str) -> Optional[str]:
        """Faz request respeitando rate limit."""
        domain = urlparse(url).netloc
        await self.rate_limiter.wait(domain)
        
        try:
            # Rotar user-agent a cada request
            self.client.headers["User-Agent"] = random.choice(USER_AGENTS)
            response = await self.client.get(url)
            response.raise_for_status()
            return response.text
        except httpx.HTTPStatusError as e:
            print(f"  ❌ HTTP {e.response.status_code} para {url}")
            return None
        except httpx.RequestError as e:
            print(f"  ❌ Erro de request para {url}: {e}")
            return None
    
    async def buscar_ofertas(self, categoria: str = "tenis", max_items: int = 10) -> list[Oferta]:
        """Método a ser implementado por cada plataforma."""
        raise NotImplementedError
    
    async def close(self):
        await self.client.aclose()


# ============================================================
# Scraper: Netshoes (exemplo)
# ============================================================

class NetshoesScaper(BaseScraper):
    """
    Scraper para Netshoes — busca tênis em promoção.
    
    NOTA: Este scraper é um FALLBACK. Se você tem conta na Lomadee com
    campanha Netshoes aprovada, use a API da Lomadee ao invés deste scraper.
    """
    
    PLATFORM = "netshoes"
    BASE_URL = "https://www.netshoes.com.br"
    
    async def buscar_ofertas(self, categoria: str = "tenis", max_items: int = 10) -> list[Oferta]:
        """
        Busca ofertas de tênis na Netshoes.
        
        IMPORTANTE: Este método faz NO MÁXIMO 1 request por execução.
        Para coleta em massa, use a API Lomadee.
        """
        print(f"🕷️ Netshoes: buscando ofertas de '{categoria}'...")
        
        # Uma única página de busca
        url = f"{self.BASE_URL}/busca/{categoria}?sort=discount&page=1"
        html = await self.fetch(url)
        
        if not html:
            print("  ❌ Falha ao buscar página")
            return []
        
        ofertas = []
        
        try:
            from selectolax.parser import HTMLParser
            tree = HTMLParser(html)
            
            # Buscar cards de produto
            # NOTA: Seletores CSS podem mudar a qualquer momento.
            # Se este scraper parar de funcionar, atualize os seletores.
            cards = tree.css("div.product-card, div[data-testid='product-card']")
            
            for card in cards[:max_items]:
                try:
                    titulo_el = card.css_first("h2, span.product-card__title, a.product-card__title")
                    preco_de_el = card.css_first("span.product-card__price--from, del")
                    preco_por_el = card.css_first("span.product-card__price--to, .product-card__price")
                    link_el = card.css_first("a[href]")
                    img_el = card.css_first("img[src]")
                    
                    if not titulo_el or not preco_por_el:
                        continue
                    
                    titulo = titulo_el.text(strip=True)
                    
                    # Parse de preço (formato: "R$ 199,99")
                    preco_de = self._parse_preco(preco_de_el.text(strip=True) if preco_de_el else "0")
                    preco_por = self._parse_preco(preco_por_el.text(strip=True))
                    
                    if preco_por <= 0:
                        continue
                    
                    link = ""
                    if link_el and link_el.attributes.get("href"):
                        href = link_el.attributes["href"]
                        link = href if href.startswith("http") else f"{self.BASE_URL}{href}"
                    
                    imagem = None
                    if img_el and img_el.attributes.get("src"):
                        imagem = img_el.attributes["src"]
                    
                    oferta = Oferta(
                        plataforma=self.PLATFORM,
                        categoria=categoria,
                        titulo_original=titulo,
                        preco_de=preco_de if preco_de > 0 else preco_por,
                        preco_por=preco_por,
                        link_original=link,
                        link_afiliado=link,  # Será substituído pelo link de afiliado real
                        imagem_url=imagem,
                    )
                    
                    if oferta.desconto_pct >= 20:  # Só pegar se tiver desconto significativo
                        ofertas.append(oferta)
                        print(f"  ✅ {titulo[:50]}... ({oferta.desconto_pct}% off)")
                
                except Exception as e:
                    print(f"  ⚠️ Erro ao parsear card: {e}")
                    continue
        
        except ImportError:
            print("  ❌ selectolax não instalado. Execute: pip install selectolax")
        except Exception as e:
            print(f"  ❌ Erro ao parsear HTML: {e}")
        
        print(f"  📦 {len(ofertas)} ofertas encontradas")
        return ofertas
    
    @staticmethod
    def _parse_preco(text: str) -> float:
        """Converte 'R$ 199,99' para 199.99"""
        try:
            cleaned = text.replace("R$", "").replace(".", "").replace(",", ".").strip()
            return float(cleaned)
        except (ValueError, AttributeError):
            return 0.0


# ============================================================
# Salvar no Supabase
# ============================================================

async def salvar_ofertas_supabase(ofertas: list[Oferta]) -> int:
    """Salva ofertas no Supabase via REST API."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("⚠️ Supabase não configurado. Ofertas não foram salvas.")
        return 0
    
    async with httpx.AsyncClient() as client:
        saved = 0
        for oferta in ofertas:
            data = oferta.to_dict()
            # Remover campo calculado (o Supabase calcula via GENERATED ALWAYS)
            data.pop("desconto_pct", None)
            
            try:
                response = await client.post(
                    f"{SUPABASE_URL}/rest/v1/ofertas",
                    json=data,
                    headers={
                        "apikey": SUPABASE_SERVICE_KEY,
                        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                        "Content-Type": "application/json",
                        "Prefer": "return=minimal",
                    },
                )
                
                if response.status_code in (200, 201):
                    saved += 1
                else:
                    print(f"  ⚠️ Erro ao salvar: {response.status_code} - {response.text[:100]}")
            
            except Exception as e:
                print(f"  ❌ Erro ao salvar oferta: {e}")
        
        print(f"💾 {saved}/{len(ofertas)} ofertas salvas no Supabase")
        return saved


# ============================================================
# CLI
# ============================================================

async def main():
    """Executa o scraper fallback."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Scraper de Ofertas (Fallback)")
    parser.add_argument("--platform", choices=["netshoes"], default="netshoes",
                        help="Plataforma para scraping")
    parser.add_argument("--category", default="tenis", help="Categoria de produto")
    parser.add_argument("--max", type=int, default=10, help="Máximo de itens")
    parser.add_argument("--save", action="store_true", help="Salvar no Supabase")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🕷️  SCRAPER DE OFERTAS — MODO FALLBACK")
    print("=" * 60)
    print(f"Plataforma: {args.platform}")
    print(f"Categoria:  {args.category}")
    print(f"Máx items:  {args.max}")
    print()
    
    rate_limiter = RateLimiter()
    
    scrapers = {
        "netshoes": NetshoesScaper,
    }
    
    scraper_class = scrapers.get(args.platform)
    if not scraper_class:
        print(f"❌ Plataforma '{args.platform}' não tem scraper implementado.")
        return
    
    scraper = scraper_class(rate_limiter)
    
    try:
        ofertas = await scraper.buscar_ofertas(args.category, args.max)
        
        if ofertas:
            print()
            print("📋 Ofertas encontradas:")
            print("-" * 60)
            for i, o in enumerate(ofertas, 1):
                print(f"{i}. [{o.plataforma}] {o.titulo_original[:50]}")
                print(f"   R$ {o.preco_de:.2f} → R$ {o.preco_por:.2f} ({o.desconto_pct}% off)")
                if o.cupom:
                    print(f"   Cupom: {o.cupom}")
                print()
            
            if args.save:
                await salvar_ofertas_supabase(ofertas)
        else:
            print("Nenhuma oferta encontrada.")
    
    finally:
        await scraper.close()


if __name__ == "__main__":
    asyncio.run(main())
