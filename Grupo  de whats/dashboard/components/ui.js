'use client';

export function PlatformBadge({ platform }) {
  const config = {
    shopee: { label: 'Shopee', className: 'badge-shopee' },
    mercado_livre: { label: 'ML', className: 'badge-ml' },
    amazon: { label: 'Amazon', className: 'badge-amber' },
    shein: { label: 'Shein', className: 'badge-shein' },
    netshoes: { label: 'Netshoes', className: 'badge-netshoes' },
    centauro: { label: 'Centauro', className: 'badge-centauro' },
  };

  const c = config[platform] || { label: platform, className: 'badge-blue' };
  return <span className={`badge ${c.className}`}>{c.label}</span>;
}

export function StatusBadge({ status }) {
  const config = {
    ativo: { label: 'Ativo', className: 'badge-green' },
    cheio: { label: 'Cheio', className: 'badge-amber' },
    arquivado: { label: 'Arquivado', className: 'badge-blue' },
    banido: { label: 'Banido', className: 'badge-red' },
    pendente: { label: 'Pendente', className: 'badge-amber' },
    aprovada: { label: 'Aprovada', className: 'badge-blue' },
    enviada: { label: 'Enviada', className: 'badge-green' },
    descartada: { label: 'Descartada', className: 'badge-red' },
    erro_ia: { label: 'Erro IA', className: 'badge-red' },
    agendado: { label: 'Agendado', className: 'badge-blue' },
    enviando: { label: 'Enviando', className: 'badge-amber' },
    enviado: { label: 'Enviado', className: 'badge-green' },
    falhou: { label: 'Falhou', className: 'badge-red' },
    cancelado: { label: 'Cancelado', className: 'badge-red' },
    paga: { label: 'Paga', className: 'badge-green' },
    cancelada: { label: 'Cancelada', className: 'badge-red' },
    aquecendo: { label: 'Aquecendo', className: 'badge-amber' },
    pausado: { label: 'Pausado', className: 'badge-amber' },
  };

  const c = config[status] || { label: status, className: 'badge-blue' };
  return <span className={`badge ${c.className}`}>{c.label}</span>;
}

export function ProgressBar({ value, max, color = 'green' }) {
  const pct = Math.min((value / max) * 100, 100);
  let barColor = color;
  if (color === 'auto') {
    if (pct >= 90) barColor = 'red';
    else if (pct >= 70) barColor = 'amber';
    else barColor = 'green';
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <div className="progress-bar" style={{ flex: 1 }}>
        <div className={`progress-fill ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', minWidth: '35px' }}>
        {Math.round(pct)}%
      </span>
    </div>
  );
}

export function TimeAgo({ date }) {
  if (!date) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
  
  const now = new Date();
  const d = new Date(date);
  const diff = Math.floor((now - d) / 1000);

  if (diff < 60) return <span>{diff}s atrás</span>;
  if (diff < 3600) return <span>{Math.floor(diff / 60)}min atrás</span>;
  if (diff < 86400) return <span>{Math.floor(diff / 3600)}h atrás</span>;
  return <span>{Math.floor(diff / 86400)}d atrás</span>;
}

export function FormatCurrency({ value }) {
  if (value === null || value === undefined) return <span>—</span>;
  return (
    <span>
      R$ {Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}
