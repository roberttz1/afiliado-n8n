'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { PlatformBadge, StatusBadge, TimeAgo, FormatCurrency } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { DEMO_OFERTAS } from '@/lib/demo-data';

export default function OfertasPage() {
  const [ofertas, setOfertas] = useState([]);
  const [isDemo, setIsDemo] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todas');
  const [filtroPlataforma, setFiltroPlataforma] = useState('todas');

  useEffect(() => {
    async function loadData() {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('ofertas')
            .select('*')
            .order('criado_em', { ascending: false })
            .limit(100);
          
          if (!error && data && data.length > 0) {
            setOfertas(data);
            setIsDemo(false);
            return;
          }
        } catch {}
      }
      setOfertas(DEMO_OFERTAS);
      setIsDemo(true);
    }
    loadData();
  }, []);

  const filtradas = ofertas.filter(o => {
    if (filtroStatus !== 'todas' && o.status !== filtroStatus) return false;
    if (filtroPlataforma !== 'todas' && o.plataforma !== filtroPlataforma) return false;
    return true;
  });

  const stats = {
    total: ofertas.length,
    pendentes: ofertas.filter(o => o.status === 'pendente').length,
    aprovadas: ofertas.filter(o => o.status === 'aprovada').length,
    enviadas: ofertas.filter(o => o.status === 'enviada').length,
    descartadas: ofertas.filter(o => o.status === 'descartada').length,
  };

  return (
    <div className="app-layout">
      <Sidebar isDemo={isDemo} />
      
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">Ofertas</h1>
          <p className="page-subtitle">Histórico de ofertas coletadas e enviadas</p>
        </div>

        {isDemo && (
          <div className="demo-banner">
            <span className="demo-banner-icon">⚠️</span>
            <div><strong>Modo Demo</strong> — Dados fictícios para preview.</div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          {[
            { label: 'Total', value: stats.total, color: 'var(--text-primary)' },
            { label: 'Pendentes', value: stats.pendentes, color: 'var(--accent-amber)' },
            { label: 'Aprovadas', value: stats.aprovadas, color: 'var(--accent-blue)' },
            { label: 'Enviadas', value: stats.enviadas, color: 'var(--accent-green)' },
            { label: 'Descartadas', value: stats.descartadas, color: 'var(--accent-red)' },
          ].map(s => (
            <div className="card" key={s.label}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginTop: 'var(--space-1)', color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <select
            className="btn btn-ghost"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            <option value="todas">Todos Status</option>
            <option value="pendente">Pendente</option>
            <option value="aprovada">Aprovada</option>
            <option value="enviada">Enviada</option>
            <option value="descartada">Descartada</option>
            <option value="erro_ia">Erro IA</option>
          </select>
          
          <select
            className="btn btn-ghost"
            value={filtroPlataforma}
            onChange={(e) => setFiltroPlataforma(e.target.value)}
            style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            <option value="todas">Todas Plataformas</option>
            <option value="amazon">Amazon</option>
            <option value="mercado_livre">Mercado Livre</option>
            <option value="shopee">Shopee</option>
            <option value="shein">Shein</option>
            <option value="netshoes">Netshoes</option>
            <option value="centauro">Centauro</option>
          </select>
        </div>

        {/* Tabela */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plataforma</th>
                <th>Produto</th>
                <th>Título IA</th>
                <th>De → Por</th>
                <th>Desconto</th>
                <th>Cupom</th>
                <th>Fonte</th>
                <th>Status</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((o) => (
                <tr key={o.id}>
                  <td><PlatformBadge platform={o.plataforma} /></td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {o.titulo_original}
                  </td>
                  <td style={{
                    maxWidth: '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight: 600,
                    color: o.titulo_gerado ? 'var(--accent-amber-light)' : 'var(--text-tertiary)',
                  }}>
                    {o.titulo_gerado || '⏳ Aguardando IA'}
                  </td>
                  <td>
                    <span style={{ color: 'var(--text-tertiary)', textDecoration: 'line-through', fontSize: 'var(--font-size-xs)' }}>
                      <FormatCurrency value={o.preco_de} />
                    </span>
                    <br />
                    <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
                      <FormatCurrency value={o.preco_por} />
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-green" style={{ fontSize: '11px', fontWeight: 800 }}>
                      -{o.desconto_pct}%
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
                    {o.cupom || '—'}
                  </td>
                  <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                    {o.fonte === 'api_afiliado' ? '🔌 API' : o.fonte === 'scraper' ? '🕷️ Scraper' : '✍️ Manual'}
                  </td>
                  <td><StatusBadge status={o.status} /></td>
                  <td><TimeAgo date={o.criado_em} /></td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-8)' }}>
                    Nenhuma oferta encontrada com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
