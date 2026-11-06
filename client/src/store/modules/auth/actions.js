import apiClient from '../../../services/axios';
import { nextTick } from 'vue';

export default {
  async login({ commit }, { email, password }) {
    try {
      const response = await apiClient.post('/auth/login', { email, password });

      if (response.data.ok && response.data.data) {
        commit('SET_TOKEN', response.data.data.token);
        commit('SET_USER', response.data.data.user);
        return response.data;
      }
      throw new Error(response.data.message || 'Login failed');
    } catch (error) {
      const errorData = error.response?.data || { message: 'Login failed' };
      throw new Error(errorData.message || 'Login failed');
    }
  },

  async logout({ commit }) {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      commit('CLEAR_AUTH');
      await nextTick();
      // Imported lazily on purpose: router/index.js imports this store, so a
      // top-level import here closes a cycle. Rollup hoists around it in a
      // production build, but under Vite's native-ESM dev server the evaluation
      // order can flip on an HMR reload and leave store/modules/auth mid-init —
      // surfacing as "does not provide an export named 'default'".
      const { default: router } = await import('../../../router');
      if (router.currentRoute.value.path !== '/login') {
        router.replace('/login').catch(() => {
          window.location.href = '/login';
        });
      }
    }
  },

  restoreAuth({ commit }) {
    const storedToken = localStorage.getItem('token');
    const storedUserStr = localStorage.getItem('user');

    if (storedToken && storedUserStr) {
      try {
        const storedUser = JSON.parse(storedUserStr);
        commit('SET_TOKEN', storedToken);
        commit('SET_USER', storedUser);
      } catch {
        commit('CLEAR_AUTH');
      }
    }
  }
};
