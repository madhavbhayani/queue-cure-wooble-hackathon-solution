import api from './api';

export const sessionService = {
  startSession: async () => {
    const response = await api.post('/session/start');
    return response.data;
  },
  getActiveSession: async () => {
    const response = await api.get('/session/active');
    return response.data;
  },
  getAllSessions: async (params?: any) => {
    const response = await api.get('/session/list', { params });
    return response.data;
  },
  getSessionDetails: async (slug: string) => {
    const response = await api.get(`/session/${slug}`);
    return response.data;
  },
  endSession: async (slug: string) => {
    const response = await api.put(`/session/${slug}/end`);
    return response.data;
  }
};
