import api from './api';

export const qualityStocksApi = {
  getAll: () => api.get('/quality-stocks/'),
  getDetail: (ticker) => api.get(`/quality-stocks/${ticker}/`),
  getSectors: () => api.get('/quality-stocks/sectors/'),
  refresh: () => api.post('/quality-stocks/refresh/'),
};

export default qualityStocksApi;
