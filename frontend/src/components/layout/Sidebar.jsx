import React from 'react';
import { useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { key: '/dashboard', label: 'Dashboard', short: 'DB' },
  { key: '/watchlist', label: 'Watchlist', short: 'WL' },
  { key: '/portfolio-analysis', label: 'Portfolio Analysis', short: 'PF' },
  { key: '/btc-analysis', label: 'BTC/USD Analysis', short: 'BT' },
  { key: '/chatbot', label: 'AI Analysis', short: 'AI' },
];

const Sidebar = ({ activePath, user, onLogout }) => {
  const navigate = useNavigate();

  return (
    <aside className="app-sidebar glass-panel">
      <button className="app-brand btn-press" type="button" onClick={() => navigate('/dashboard')}>
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
            className={`app-nav-item btn-press ${activePath === item.key ? 'active' : ''}`}
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
        <button type="button" className="app-logout-btn btn-press" onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
};

export default React.memo(Sidebar);
