import React, { useEffect, useRef, useState } from 'react';
import { stocksAPI } from '../../services/api';
import '../../styles/components/search-bar.css';

const SearchBar = ({ onSelectStock, placeholder = 'Search stocks (AAPL, TCS, RELIANCE)' }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        const response = await stocksAPI.search(query);
        setResults(response.data.stocks || []);
        setShowDropdown(true);
      } catch (error) {
        setResults([]);
      }
      setLoading(false);
    }, 280);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSelect = (stock) => {
    onSelectStock(stock);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  return (
    <div className="search-bar" ref={wrapperRef}>
      <div className="search-input-wrap">
        <span className="search-prefix">SRCH</span>
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => query && setShowDropdown(true)}
        />
        {loading ? <span className="search-prefix">...</span> : null}
        {query ? (
          <button
            type="button"
            className="search-clear-btn btn-press"
            onClick={() => {
              setQuery('');
              setResults([]);
              setShowDropdown(false);
            }}
          >
            X
          </button>
        ) : null}
      </div>

      {showDropdown && results.length > 0 ? (
        <div className="search-dropdown">
          <p className="search-dropdown-header">
            {results.length} result{results.length === 1 ? '' : 's'}
          </p>
          {results.map((stock) => (
            <button
              key={stock.symbol}
              type="button"
              className="search-result"
              onClick={() => handleSelect(stock)}
            >
              <span>
                <span className="search-result-symbol">{stock.symbol}</span>
                <span className="search-result-name">{stock.name}</span>
              </span>
              <span className="search-result-right">
                <span className={`search-market-chip ${stock.market?.toLowerCase()}`}>
                  {stock.market}
                </span>
                {stock.sector ? <span className="search-sector-chip">{stock.sector}</span> : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {showDropdown && query && results.length === 0 && !loading ? (
        <div className="search-dropdown">
          <p className="search-empty">No stocks found for "{query}"</p>
        </div>
      ) : null}
    </div>
  );
};

export default SearchBar;
