export default {
  token: (state) => state.token,
  user: (state) => state.user,
  isAuthenticated: (state) => !!state.token && !!state.user
};
