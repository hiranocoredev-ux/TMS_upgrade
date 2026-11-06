import { useStore } from 'vuex';

/**
 * Vuex-backed auth helper with a Pinia-like surface for components.
 */
export function useAuthStore() {
  const store = useStore();
  return {
    get token() {
      return store.state.auth.token;
    },
    get user() {
      return store.state.auth.user;
    },
    get isAuthenticated() {
      return store.getters['auth/isAuthenticated'];
    },
    login: (email, password) => store.dispatch('auth/login', { email, password }),
    logout: () => store.dispatch('auth/logout'),
    restoreAuth: () => store.dispatch('auth/restoreAuth')
  };
}
