import React from 'react';
import Sidebar from './Sidebar';
import ChatbotShell from '../Chatbot/ChatbotShell';
import StockTicker from '../StockTicker/StockTicker';

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
  return (
    <div className="app-shell">
      <Sidebar activePath={activePath} user={user} onLogout={onLogout} />

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

        <StockTicker />
        <main className="app-page-content">{children}</main>
        <ChatbotShell />
      </div>
    </div>
  );
};

export default AppShell;
