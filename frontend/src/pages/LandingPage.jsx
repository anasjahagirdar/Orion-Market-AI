import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/pages/landing-page.css';

/* ─── Icon components ───────────────────────────────────── */
const LogoChartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 17.5L8.2 13.3L11.3 16.4L19.5 8.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15.7 8.2H19.5V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const BrainIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 4.5C7.1 4.5 5.5 6.1 5.5 8C4.1 8.3 3 9.6 3 11.1C3 12.8 4.3 14.2 6 14.3V15.2C6 17 7.5 18.5 9.3 18.5H9.6C10.3 19.4 11.4 20 12.6 20C14 20 15.3 19.2 16 18H16.2C18 18 19.5 16.5 19.5 14.7V14.2C20.7 13.8 21.5 12.6 21.5 11.3C21.5 9.8 20.5 8.5 19 8.1C19 6.2 17.4 4.7 15.5 4.7C14.8 4.7 14.2 4.9 13.7 5.3C13.1 4.5 12.1 4 11 4C10.2 4 9.5 4.2 9 4.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.2 9.3V14.8M14.8 9.3V14.8M9.2 12H14.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const BotIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="4.5" y="7" width="15" height="11.5" rx="3" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 7V4.5M9.2 12.1H9.2M14.8 12.1H14.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M8.4 15.3H15.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3.8L14.5 9L20.2 9.8L16.1 13.8L17.1 19.5L12 16.8L6.9 19.5L7.9 13.8L3.8 9.8L9.5 9L12 3.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);
const BitcoinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M10 8.5H13.1C14.3 8.5 15.2 9.3 15.2 10.4C15.2 11.5 14.3 12.3 13.1 12.3H10.2H13.5C14.8 12.3 15.8 13.2 15.8 14.4C15.8 15.6 14.8 16.5 13.5 16.5H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M11.2 7V17M13.1 7V17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3.8 12H20.2M12 3.8C14.1 6 15.3 8.9 15.3 12C15.3 15.1 14.1 18 12 20.2C9.9 18 8.7 15.1 8.7 12C8.7 8.9 9.9 6 12 3.8Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

/* ─── Feature cards data ─────────────────────────────────── */
const featureCards = [
  { key: 'live', title: 'Live Stock Tracking', description: 'Track 400+ stocks across NSE, BSE, NYSE and NASDAQ with real-time price updates and historical charts.', accentClass: 'accent-blue', icon: <LogoChartIcon /> },
  { key: 'sentiment', title: 'AI Sentiment Analysis', description: 'FinBERT-powered sentiment engine analyzes thousands of news articles to give market mood scores.', accentClass: 'accent-violet', icon: <BrainIcon /> },
  { key: 'assistant', title: 'Orion AI Assistant', description: 'Ask anything about stocks. Get instant AI analysis powered by Google Gemini and RAG architecture.', accentClass: 'accent-cyan', icon: <BotIcon /> },
  { key: 'watchlist', title: 'Smart Watchlist', description: 'Build and track your personal portfolio. Monitor gains, losses, and sector exposure in real-time.', accentClass: 'accent-gold', icon: <StarIcon /> },
  { key: 'btc', title: 'BTC/USD ML Analysis', description: 'Machine learning price prediction with SHAP explainability. Understand why the model decides.', accentClass: 'accent-danger', icon: <BitcoinIcon /> },
  { key: 'sector', title: 'Sector Portfolio', description: 'Discover stocks grouped by sector across India and US markets for diversified investing.', accentClass: 'accent-success', icon: <GlobeIcon /> },
];

/* ─── Canvas star-field / particle network ───────────────── */
const StarCanvas = () => {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;
    canvas.width = width;
    canvas.height = height;

    // Build particle list
    const COUNT = Math.min(120, Math.floor((width * height) / 8000));
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.8 + 0.4,
      alpha: Math.random() * 0.5 + 0.2,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Mouse-attracted connection lines
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      particles.forEach((p) => {
        // Move
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Draw dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,212,255,${p.alpha})`;
        ctx.fill();

        // Connection lines between nearby particles
        particles.forEach((q) => {
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(0,212,255,${0.08 * (1 - dist / 110)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        });

        // Mouse proximity glow
        const mdx = p.x - mx;
        const mdy = p.y - my;
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mDist < 140) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r + 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,212,255,${0.6 * (1 - mDist / 140)})`;
          ctx.fill();
        }
      });

      frameRef.current = requestAnimationFrame(draw);
    };

    draw();

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handleResize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width;
      canvas.height = height;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="star-canvas" aria-hidden="true" />;
};

