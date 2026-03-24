import React from 'react';
import { useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { key: '/dashboard', label: 'Dashboard', short: 'DB' },
  { key: '/watchlist', label: 'Watchlist', short: 'WL' },
  { key: '/btc-analysis', label: 'BTC/USD Analysis', short: 'BT' },
  { key: '/chatbot', label: 'AI Analysis', short: 'AI' },
];

const AppShell = ({
  title,
  subtitle,
  activePath,
  headerExtra = null,
  indicators = [],
  portfolioValue = '--',
  user,
  onLogout,
  children,
}) => {
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside className="app-sidebar glass-panel">
        <button className="app-brand" type="button" onClick={() => navigate('/dashboard')}>
          <span className="app-brand-mark">OR</span>
          <div>
            <p className="app-brand-title">Orion Market</p>
            <p className="app-brand-subtitle">Trading Workspace</p>
          </div>
        </button>

        <nav className="app-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`app-nav-item ${activePath === item.key ? 'active' : ''}`}
              onClick={() => navigate(item.key)}
            >
              <span className="app-nav-item-short">{item.short}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-user">
            <div className="app-user-avatar">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="app-user-meta">
              <p>{user?.username || 'Guest'}</p>
              <span>Signed In</span>
            </div>
          </div>
          <button type="button" className="app-logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar glass-panel">
          <div className="app-topbar-left">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="app-topbar-center">{headerExtra}</div>

          <div className="app-topbar-right">
            <div className="market-indicators">
              {indicators.map((indicator) => (
                <div
                  key={indicator.label}
                  className={`market-indicator ${indicator.tone || 'neutral'}`}
                >
                  <span>{indicator.label}</span>
                  <strong>{indicator.value}</strong>
                </div>
              ))}
            </div>
            <div className="portfolio-pill">
              <span>Portfolio Value</span>
              <strong>{portfolioValue}</strong>
            </div>
          </div>
        </header>

        <main className="app-page-content">{children}</main>
      </div>
    </div>
  );
};

export default AppShell;
