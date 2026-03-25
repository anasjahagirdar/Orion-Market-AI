import axios from 'axios';

// Base URL pointing to Django backend
const API_BASE_URL = 'http://127.0.0.1:8000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
  },
});

const responseCache = new Map();
const inflightRequests = new Map();

const cacheKeyFor = (path, params = null) => {
  if (!params) {
    return path;
  }
  const query = new URLSearchParams(params).toString();
  return query ? `${path}?${query}` : path;
};

const cloneResponse = (response) => ({
  ...response,
  data: response?.data ? JSON.parse(JSON.stringify(response.data)) : response?.data,
});

const cachedGet = ({ key, ttlMs, requestFn }) => {
  if (ttlMs > 0) {
    const entry = responseCache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return Promise.resolve(cloneResponse(entry.response));
    }
  }

  const inflight = inflightRequests.get(key);
  if (inflight) {
    return inflight.then(cloneResponse);
  }

  const requestPromise = requestFn()
    .then((response) => {
      if (ttlMs > 0) {
        responseCache.set(key, {
          expiresAt: Date.now() + ttlMs,
          response,
        });
      }
      return response;
    })
    .finally(() => {
      inflightRequests.delete(key);
    });

  inflightRequests.set(key, requestPromise);
  return requestPromise.then(cloneResponse);
};

// ─── Request interceptor: attach Token auth header ────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('orion_token');
  if (token) {
    config.headers['Authorization'] = `Token ${token}`;
  }
  return config;
});

// ─── Auth APIs ────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register/', data),
  login: (data) => api.post('/auth/login/', data),
  syncTelegramChat: (identifier) =>
    api.post('/auth/sync-telegram-chat/', { identifier }),
  sendTelegramOtp: (identifier, purpose = 'login') =>
    api.post('/auth/send-telegram-otp/', { identifier, purpose }),
  verifyTelegramOtp: (identifier, otp, purpose = 'login') =>
    api.post('/auth/verify-telegram-otp/', { identifier, otp, purpose }),
  getSecurityQuestions: (username) =>
    api.post('/auth/security-questions/', { username }),
  verifySecurityAnswers: (username, answers) =>
    api.post('/auth/verify-security-answers/', { username, answers }),
  resetPassword: (identifier, otp, newPassword) =>
    api.post('/auth/reset-password/', {
      identifier,
      otp,
      new_password: newPassword,
    }),
  resetPasswordWithSecurityToken: (username, securityToken, newPassword) =>
    api.post('/auth/reset-password/', {
      username,
      security_token: securityToken,
      new_password: newPassword,
    }),
  logout: () => api.post('/auth/logout/'),
  profile: () => api.get('/auth/profile/'),
};

// ─── Stocks APIs ──────────────────────────────────────
export const stocksAPI = {
  getAll: () => api.get('/stocks/'),
  search: (query) =>
    cachedGet({
      key: cacheKeyFor('/stocks/search', { q: query }),
      ttlMs: 30 * 1000,
      requestFn: () => api.get(`/stocks/?search=${query}`),
    }),
  getByMarket: (market, limit = 500) =>
    cachedGet({
      key: cacheKeyFor('/stocks/market', { market, limit }),
      ttlMs: 10 * 60 * 1000,
      requestFn: () => api.get(`/stocks/?market=${market}&limit=${limit}`),
    }),
  getDetail: (symbol) => api.get(`/stocks/${symbol}/`),
  getPrice: (symbol) =>
    cachedGet({
      key: cacheKeyFor(`/stocks/${symbol}/price`),
      ttlMs: 20 * 1000,
      requestFn: () => api.get(`/stocks/${symbol}/price/`),
    }),
  getHistory: (symbol, period = '1mo') =>
    cachedGet({
      key: cacheKeyFor(`/stocks/${symbol}/history`, { period }),
      ttlMs: period === '1mo' ? 60 * 1000 : 2 * 60 * 1000,
      requestFn: () => api.get(`/stocks/${symbol}/history/?period=${period}`),
    }),
  getWatchlist: () => api.get('/stocks/watchlist/'),
  addToWatchlist: (symbol, notes = '') =>
    api.post('/stocks/watchlist/add/', { symbol, notes }),
  removeFromWatchlist: (symbol) =>
    api.delete(`/stocks/watchlist/remove/${symbol}/`),
};

// ─── News APIs ────────────────────────────────────────
export const newsAPI = {
  getAll: (query = 'stock market') =>
    cachedGet({
      key: cacheKeyFor('/news', { q: query }),
      ttlMs: 2 * 60 * 1000,
      requestFn: () => api.get(`/news/?q=${query}`),
    }),
  getStockNews: (symbol) =>
    cachedGet({
      key: cacheKeyFor(`/news/${symbol}`),
      ttlMs: 60 * 1000,
      requestFn: () => api.get(`/news/${symbol}/`),
    }),
};

// ─── Sentiment APIs ───────────────────────────────────
export const sentimentAPI = {
  analyze: (text) => api.post('/sentiment/analyze/', { text }),
  getStockSentiment: (symbol) => api.get(`/sentiment/${symbol}/`),
  getSentimentSummary: (symbol) => api.get(`/sentiment/${symbol}/summary/`),
};

// ─── Chatbot APIs ─────────────────────────────────────
export const chatbotAPI = {
  sendMessage: (message, session_id = null) =>
    api.post('/chatbot/chat/', { message, session_id }),
  getSessions: () => api.get('/chatbot/sessions/'),
  getSessionMessages: (sessionId) =>
    api.get(`/chatbot/sessions/${sessionId}/`),
  deleteSession: (sessionId) =>
    api.delete(`/chatbot/sessions/${sessionId}/delete/`),
};

// BTC Analysis APIs
export const btcAPI = {
  getAnalysis: (refresh = false) =>
    api.get(`/btc-analysis/${refresh ? '?refresh=1' : ''}`),
};

export const portfolioAPI = {
  getSectors: (market) =>
    cachedGet({
      key: cacheKeyFor(`/sectors/${market}`),
      ttlMs: 10 * 60 * 1000,
      requestFn: () => api.get(`/sectors/${encodeURIComponent(market)}/`),
    }),
  getSector: (market, sector) =>
    cachedGet({
      key: cacheKeyFor(`/portfolio/${market}/${sector}`),
      ttlMs: 10 * 60 * 1000,
      requestFn: () => api.get(`/portfolio/${encodeURIComponent(market)}/${encodeURIComponent(sector)}/`),
    }),
  getSectorFresh: (market, sector) =>
    api.get(`/portfolio/${encodeURIComponent(market)}/${encodeURIComponent(sector)}/`),
  recompute: (market = 'all') => api.post(`/recompute-portfolio/${encodeURIComponent(market)}/`),
};

export default api;
