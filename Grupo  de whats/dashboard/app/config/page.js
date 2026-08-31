'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabase';

const DEFAULT_CONFIG = {
  intervalo_envio_min: 5,
  intervalo_envio_max: 10,
  desconto_minimo: 30,
  preco_min_tenis: 30,
  preco_max_tenis: 500,
  max_ofertas_dia_grupo: 60,
  capacidade_maxima_grupo: 950,
  horario_inicio: 8,
  horario_fim: 22,
  max_mensagens_hora_instancia: 20,
  taxa_saida_alerta: 5,
  jitter_segundos: 30,
};

export default function ConfigPage() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [isDemo, setIsDemo] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('configuracoes')
            .select('*');
          
          if (!error && data && data.length > 0) {
            const configMap = {};
            data.forEach(row => {
              configMap[row.chave] = typeof row.valor === 'string' ? parseInt(row.valor) || row.valor : row.valor;
            });
            setConfig({ ...DEFAULT_CONFIG, ...configMap });
            setIsDemo(false);
            return;
          }
        } catch {}
      }
      setIsDemo(true);
    }
    loadData();
  }, []);

  function handleChange(key, value) {
    setConfig(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    if (isDemo || !supabase) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return;
    }

    try {
      for (const [key, value] of Object.entries(config)) {
        await supabase
          .from('configuracoes')
          .upsert({ chave: key, valor: JSON.stringify(value), atualizado_em: new Date().toISOString() });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Erro ao salvar:', err);
    }
  }

  const sections = [
    {
      title: '⏱️ Throttle de Envio',
      description: 'Controle do intervalo entre mensagens para evitar detecção de spam.',
      fields: [
        { key: 'intervalo_envio_min', label: 'Intervalo mínimo (minutos)', type: 'number', min: 1, max: 60 },
        { key: 'intervalo_envio_max', label: 'Intervalo máximo (minutos)', type: 'number', min: 1, max: 60 },
        { key: 'jitter_segundos', label: 'Jitter ± segundos (humanização)', type: 'number', min: 0, max: 120 },
        { key: 'horario_inicio', label: 'Hora de início (BRT)', type: 'number', min: 0, max: 23 },
        { key: 'horario_fim', label: 'Hora de fim (BRT)', type: 'number', min: 0, max: 23 },
        { key: 'max_mensagens_hora_instancia', label: 'Máx. mensagens/hora por instância', type: 'number', min: 1, max: 100 },
        { key: 'max_ofertas_dia_grupo', label: 'Máx. ofertas/dia por grupo', type: 'number', min: 1, max: 200 },
      ],
    },
    {
      title: '🏷️ Regras de Validação',
      description: 'Critérios para aprovação automática de ofertas.',
      fields: [
        { key: 'desconto_minimo', label: 'Desconto mínimo (%)', type: 'number', min: 5, max: 90 },
        { key: 'preco_min_tenis', label: 'Preço mínimo R$ (tênis)', type: 'number', min: 1 },
        { key: 'preco_max_tenis', label: 'Preço máximo R$ (tênis)', type: 'number', min: 50 },
      ],
    },
    {
      title: '💬 Grupos',
      description: 'Configuração de capacidade e rotação de grupos.',
      fields: [
        { key: 'capacidade_maxima_grupo', label: 'Capacidade máxima (membros)', type: 'number', min: 100, max: 1024 },
        { key: 'taxa_saida_alerta', label: 'Taxa de saída para alerta (%)', type: 'number', min: 1, max: 50 },
      ],
    },
  ];

  return (
    <div className="app-layout">
      <Sidebar isDemo={isDemo} />
      
      <main className="main-content">
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">Configurações</h1>
            <p className="page-subtitle">Ajuste os parâmetros do sistema</p>
          </div>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? '✅ Salvo!' : '💾 Salvar'}
          </button>
        </div>

        {isDemo && (
          <div className="demo-banner">
            <span className="demo-banner-icon">⚠️</span>
            <div><strong>Modo Demo</strong> — Alterações não serão salvas sem Supabase configurado.</div>
          </div>
        )}

        {sections.map((section, si) => (
          <div className="card" key={si} style={{ marginBottom: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
              {section.title}
            </h2>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
              {section.description}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              {section.fields.map((field) => (
                <div key={field.key}>
                  <label
                    htmlFor={`config-${field.key}`}
                    style={{
                      display: 'block',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--text-secondary)',
                      marginBottom: 'var(--space-1)',
                      fontWeight: 600,
                    }}
                  >
                    {field.label}
                  </label>
                  <input
                    id={`config-${field.key}`}
                    type={field.type}
                    min={field.min}
                    max={field.max}
                    value={config[field.key] || ''}
                    onChange={(e) => handleChange(field.key, parseInt(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-3)',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--font-size-sm)',
                      fontFamily: 'var(--font-family)',
                      outline: 'none',
                      transition: 'border-color var(--transition-fast)',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-medium)'}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
