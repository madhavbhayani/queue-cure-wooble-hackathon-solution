import api from './api';

export const sessionService = {
  startSession: async () => {
    const response = await api.post('/session/start');
    return response.data;
  },
  getActiveSession: async () => {
    const response = await api.get('/session/active');
    return response.data;
  }
};
