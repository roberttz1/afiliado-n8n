'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { StatusBadge, ProgressBar, TimeAgo } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { DEMO_GRUPOS } from '@/lib/demo-data';

export default function GruposPage() {
  const [grupos, setGrupos] = useState([]);
  const [isDemo, setIsDemo] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('grupos')
            .select('*')
            .order('nicho')
            .order('numero_sequencial', { ascending: true });
          
          if (!error && data && data.length > 0) {
            setGrupos(data);
            setIsDemo(false);
            return;
          }
        } catch {}
      }
      setGrupos(DEMO_GRUPOS);
      setIsDemo(true);
    }
    loadData();
  }, []);

  return (
    <div className="app-layout">
      <Sidebar isDemo={isDemo} />
      
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">Grupos</h1>
          <p className="page-subtitle">Gerenciar grupos de WhatsApp por nicho</p>
        </div>

        {isDemo && (
          <div className="demo-banner">
            <span className="demo-banner-icon">⚠️</span>
            <div><strong>Modo Demo</strong> — Dados fictícios para preview.</div>
          </div>
        )}

        {/* Stats resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div className="card">
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total Grupos
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginTop: 'var(--space-1)' }}>
              {grupos.length}
            </div>
          </div>
          <div className="card">
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Ativos
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginTop: 'var(--space-1)', color: 'var(--accent-green)' }}>
              {grupos.filter(g => g.status === 'ativo').length}
            </div>
          </div>
          <div className="card">
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total Membros
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginTop: 'var(--space-1)' }}>
              {grupos.reduce((sum, g) => sum + (g.qtd_membros || 0), 0).toLocaleString('pt-BR')}
            </div>
          </div>
          <div className="card">
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Capacidade Média
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginTop: 'var(--space-1)' }}>
              {grupos.length > 0
                ? Math.round(grupos.reduce((sum, g) => sum + (g.qtd_membros / g.capacidade_maxima * 100), 0) / grupos.length)
                : 0}%
            </div>
          </div>
        </div>

        {/* Tabela de grupos */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nome do Grupo</th>
                <th>Nicho</th>
                <th>Membros</th>
                <th>Capacidade</th>
                <th>Ofertas Hoje</th>
                <th>Total Ofertas</th>
                <th>Último Envio</th>
                <th>Status</th>
                <th>Criado</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.id}>
                  <td style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>
                    {g.numero_sequencial}
                  </td>
                  <td style={{ fontWeight: 600 }}>{g.nome_grupo}</td>
                  <td>
                    <span className="badge badge-purple">
                      {g.nicho === 'tenis' ? '👟 Tênis' : g.nicho}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    {g.qtd_membros}
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>
                      /{g.capacidade_maxima}
                    </span>
                  </td>
                  <td style={{ minWidth: '120px' }}>
                    <ProgressBar value={g.qtd_membros} max={g.capacidade_maxima} color="auto" />
                  </td>
                  <td>{g.ofertas_hoje || 0}</td>
                  <td>{(g.total_ofertas_enviadas || 0).toLocaleString('pt-BR')}</td>
                  <td><TimeAgo date={g.ultimo_envio_em} /></td>
                  <td><StatusBadge status={g.status} /></td>
                  <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                    {new Date(g.criado_em).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Link de redirect */}
        <div className="card" style={{ marginTop: 'var(--space-6)', borderColor: 'var(--accent-primary-glow)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
            🔗 Link Estável de Entrada
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)' }}>
            Use este link em todas as divulgações (Instagram, TikTok, anúncios). Ele sempre redireciona para o grupo ativo mais recente.
          </p>
          <div style={{
            background: 'var(--bg-tertiary)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'monospace',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--accent-primary-light)',
            wordBreak: 'break-all',
          }}>
            {typeof window !== 'undefined' ? window.location.origin : 'https://seudominio.com'}/api/entrar?nicho=tenis
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-2)' }}>
            Com UTMs: /api/entrar?nicho=tenis&utm_source=instagram&utm_campaign=bio
          </p>
        </div>
      </main>
    </div>
  );
}
