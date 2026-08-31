'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { StatusBadge, ProgressBar } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { DEMO_GRUPOS } from '@/lib/demo-data';

export default function SaudePage() {
  const [grupos, setGrupos] = useState([]);
  const [isDemo, setIsDemo] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (supabase) {
        try {
          const { data, error } = await supabase.from('vw_saude_grupos').select('*');
          if (!error && data && data.length > 0) {
            setGrupos(data);
            setIsDemo(false);
            return;
          }
        } catch {}
      }
      setGrupos(DEMO_GRUPOS.map(g => ({ ...g, taxa_saida_24h: Math.random() * 8 })));
      setIsDemo(true);
    }
    loadData();
  }, []);

  function getRiskLevel(taxa) {
    if (taxa >= 10) return { label: '🔴 Alto', color: 'var(--accent-red)' };
    if (taxa >= 5) return { label: '🟡 Médio', color: 'var(--accent-amber)' };
    return { label: '🟢 Baixo', color: 'var(--accent-green)' };
  }

  return (
    <div className="app-layout">
      <Sidebar isDemo={isDemo} />
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">Saúde do Sistema</h1>
          <p className="page-subtitle">Monitoramento de risco de banimento e saúde dos grupos</p>
        </div>

        {isDemo && (
          <div className="demo-banner">
            <span className="demo-banner-icon">⚠️</span>
            <div><strong>Modo Demo</strong> — Dados fictícios para preview.</div>
          </div>
        )}

        {/* Alertas */}
        <div className="card" style={{
          marginBottom: 'var(--space-6)',
          borderColor: 'var(--accent-green-border)',
          background: 'var(--accent-green-bg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ fontSize: '1.5rem' }}>🛡️</span>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--accent-green)' }}>Sistema Saudável</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                Nenhum alerta de risco detectado nas últimas 24h.
              </div>
            </div>
          </div>
        </div>

        {/* Dicas de segurança */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            📋 Checklist de Segurança
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            {[
              { icon: '✅', text: 'Chips aquecidos por 10+ dias', status: 'ok' },
              { icon: '✅', text: 'Verificação 2FA ativada', status: 'ok' },
              { icon: '✅', text: 'Throttle configurado (5-10 min)', status: 'ok' },
              { icon: '✅', text: 'Horário de envio 8-22h', status: 'ok' },
              { icon: '⚠️', text: 'Canal WhatsApp como backup', status: 'warn' },
              { icon: '✅', text: 'Domínio próprio para links', status: 'ok' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--font-size-sm)',
                color: item.status === 'ok' ? 'var(--text-secondary)' : 'var(--accent-amber)',
              }}>
                <span>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabela de saúde dos grupos */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Grupo</th>
                <th>Membros</th>
                <th>Capacidade</th>
                <th>Taxa Saída 24h</th>
                <th>Risco</th>
                <th>Ofertas Hoje</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => {
                const taxa = g.taxa_saida_24h || 0;
                const risk = getRiskLevel(taxa);
                return (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 600 }}>{g.nome_grupo}</td>
                    <td>{g.qtd_membros}</td>
                    <td style={{ minWidth: '120px' }}>
                      <ProgressBar value={g.qtd_membros} max={g.capacidade_maxima || 950} color="auto" />
                    </td>
                    <td style={{ fontWeight: 700, color: risk.color }}>
                      {taxa.toFixed(1)}%
                    </td>
                    <td>{risk.label}</td>
                    <td>{g.ofertas_hoje || 0}</td>
                    <td><StatusBadge status={g.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
