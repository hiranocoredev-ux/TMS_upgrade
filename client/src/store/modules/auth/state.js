function readInitialAuth() {
  const storedToken = localStorage.getItem('token') || null;
  const storedUserStr = localStorage.getItem('user');
  let storedUser = null;
  if (storedUserStr) {
    try {
      storedUser = JSON.parse(storedUserStr);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
  return { token: storedToken, user: storedUser };
}

const { token, user } = readInitialAuth();

export default {
  token,
  user
};
