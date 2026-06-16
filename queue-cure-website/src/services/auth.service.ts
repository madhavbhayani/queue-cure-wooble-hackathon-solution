import api from './api';

export const authService = {
  login: async (phone: string, pin: string) => {
    const response = await api.post('/auth/login', { phone, pin });
    return response.data;
  },

  signup: async (data: { name: string; phone: string; pin: string; address: string }) => {
    const response = await api.post('/auth/signup', data);
    return response.data;
  },

  verify: async () => {
    const response = await api.get('/auth/verify');
    return response.data;
  }
};
