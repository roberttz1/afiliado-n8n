'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import KpiCard from '@/components/KpiCard';
import { PlatformBadge, StatusBadge, TimeAgo, FormatCurrency, ProgressBar } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { DEMO_KPIS, DEMO_GRUPOS, DEMO_OFERTAS, DEMO_COMISSOES, DEMO_ENVIOS_FILA } from '@/lib/demo-data';

export default function DashboardPage() {
  const [kpis, setKpis] = useState(null);
  const [grupos, setGrupos] = useState([]);
  const [ofertas, setOfertas] = useState([]);
  const [comissoes, setComissoes] = useState([]);
  const [isDemo, setIsDemo] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (supabase) {
        try {
          // Try to load real data
          const { data: kpiData } = await supabase.from('vw_kpis').select('*').single();
          const { data: gruposData } = await supabase.from('grupos').select('*').order('numero_sequencial', { ascending: true });
          const { data: ofertasData } = await supabase.from('ofertas').select('*').order('criado_em', { ascending: false }).limit(10);
          const { data: comissoesData } = await supabase.from('comissoes').select('*').order('registrado_em', { ascending: false }).limit(5);
          
          if (kpiData) {
            setKpis(kpiData);
            setGrupos(gruposData || []);
            setOfertas(ofertasData || []);
            setComissoes(comissoesData || []);
            setIsDemo(false);
          } else {
            loadDemoData();
          }
        } catch {
          loadDemoData();
        }
      } else {
        loadDemoData();
      }
      setLoading(false);
    }

    function loadDemoData() {
      setKpis(DEMO_KPIS);
      setGrupos(DEMO_GRUPOS);
      setOfertas(DEMO_OFERTAS);
      setComissoes(DEMO_COMISSOES);
      setIsDemo(true);
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="app-layout">
        <Sidebar isDemo={true} />
        <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-4)' }}>⏳</div>
            <div>Carregando dashboard...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar isDemo={isDemo} />
      
      <main className="main-content">
        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral do sistema de ofertas — Nicho: Tênis</p>
        </div>

        {/* Demo Banner */}
        {isDemo && (
          <div className="demo-banner">
            <span className="demo-banner-icon">⚠️</span>
            <div>
              <strong>Modo Demo</strong> — Supabase não está conectado. Os dados abaixo são fictícios para preview. 
              Configure o <code>.env</code> com suas credenciais para ver dados reais.
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="kpi-grid">
          <KpiCard
            title="Grupos Ativos"
            value={kpis?.grupos_ativos || 0}
            icon="💬"
            accent="primary"
            subtitle="Nicho: Tênis"
          />
          <KpiCard
            title="Total Membros"
            value={(kpis?.total_membros || 0).toLocaleString('pt-BR')}
            icon="👥"
            accent="green"
          />
          <KpiCard
            title="Ofertas Hoje"
            value={kpis?.ofertas_hoje || 0}
            icon="🏷️"
            accent="blue"
          />
          <KpiCard
            title="Enviadas Hoje"
            value={kpis?.enviadas_hoje || 0}
            icon="📤"
            accent="cyan"
          />
          <KpiCard
            title="Comissões (Mês)"
            value={`R$ ${(kpis?.comissoes_mes || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon="💰"
            accent="green"
          />
          <KpiCard
            title="Vendas (Mês)"
            value={kpis?.vendas_mes || 0}
            icon="🛒"
            accent="purple"
          />
          <KpiCard
            title="Cliques Hoje"
            value={kpis?.cliques_hoje || 0}
            icon="🔗"
            accent="amber"
          />
        </div>

        {/* Grid: Grupos + Últimas Ofertas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
          
          {/* Grupos Ativos */}
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">Grupos Ativos</h2>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Grupo</th>
                    <th>Membros</th>
                    <th>Capacidade</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g) => (
                    <tr key={g.id}>
                      <td style={{ fontWeight: 600 }}>{g.nome_grupo}</td>
                      <td>{g.qtd_membros}</td>
                      <td>
                        <ProgressBar value={g.qtd_membros} max={g.capacidade_maxima} color="auto" />
                      </td>
                      <td><StatusBadge status={g.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Últimas Comissões */}
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">Últimas Comissões</h2>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Plataforma</th>
                    <th>Venda</th>
                    <th>Comissão</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {comissoes.map((c) => (
                    <tr key={c.id}>
                      <td><PlatformBadge platform={c.plataforma} /></td>
                      <td><FormatCurrency value={c.valor_venda} /></td>
                      <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                        <FormatCurrency value={c.valor_comissao} />
                      </td>
                      <td><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Últimas Ofertas */}
        <div className="section">
          <div className="section-header">
            <h2 className="section-title">Últimas Ofertas</h2>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Plataforma</th>
                  <th>Produto</th>
                  <th>Título IA</th>
                  <th>De</th>
                  <th>Por</th>
                  <th>Desc.</th>
                  <th>Status</th>
                  <th>Quando</th>
                </tr>
              </thead>
              <tbody>
                {ofertas.map((o) => (
                  <tr key={o.id}>
                    <td><PlatformBadge platform={o.plataforma} /></td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.titulo_original}
                    </td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, color: 'var(--accent-amber-light)' }}>
                      {o.titulo_gerado || '—'}
                    </td>
                    <td style={{ color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>
                      <FormatCurrency value={o.preco_de} />
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
                      <FormatCurrency value={o.preco_por} />
                    </td>
                    <td>
                      <span className="badge badge-green">-{o.desconto_pct}%</span>
                    </td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><TimeAgo date={o.criado_em} /></td>
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
