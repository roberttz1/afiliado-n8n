'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { StatusBadge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { DEMO_ENVIOS_FILA } from '@/lib/demo-data';

export default function FilaPage() {
  const [envios, setEnvios] = useState([]);
  const [isDemo, setIsDemo] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('envios')
            .select(`
              *,
              ofertas (titulo_original, titulo_gerado, plataforma),
              grupos (nome_grupo)
            `)
            .in('status', ['agendado', 'enviando'])
            .order('agendado_para', { ascending: true })
            .limit(50);
          
          if (!error && data && data.length > 0) {
            setEnvios(data.map(e => ({
              ...e,
              oferta_titulo: e.ofertas?.titulo_gerado || e.ofertas?.titulo_original || 'Sem título',
              grupo_nome: e.grupos?.nome_grupo || 'Grupo desconhecido',
            })));
            setIsDemo(false);
            return;
          }
        } catch {}
      }
      setEnvios(DEMO_ENVIOS_FILA);
      setIsDemo(true);
    }
    loadData();
  }, []);

  function formatTime(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((d - now) / 1000);
    
    if (diff < 0) return 'Agora';
    if (diff < 60) return `em ${diff}s`;
    if (diff < 3600) return `em ${Math.floor(diff / 60)}min`;
    return `em ${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}min`;
  }

  return (
    <div className="app-layout">
      <Sidebar isDemo={isDemo} />
      
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">Fila de Envio</h1>
          <p className="page-subtitle">Ofertas agendadas para envio via WhatsApp</p>
        </div>

        {isDemo && (
          <div className="demo-banner">
            <span className="demo-banner-icon">⚠️</span>
            <div><strong>Modo Demo</strong> — Dados fictícios para preview.</div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div className="card">
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Na Fila
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginTop: 'var(--space-1)', color: 'var(--accent-blue)' }}>
              {envios.filter(e => e.status === 'agendado').length}
            </div>
          </div>
          <div className="card">
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Enviando Agora
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginTop: 'var(--space-1)', color: 'var(--accent-amber)' }}>
              {envios.filter(e => e.status === 'enviando').length}
            </div>
          </div>
          <div className="card">
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Próximo Envio
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginTop: 'var(--space-1)', color: 'var(--accent-primary-light)' }}>
              {envios.length > 0 ? formatTime(envios[0].agendado_para) : '—'}
            </div>
          </div>
        </div>

        {/* Fila */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Oferta</th>
                <th>Grupo</th>
                <th>Agendado Para</th>
                <th>Tempo Restante</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {envios.map((e, index) => (
                <tr key={e.id}>
                  <td style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>
                    {index + 1}
                  </td>
                  <td style={{ fontWeight: 600, maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.oferta_titulo}
                  </td>
                  <td>{e.grupo_nome}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
                    {new Date(e.agendado_para).toLocaleString('pt-BR')}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--accent-primary-light)' }}>
                    {formatTime(e.agendado_para)}
                  </td>
                  <td><StatusBadge status={e.status} /></td>
                </tr>
              ))}
              {envios.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-8)' }}>
                    Nenhum envio na fila. As ofertas aprovadas serão agendadas automaticamente.
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
