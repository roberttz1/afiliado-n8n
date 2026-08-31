'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import KpiCard from '@/components/KpiCard';
import { PlatformBadge, StatusBadge, FormatCurrency } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { DEMO_COMISSOES } from '@/lib/demo-data';

export default function ComissoesPage() {
  const [comissoes, setComissoes] = useState([]);
  const [isDemo, setIsDemo] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('comissoes')
            .select('*')
            .order('registrado_em', { ascending: false })
            .limit(100);
          
          if (!error && data && data.length > 0) {
            setComissoes(data);
            setIsDemo(false);
            return;
          }
        } catch {}
      }
      setComissoes(DEMO_COMISSOES);
      setIsDemo(true);
    }
    loadData();
  }, []);

  const totalComissoes = comissoes.reduce((sum, c) => sum + (c.valor_comissao || 0), 0);
  const totalVendas = comissoes.reduce((sum, c) => sum + (c.valor_venda || 0), 0);
  const comissoesAprovadas = comissoes.filter(c => c.status === 'aprovada' || c.status === 'paga').reduce((sum, c) => sum + (c.valor_comissao || 0), 0);
  const comissoesPendentes = comissoes.filter(c => c.status === 'pendente').reduce((sum, c) => sum + (c.valor_comissao || 0), 0);

  // Group by platform
  const porPlataforma = comissoes.reduce((acc, c) => {
    if (!acc[c.plataforma]) acc[c.plataforma] = { total: 0, comissao: 0, count: 0 };
    acc[c.plataforma].total += c.valor_venda || 0;
    acc[c.plataforma].comissao += c.valor_comissao || 0;
    acc[c.plataforma].count += 1;
    return acc;
  }, {});

  return (
    <div className="app-layout">
      <Sidebar isDemo={isDemo} />
      
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">Comissões</h1>
          <p className="page-subtitle">Acompanhe suas comissões por plataforma</p>
        </div>

        {isDemo && (
          <div className="demo-banner">
            <span className="demo-banner-icon">⚠️</span>
            <div><strong>Modo Demo</strong> — Dados fictícios. No sistema real, comissões são importadas manualmente via CSV ou API da rede de afiliados.</div>
          </div>
        )}

        {/* KPIs */}
        <div className="kpi-grid">
          <KpiCard
            title="Total em Vendas"
            value={`R$ ${totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon="🛒"
            accent="blue"
          />
          <KpiCard
            title="Total Comissões"
            value={`R$ ${totalComissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon="💰"
            accent="green"
          />
          <KpiCard
            title="Aprovadas"
            value={`R$ ${comissoesAprovadas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon="✅"
            accent="green"
          />
          <KpiCard
            title="Pendentes"
            value={`R$ ${comissoesPendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon="⏳"
            accent="amber"
          />
        </div>

        {/* Por Plataforma */}
        <div className="section">
          <h2 className="section-title" style={{ marginBottom: 'var(--space-4)' }}>Por Plataforma</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
            {Object.entries(porPlataforma).map(([plataforma, data]) => (
              <div className="card" key={plataforma}>
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <PlatformBadge platform={plataforma} />
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                  {data.count} vendas
                </div>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--accent-green)', marginTop: 'var(--space-1)' }}>
                  R$ {data.comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                  de R$ {data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em vendas
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabela de comissões */}
        <div className="section">
          <h2 className="section-title" style={{ marginBottom: 'var(--space-4)' }}>Histórico</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Plataforma</th>
                  <th>Valor Venda</th>
                  <th>Comissão</th>
                  <th>Status</th>
                  <th>Referência</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {comissoes.map((c) => (
                  <tr key={c.id}>
                    <td><PlatformBadge platform={c.plataforma} /></td>
                    <td><FormatCurrency value={c.valor_venda} /></td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
                      <FormatCurrency value={c.valor_comissao} />
                    </td>
                    <td><StatusBadge status={c.status} /></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                      {c.referencia_externa || '—'}
                    </td>
                    <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                      {new Date(c.registrado_em).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
