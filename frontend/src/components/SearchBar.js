import React, { useState, useEffect, useRef } from 'react';
import { stocksAPI } from '../services/api';

const SearchBar = ({ onSelectStock }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await stocksAPI.search(query);
        setResults(res.data.stocks || []);
        setShowDropdown(true);
      } catch (error) {
        console.log('Search error:', error);
      }
      setLoading(false);
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSelect = (stock) => {
    onSelectStock(stock);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  const getMarketBadgeColor = (market) => {
    if (market === 'US') return { bg: 'rgba(0,212,170,0.15)', color: '#00d4aa' };
    if (market === 'IN') return { bg: 'rgba(255,165,0,0.15)', color: '#ffa500' };
    return { bg: 'rgba(108,99,255,0.15)', color: '#6c63ff' };
  };

  return (
    <div ref={wrapperRef} style={styles.wrapper}>
      <div style={styles.inputWrapper}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search 400+ stocks... (AAPL, TCS, RELIANCE)"
          style={styles.input}
          onFocus={() => query && setShowDropdown(true)}
        />
        {loading && <span style={styles.spinner}>⟳</span>}
        {query && (
          <span
            style={styles.clearBtn}
            onClick={() => { setQuery(''); setResults([]); setShowDropdown(false); }}
          >
            ✕
          </span>
        )}
      </div>

      {/* Dropdown Results */}
      {showDropdown && results.length > 0 && (
        <div style={styles.dropdown}>
          <p style={styles.dropdownHeader}>
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </p>
          {results.map((stock) => {
            const badge = getMarketBadgeColor(stock.market);
            return (
              <div
                key={stock.symbol}
                style={styles.resultItem}
                onClick={() => handleSelect(stock)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(108,99,255,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={styles.resultLeft}>
                  <span style={styles.resultSymbol}>{stock.symbol}</span>
                  <span style={styles.resultName}>{stock.name}</span>
                </div>
                <div style={styles.resultRight}>
                  <span style={{
                    ...styles.marketBadge,
                    background: badge.bg,
                    color: badge.color,
                  }}>
                    {stock.market}
                  </span>
                  {stock.sector && (
                    <span style={styles.sectorTag}>{stock.sector}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No results */}
      {showDropdown && query && results.length === 0 && !loading && (
        <div style={styles.dropdown}>
          <p style={styles.noResults}>No stocks found for "{query}"</p>
        </div>
      )}
    </div>
  );
};

const styles = {
  wrapper: {
    position: 'relative',
    width: '100%',
    maxWidth: '600px',
    zIndex: 100,
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px',
    padding: '0 14px',
    gap: '10px',
    transition: 'border 0.2s',
  },
  searchIcon: { fontSize: '16px', opacity: 0.5 },
  input: {
    flex: 1,
    padding: '13px 0',
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  spinner: {
    color: '#6c63ff',
    fontSize: '16px',
    animation: 'spin 1s linear infinite',
  },
  clearBtn: {
    color: 'rgba(255,255,255,0.3)',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: 0,
    right: 0,
    background: '#13132b',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
    maxHeight: '360px',
    overflowY: 'auto',
    padding: '8px',
  },
  dropdownHeader: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: '11px',
    padding: '4px 10px 8px',
    margin: 0,
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    marginBottom: '4px',
  },
  resultItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  resultLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  resultSymbol: {
    color: '#fff',
    fontWeight: '600',
    fontSize: '14px',
  },
  resultName: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '12px',
  },
  resultRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  marketBadge: {
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '700',
  },
  sectorTag: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: '10px',
    maxWidth: '100px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  noResults: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: '13px',
    textAlign: 'center',
    padding: '20px',
    margin: 0,
  },
};

export default SearchBar;