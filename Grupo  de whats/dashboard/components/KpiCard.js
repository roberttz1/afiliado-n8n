'use client';

export default function KpiCard({ title, value, icon, accent = 'primary', change = null, subtitle = null }) {
  return (
    <div className={`card kpi-card accent-${accent} animate-fade-in`}>
      <div className="card-header">
        <span className="card-title">{title}</span>
        <span className="card-icon">{icon}</span>
      </div>
      <div className="kpi-value">{value}</div>
      {change !== null && (
        <div className={`kpi-change ${change >= 0 ? 'positive' : 'negative'}`}>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
        </div>
      )}
      {subtitle && (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
