'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import KpiCard from '@/components/KpiCard';
import { supabase } from '@/lib/supabase';

const DEMO_CLIQUES = [
  { nicho: 'tenis', utm_source: 'instagram', utm_campaign: 'bio_link', count: 87 },
  { nicho: 'tenis', utm_source: 'tiktok', utm_campaign: 'video_oferta', count: 56 },
  { nicho: 'tenis', utm_source: 'meta', utm_campaign: 'ads_tenis_v1', count: 134 },
  { nicho: 'tenis', utm_source: 'direct', utm_campaign: null, count: 42 },
  { nicho: 'tenis', utm_source: 'whatsapp', utm_campaign: 'grupo_cheio', count: 23 },
];

export default function CliquesPage() {
  const [cliques, setCliques] = useState([]);
  const [isDemo, setIsDemo] = useState(true);
  const [totalHoje, setTotalHoje] = useState(0);
  const [totalSemana, setTotalSemana] = useState(0);

  useEffect(() => {
    async function loadData() {
      if (supabase) {
        try {
          // Agrupar por utm_source e utm_campaign
          const { data, error } = await supabase
            .from('cliques')
            .select('nicho, utm_source, utm_campaign, criado_em')
            .order('criado_em', { ascending: false })
            .limit(500);
          
          if (!error && data && data.length > 0) {
            const grouped = {};
            let hoje = 0;
            let semana = 0;
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekStart = new Date(todayStart);
            weekStart.setDate(weekStart.getDate() - 7);

            data.forEach(c => {
              const key = `${c.utm_source || 'direct'}|${c.utm_campaign || 'sem_campanha'}`;
              if (!grouped[key]) {
                grouped[key] = { nicho: c.nicho, utm_source: c.utm_source || 'direct', utm_campaign: c.utm_campaign, count: 0 };
              }
              grouped[key].count++;
              
              const d = new Date(c.criado_em);
              if (d >= todayStart) hoje++;
              if (d >= weekStart) semana++;
            });

            setCliques(Object.values(grouped).sort((a, b) => b.count - a.count));
            setTotalHoje(hoje);
            setTotalSemana(semana);
            setIsDemo(false);
            return;
          }
        } catch {}
      }
      setCliques(DEMO_CLIQUES);
      setTotalHoje(234);
      setTotalSemana(1420);
      setIsDemo(true);
    }
    loadData();
  }, []);

  const totalCliques = cliques.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="app-layout">
      <Sidebar isDemo={isDemo} />
      
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">Cliques & UTMs</h1>
          <p className="page-subtitle">Analytics do link de redirect estável</p>
        </div>

        {isDemo && (
          <div className="demo-banner">
            <span className="demo-banner-icon">⚠️</span>
            <div><strong>Modo Demo</strong> — Dados fictícios para preview.</div>
          </div>
        )}

        {/* KPIs */}
        <div className="kpi-grid">
          <KpiCard title="Cliques Hoje" value={totalHoje} icon="📈" accent="green" />
          <KpiCard title="Cliques Semana" value={totalSemana} icon="📊" accent="blue" />
          <KpiCard title="Total Rastreado" value={totalCliques} icon="🔗" accent="purple" />
          <KpiCard title="Fontes Únicas" value={new Set(cliques.map(c => c.utm_source)).size} icon="🌐" accent="cyan" />
        </div>

        {/* Link info */}
        <div className="card" style={{ marginBottom: 'var(--space-6)', borderColor: 'var(--accent-primary-glow)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            🔗 Seu Link de Redirect
          </h3>
          <div style={{
            background: 'var(--bg-tertiary)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'monospace',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--accent-primary-light)',
            marginBottom: 'var(--space-3)',
          }}>
            {typeof window !== 'undefined' ? window.location.origin : 'https://seudominio.com'}/api/entrar?nicho=tenis
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
            Adicione UTMs para rastrear: <code>?nicho=tenis&utm_source=instagram&utm_campaign=bio</code>
          </p>
        </div>

        {/* Tabela por fonte */}
        <div className="section">
          <h2 className="section-title" style={{ marginBottom: 'var(--space-4)' }}>Cliques por Fonte</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fonte (utm_source)</th>
                  <th>Campanha (utm_campaign)</th>
                  <th>Nicho</th>
                  <th>Cliques</th>
                  <th>% do Total</th>
                  <th>Barra</th>
                </tr>
              </thead>
              <tbody>
                {cliques.map((c, i) => {
                  const pct = totalCliques > 0 ? ((c.count / totalCliques) * 100).toFixed(1) : 0;
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>
                        {c.utm_source === 'instagram' && '📸 '}
                        {c.utm_source === 'tiktok' && '🎵 '}
                        {c.utm_source === 'meta' && '📢 '}
                        {c.utm_source === 'whatsapp' && '💬 '}
                        {c.utm_source === 'direct' && '🔗 '}
                        {c.utm_source}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                        {c.utm_campaign || '—'}
                      </td>
                      <td>
                        <span className="badge badge-purple">👟 {c.nicho}</span>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>
                        {c.count}
                      </td>
                      <td>{pct}%</td>
                      <td style={{ minWidth: '150px' }}>
                        <div style={{
                          width: '100%',
                          height: '8px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '4px',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-purple))',
                            borderRadius: '4px',
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
