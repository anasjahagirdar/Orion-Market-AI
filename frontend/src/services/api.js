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
  logout: () => api.post('/auth/logout/'),
  profile: () => api.get('/auth/profile/'),
};

// ─── Stocks APIs ──────────────────────────────────────
export const stocksAPI = {
  getAll: () => api.get('/stocks/'),
  search: (query) => api.get(`/stocks/?search=${query}`),
  getByMarket: (market) => api.get(`/stocks/?market=${market}`),
  getDetail: (symbol) => api.get(`/stocks/${symbol}/`),
  getPrice: (symbol) => api.get(`/stocks/${symbol}/price/`),
  getHistory: (symbol, period = '1mo') =>
    api.get(`/stocks/${symbol}/history/?period=${period}`),
  getWatchlist: () => api.get('/stocks/watchlist/'),
  addToWatchlist: (symbol, notes = '') =>
    api.post('/stocks/watchlist/add/', { symbol, notes }),
  removeFromWatchlist: (symbol) =>
    api.delete(`/stocks/watchlist/remove/${symbol}/`),
};

// ─── News APIs ────────────────────────────────────────
export const newsAPI = {
  getAll: (query = 'stock market') => api.get(`/news/?q=${query}`),
  getStockNews: (symbol) => api.get(`/news/${symbol}/`),
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

export default api;