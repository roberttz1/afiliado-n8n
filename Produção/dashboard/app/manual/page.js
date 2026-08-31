'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabase';

export default function ManualPage() {
  const [form, setForm] = useState({
    plataforma: 'shopee',
    titulo_original: '',
    preco_de: '',
    preco_por: '',
    cupom: '',
    link_afiliado: '',
    imagem_url: '',
    categoria: 'tenis',
  });
  const [status, setStatus] = useState(null); // null | 'saving' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const isDemo = !supabase;

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('saving');
    setErrorMsg('');

    // Validação local
    if (!form.titulo_original.trim()) {
      setErrorMsg('Título do produto é obrigatório.');
      setStatus('error');
      return;
    }
    if (!form.link_afiliado.trim()) {
      setErrorMsg('Link de afiliado é obrigatório.');
      setStatus('error');
      return;
    }
    if (!form.preco_de || !form.preco_por) {
      setErrorMsg('Preços são obrigatórios.');
      setStatus('error');
      return;
    }

    if (isDemo) {
      // Simular salvamento em modo demo
      await new Promise(r => setTimeout(r, 1000));
      setStatus('success');
      setTimeout(() => setStatus(null), 3000);
      return;
    }

    try {
      const { error } = await supabase.from('ofertas').insert({
        plataforma: form.plataforma,
        titulo_original: form.titulo_original.trim(),
        preco_de: parseFloat(form.preco_de),
        preco_por: parseFloat(form.preco_por),
        cupom: form.cupom.trim() || null,
        link_afiliado: form.link_afiliado.trim(),
        imagem_url: form.imagem_url.trim() || null,
        categoria: form.categoria,
        fonte: 'manual',
        status: 'pendente',
      });

      if (error) throw error;

      setStatus('success');
      setForm({
        plataforma: 'shopee',
        titulo_original: '',
        preco_de: '',
        preco_por: '',
        cupom: '',
        link_afiliado: '',
        imagem_url: '',
        categoria: 'tenis',
      });
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao salvar a oferta.');
      setStatus('error');
    }
  }

  const inputStyle = {
    width: '100%',
    padding: 'var(--space-3) var(--space-4)',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family)',
    outline: 'none',
    transition: 'border-color var(--transition-fast)',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--text-secondary)',
    marginBottom: 'var(--space-1)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  return (
    <div className="app-layout">
      <Sidebar isDemo={isDemo} />
      
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">Oferta Manual</h1>
          <p className="page-subtitle">Adicionar uma oferta manualmente ao sistema</p>
        </div>

        {isDemo && (
          <div className="demo-banner">
            <span className="demo-banner-icon">⚠️</span>
            <div><strong>Modo Demo</strong> — A oferta não será salva sem Supabase configurado.</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="card" style={{ maxWidth: '700px' }}>
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--space-5)' }}>
              ➕ Nova Oferta
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              {/* Plataforma */}
              <div>
                <label htmlFor="manual-plataforma" style={labelStyle}>Plataforma</label>
                <select
                  id="manual-plataforma"
                  value={form.plataforma}
                  onChange={(e) => handleChange('plataforma', e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="amazon">Amazon</option>
                  <option value="mercado_livre">Mercado Livre</option>
                  <option value="shopee">Shopee</option>
                  <option value="shein">Shein</option>
                  <option value="netshoes">Netshoes</option>
                  <option value="centauro">Centauro</option>
                </select>
              </div>

              {/* Categoria */}
              <div>
                <label htmlFor="manual-categoria" style={labelStyle}>Categoria</label>
                <select
                  id="manual-categoria"
                  value={form.categoria}
                  onChange={(e) => handleChange('categoria', e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="tenis">👟 Tênis</option>
                  <option value="casa">🏠 Casa</option>
                  <option value="perfumes">🧴 Perfumes</option>
                  <option value="roupas">👕 Roupas</option>
                  <option value="eletronicos">📱 Eletrônicos</option>
                </select>
              </div>
            </div>

            {/* Título */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="manual-titulo" style={labelStyle}>Título do Produto *</label>
              <input
                id="manual-titulo"
                type="text"
                placeholder="Ex: Tênis Nike Revolution 7 Masculino"
                value={form.titulo_original}
                onChange={(e) => handleChange('titulo_original', e.target.value)}
                style={inputStyle}
                required
              />
            </div>

            {/* Preços */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <div>
                <label htmlFor="manual-preco-de" style={labelStyle}>Preço Original (R$) *</label>
                <input
                  id="manual-preco-de"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="349.99"
                  value={form.preco_de}
                  onChange={(e) => handleChange('preco_de', e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label htmlFor="manual-preco-por" style={labelStyle}>Preço com Desconto (R$) *</label>
                <input
                  id="manual-preco-por"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="199.99"
                  value={form.preco_por}
                  onChange={(e) => handleChange('preco_por', e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
            </div>

            {/* Desconto calculado */}
            {form.preco_de && form.preco_por && parseFloat(form.preco_de) > 0 && (
              <div style={{
                background: 'var(--accent-green-bg)',
                border: '1px solid var(--accent-green-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-2) var(--space-3)',
                marginBottom: 'var(--space-4)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--accent-green)',
                fontWeight: 600,
              }}>
                🔥 Desconto: {((1 - parseFloat(form.preco_por) / parseFloat(form.preco_de)) * 100).toFixed(1)}%
              </div>
            )}

            {/* Cupom */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="manual-cupom" style={labelStyle}>Cupom (opcional)</label>
              <input
                id="manual-cupom"
                type="text"
                placeholder="Ex: AGORAVAI"
                value={form.cupom}
                onChange={(e) => handleChange('cupom', e.target.value.toUpperCase())}
                style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'monospace' }}
              />
            </div>

            {/* Link afiliado */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="manual-link" style={labelStyle}>Link de Afiliado *</label>
              <input
                id="manual-link"
                type="url"
                placeholder="https://..."
                value={form.link_afiliado}
                onChange={(e) => handleChange('link_afiliado', e.target.value)}
                style={inputStyle}
                required
              />
            </div>

            {/* Imagem */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <label htmlFor="manual-imagem" style={labelStyle}>URL da Imagem (opcional)</label>
              <input
                id="manual-imagem"
                type="url"
                placeholder="https://..."
                value={form.imagem_url}
                onChange={(e) => handleChange('imagem_url', e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Feedback */}
            {status === 'error' && errorMsg && (
              <div style={{
                background: 'var(--accent-red-bg)',
                border: '1px solid var(--accent-red-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
                color: 'var(--accent-red)',
                fontSize: 'var(--font-size-sm)',
              }}>
                ❌ {errorMsg}
              </div>
            )}

            {status === 'success' && (
              <div style={{
                background: 'var(--accent-green-bg)',
                border: '1px solid var(--accent-green-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
                color: 'var(--accent-green)',
                fontSize: 'var(--font-size-sm)',
              }}>
                ✅ Oferta salva com sucesso! Ela entrará na fila de validação e geração de título pela IA.
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={status === 'saving'}
              style={{
                padding: 'var(--space-3) var(--space-8)',
                fontSize: 'var(--font-size-base)',
              }}
            >
              {status === 'saving' ? '⏳ Salvando...' : '📤 Adicionar Oferta'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