/* ─── 3D rotating orb (CSS 3D + SVG) ────────────────────── */
const OrbitOrb = () => {
  const orbRef = useRef(null);
  const mouse = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 15, y: -10 });
  const frameRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      mouse.current = {
        x: ((e.clientX - cx) / cx) * 18,
        y: ((e.clientY - cy) / cy) * -12,
      };
    };
    window.addEventListener('mousemove', handleMouseMove);

    let autoAngle = 0;
    const animate = () => {
      autoAngle += 0.25;
      const targetX = mouse.current.x + Math.sin((autoAngle * Math.PI) / 180) * 6;
      const targetY = mouse.current.y + Math.cos((autoAngle * Math.PI) / 180) * 4;

      current.current.x += (targetX - current.current.x) * 0.04;
      current.current.y += (targetY - current.current.y) * 0.04;

      if (orbRef.current) {
        orbRef.current.style.transform = `rotateY(${current.current.x}deg) rotateX(${current.current.y}deg)`;
      }
      frameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div className="orb-scene" aria-hidden="true">
      <div className="orb-perspective">
        <div className="orb-group" ref={orbRef}>
          {/* Core sphere */}
          <div className="orb-sphere">
            <div className="orb-inner-glow" />
            {/* Latitude rings */}
            {[-40, -20, 0, 20, 40].map((deg) => (
              <div
                key={deg}
                className="orb-ring-lat"
                style={{ transform: `rotateX(90deg) translateZ(${deg * 1.1}px)` }}
              />
            ))}
            {/* Longitude rings */}
            {[0, 36, 72, 108, 144].map((deg) => (
              <div
                key={deg}
                className="orb-ring-lon"
                style={{ transform: `rotateY(${deg}deg)` }}
              />
            ))}
          </div>
          {/* Orbiting rings */}
          <div className="orbit-ring orbit-ring-1" />
          <div className="orbit-ring orbit-ring-2" />
          <div className="orbit-ring orbit-ring-3" />
          {/* Orbit dots */}
          {[0, 120, 240].map((deg) => (
            <div key={deg} className="orbit-dot" style={{ '--deg': `${deg}deg` }} />
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── Floating data cards ────────────────────────────────── */
const FloatingCards = () => (
  <>
    <div className="floating-card card-one">
      <p className="floating-title">AAPL</p>
      <p className="floating-price">$247.99</p>
      <p className="floating-up">+1.2%</p>
      <svg viewBox="0 0 120 40" fill="none" className="mini-sparkline" aria-hidden="true">
        <path d="M2 30L20 22L34 24L48 14L62 18L76 10L94 16L118 8" stroke="url(#sparkGrad)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="120" y2="0">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
      </svg>
    </div>

    <div className="floating-card card-two">
      <p className="floating-title">Market Sentiment</p>
      <p className="floating-sub">Bullish 78%</p>
      <div className="sentiment-track">
        <div className="sentiment-fill" />
      </div>
    </div>

    <div className="floating-card card-three">
      <p className="floating-title">AI Analysis Active</p>
      <p className="floating-status">
        <span className="live-dot" />
        Real-time Engine
      </p>
    </div>
  </>
);

/* ─── Main LandingPage ───────────────────────────────────── */
const LandingPage = () => {
  const navigate = useNavigate();

  const goLogin = useCallback(() => navigate('/login'), [navigate]);
  const goDashboard = useCallback(() => navigate('/dashboard'), [navigate]);

  return (
    <div className="landing-root">
      {/* ── Navbar ── */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo-wrap">
            <div className="landing-logo-box">
              <LogoChartIcon />
            </div>
            <span className="landing-logo-text">Orion Market AI</span>
          </div>
          <div className="landing-nav-actions">
            <button type="button" className="landing-btn-outline btn-press" onClick={goLogin}>
              Login
            </button>
            <button type="button" className="landing-btn-primary btn-press" onClick={goLogin}>
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero-section">
        {/* Particle canvas background */}
        <StarCanvas />

        {/* 3D Orb */}
        <OrbitOrb />

        {/* Floating cards */}
        <FloatingCards />

        {/* Main hero text */}
        <div className="hero-content">
          <div className="hero-badge">
            <span className="live-dot" />
            AI-Powered Market Intelligence Platform
          </div>

          <h1 className="hero-title">
            <span>Analyze Markets</span>
            <span className="hero-title-accent">With AI Precision</span>
          </h1>

          <p className="hero-subtitle">
            Track 400+ stocks across India and US markets. Get real-time sentiment analysis,
            AI-powered insights, and portfolio management in one dashboard.
          </p>

          <div className="hero-actions">
            <button type="button" className="landing-btn-primary hero-cta btn-press" onClick={goLogin}>
              Start Trading Free
            </button>
            <button type="button" className="landing-btn-secondary hero-cta btn-press" onClick={goDashboard}>
              Enter Dashboard
            </button>
          </div>

          <div className="trust-badges">
            <span>400+ Stocks Tracked</span>
            <span>Real-time Sentiment AI</span>
            <span>Free to Start</span>
            <span>India &amp; US Markets</span>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="features-section">
        <header className="features-header">
          <p className="features-eyebrow">FEATURES</p>
          <h2>Everything you need to trade smarter</h2>
          <p>Powered by FinBERT AI and real-time market data</p>
        </header>

        <div className="features-grid">
          {featureCards.map((card) => (
            <article key={card.key} className={`feature-card ${card.accentClass} card-enter`}>
              <div className="feature-icon">{card.icon}</div>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="stats-section">
        <div className="stats-grid">
          <div className="stat-item"><strong>400+</strong><span>Stocks Tracked</span></div>
          <div className="stat-item"><strong>2</strong><span>Market Regions</span></div>
          <div className="stat-item"><strong>Real-time</strong><span>Sentiment Updates</span></div>
          <div className="stat-item"><strong>Free</strong><span>To Get Started</span></div>
        </div>
      </section>

      <footer className="landing-footer">© 2026 Orion Market AI. Built with FinBERT AI + Django + React</footer>
    </div>
  );
};

export default LandingPage;
