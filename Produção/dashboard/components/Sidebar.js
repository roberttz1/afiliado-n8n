'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_ITEMS = [
  { section: 'Principal' },
  { href: '/', icon: '📊', label: 'Dashboard', id: 'nav-dashboard' },
  { href: '/grupos', icon: '💬', label: 'Grupos', id: 'nav-grupos' },
  { href: '/ofertas', icon: '🏷️', label: 'Ofertas', id: 'nav-ofertas' },
  { section: 'Operações' },
  { href: '/fila', icon: '📤', label: 'Fila de Envio', id: 'nav-fila', badge: null },
  { href: '/comissoes', icon: '💰', label: 'Comissões', id: 'nav-comissoes' },
  { href: '/saude', icon: '🛡️', label: 'Saúde', id: 'nav-saude' },
  { section: 'Análise' },
  { href: '/cliques', icon: '🔗', label: 'Cliques & UTMs', id: 'nav-cliques' },
  { section: 'Sistema' },
  { href: '/config', icon: '⚙️', label: 'Configurações', id: 'nav-config' },
  { href: '/manual', icon: '➕', label: 'Oferta Manual', id: 'nav-manual' },
];

export default function Sidebar({ isDemo = true }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">GO</div>
        <div>
          <div className="sidebar-title">Grupos Ofertas</div>
          <div className="sidebar-subtitle">Nicho: Tênis</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item, index) => {
          if (item.section) {
            return (
              <div key={`section-${index}`} className="nav-section-label">
                {item.section}
              </div>
            );
          }

          const isActive = pathname === item.href;

          return (
            <Link
              key={item.id}
              href={item.href}
              id={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-item-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge !== null && (
                <span className="nav-item-badge">{item.badge}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="status-indicator">
          <span className={`status-dot ${isDemo ? 'demo' : 'online'}`}></span>
          <span>{isDemo ? 'Modo Demo' : 'Sistema Online'}</span>
        </div>
      </div>
    </aside>
  );
}
