<template>
  <div class="login-page">
    <div class="login-page__ambient" aria-hidden="true">
      <div class="login-page__mesh" />
      <div class="login-page__orb login-page__orb--a" />
      <div class="login-page__orb login-page__orb--b" />
      <div class="login-page__orb login-page__orb--c" />
      <div class="login-page__grid" />
      <div class="login-page__vignette" />
    </div>

    <div class="login-page__shell">
      <aside class="login-page__hero">
        <div class="login-page__hero-panel">
          <div class="login-page__hero-inner">
            <!-- Same TMS identity as sidebar; scaled for login hero -->
            <div class="login-brand login-brand--hero" aria-label="Team Management System">
              <div class="login-brand__mark" aria-hidden="true">TMS</div>
              <div class="login-brand__text">
                <strong>Team Management</strong>
                <span>System</span>
              </div>
            </div>
            <p class="login-page__hero-text">
              Reports, workflows, and team visibility in one place—secure access for your organization.
            </p>
          </div>
        </div>
      </aside>

      <main class="login-page__main">
        <div class="login-card">
          <header class="login-card__head">
            <p class="login-card__eyebrow">Welcome back</p>
            <h1 class="login-card__title">Sign in</h1>
            <p class="login-card__sub">Enter your credentials to continue.</p>
          </header>

          <form class="login-form" @submit.prevent="handleSubmit" novalidate>
            <div class="field">
              <label class="field__label" for="email">Email</label>
              <div class="field__control">
                <span class="field__icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <path d="m22 6-10 7L2 6" />
                  </svg>
                </span>
                <input
                  id="email"
                  v-model="form.email"
                  type="email"
                  class="field__input"
                  required
                  autocomplete="email"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div class="field">
              <label class="field__label" for="password">Password</label>
              <div class="field__control">
                <span class="field__icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="password"
                  v-model="form.password"
                  type="password"
                  class="field__input"
                  required
                  autocomplete="current-password"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div v-if="error" class="alert" role="alert">
              <span class="alert__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
                  <path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </span>
              <span class="alert__text">{{ error }}</span>
            </div>

            <button type="submit" class="btn-submit" :disabled="loading">
              <span v-if="loading" class="btn-submit__spinner" aria-hidden="true" />
              <span>{{ loading ? 'Signing in…' : 'Sign in' }}</span>
            </button>
          </form>
        </div>

        <p class="login-page__fineprint">© {{ year }} Team Management System</p>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../composables/useAuth';

const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const error = ref('');

const year = computed(() => new Date().getFullYear());

const form = ref({
  email: '',
  password: ''
});

const handleSubmit = async () => {
  loading.value = true;
  error.value = '';

  try {
    await authStore.login(form.value.email, form.value.password);
    router.push('/');
  } catch (err) {
    error.value = err.message || 'Login failed. Please check your credentials.';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: clamp(1rem, 4vw, 2rem);
  font-family: var(--font-family-base);
  color: var(--text-primary);
  overflow-x: hidden;
}

.login-page__ambient {
  position: fixed;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(ellipse 120% 80% at 100% 0%, rgba(91, 143, 212, 0.35) 0%, transparent 55%),
    radial-gradient(ellipse 90% 70% at 0% 100%, rgba(45, 106, 168, 0.32) 0%, transparent 50%),
    linear-gradient(
      158deg,
      #070f18 0%,
      #0c1929 22%,
      var(--color-primary-dark) 52%,
      #143d62 78%,
      #0a1624 100%
    );
  pointer-events: none;
}

.login-page__mesh {
  position: absolute;
  inset: 0;
  opacity: 0.4;
  background: radial-gradient(ellipse 100% 60% at 30% 20%, rgba(255, 255, 255, 0.06) 0%, transparent 50%),
    radial-gradient(ellipse 80% 50% at 80% 80%, rgba(255, 255, 255, 0.04) 0%, transparent 45%);
}

.login-page__vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 75% 60% at 50% 45%, transparent 0%, rgba(0, 0, 0, 0.35) 100%);
  pointer-events: none;
}

.login-page__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(88px);
  opacity: 0.5;
}

.login-page__orb--a {
  width: min(58vw, 480px);
  height: min(58vw, 480px);
  top: -14%;
  right: -10%;
  background: #5b9fe8;
}

.login-page__orb--b {
  width: min(48vw, 400px);
  height: min(48vw, 400px);
  bottom: -12%;
  left: -8%;
  background: #2d6aa8;
}

.login-page__orb--c {
  width: min(35vw, 300px);
  height: min(35vw, 300px);
  top: 38%;
  left: 32%;
  opacity: 0.22;
  background: #7dd3fc;
  filter: blur(100px);
}

.login-page__grid {
  position: absolute;
  inset: 0;
  opacity: 0.09;
  background-image: linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse 85% 75% at 48% 42%, black 18%, transparent 72%);
}

.login-page__shell {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 1140px;
  margin: auto;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  align-items: stretch;
  gap: clamp(2rem, 5vw, 3.5rem);
  min-height: min(640px, calc(100dvh - 2 * clamp(1rem, 4vw, 2rem)));
}

.login-page__hero {
  color: var(--text-inverse);
  display: flex;
  align-items: center;
  padding: clamp(0.5rem, 2vw, 1rem) 0;
  min-width: 0;
}

.login-page__hero-panel {
  width: 100%;
  max-width: 32.5rem;
  padding: clamp(1.5rem, 3.5vw, 2.25rem) clamp(1.5rem, 3.5vw, 2.5rem);
  border-radius: var(--radius-xl);
  background: linear-gradient(
    165deg,
    rgba(15, 23, 42, 0.5) 0%,
    rgba(30, 41, 59, 0.38) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.login-page__hero-inner {
  max-width: 100%;
}

/* Brand block: inner card uses same radius family as form (xl outer, lg mark). */
.login-brand--hero {
  display: flex;
  align-items: center;
  gap: clamp(14px, 3vw, 22px);
  line-height: 1.15;
  padding: clamp(1rem, 2.5vw, 1.25rem) clamp(1.1rem, 2.6vw, 1.4rem);
  border-radius: var(--radius-lg);
  background: rgba(15, 23, 42, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  margin-bottom: clamp(1.25rem, 3vw, 1.75rem);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.login-brand__mark {
  width: clamp(3.75rem, 8.5vw, 4.75rem);
  height: clamp(3.75rem, 8.5vw, 4.75rem);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, #154a7a 0%, #0f3558 100%);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(1.05rem, 2.4vw, 1.45rem);
  font-weight: 800;
  letter-spacing: 0.06em;
  flex-shrink: 0;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.login-brand__text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
  text-align: left;
}

.login-brand__text strong {
  color: #f8fbff;
  font-size: clamp(1.15rem, 2.8vw, 1.5rem);
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.login-brand__text span {
  color: #b8cce3;
  font-size: clamp(0.9rem, 2vw, 1.1rem);
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.login-page__hero-text {
  font-size: clamp(var(--font-size-base), 1.6vw, 1.0625rem);
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.82);
  margin: 0;
  max-width: 38em;
}

.login-page__main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-lg);
  padding: clamp(0.5rem, 2vw, 1rem) 0;
  min-width: 0;
}

.login-card {
  position: relative;
  width: 100%;
  max-width: 440px;
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  padding: clamp(2rem, 4.5vw, 2.5rem);
  box-shadow:
    0 28px 56px rgba(15, 23, 42, 0.22),
    0 0 0 1px rgba(255, 255, 255, 0.12) inset;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.login-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 1.5rem;
  right: 1.5rem;
  height: 3px;
  border-radius: 0 0 3px 3px;
  background: linear-gradient(90deg, var(--color-primary) 0%, #3b82f6 50%, var(--color-primary-dark) 100%);
  opacity: 0.85;
}

.login-card__head {
  margin-bottom: var(--spacing-xl);
  padding-top: 0.25rem;
}

.login-card__eyebrow {
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--color-primary);
  margin-bottom: 0.4rem;
}

.login-card__title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.02em;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.login-card__sub {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  line-height: var(--line-height-normal);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.field__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
}

.field__control {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0 var(--spacing-md);
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-lg);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.field__control:focus-within {
  border-color: var(--color-primary);
  box-shadow:
    0 0 0 3px var(--color-primary-soft),
    0 1px 3px rgba(15, 23, 42, 0.06);
}

.field__icon {
  display: flex;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.field__control:focus-within .field__icon {
  color: var(--color-primary);
}

.field__input {
  flex: 1;
  min-width: 0;
  padding: 0.75rem 0;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: var(--font-size-base);
  color: var(--text-primary);
}

.field__input::placeholder {
  color: var(--color-gray-400);
}

.field__input:focus {
  outline: none;
}

.alert {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
  color: var(--color-error);
  background: rgba(180, 35, 24, 0.08);
  border: 1px solid rgba(180, 35, 24, 0.22);
}

.alert__icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--color-error);
}

.alert__text {
  flex: 1;
}

.btn-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: 0.85rem 1.25rem;
  margin-top: var(--spacing-xs);
  font-family: inherit;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--text-inverse);
  background: linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  border: none;
  border-radius: var(--radius-lg);
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(30, 64, 175, 0.35);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast),
    opacity var(--transition-fast);
}

.btn-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.btn-submit:active:not(:disabled) {
  transform: translateY(0);
}

.btn-submit:disabled {
  opacity: 0.72;
  cursor: not-allowed;
  transform: none;
}

.btn-submit__spinner {
  width: 1.1rem;
  height: 1.1rem;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: var(--text-inverse);
  border-radius: 50%;
  animation: login-spin 0.65s linear infinite;
}

@keyframes login-spin {
  to {
    transform: rotate(360deg);
  }
}

.login-page__fineprint {
  font-size: var(--font-size-xs);
  color: rgba(255, 255, 255, 0.45);
  text-align: center;
}

@media (max-width: 900px) {
  .login-page__shell {
    grid-template-columns: 1fr;
    gap: var(--spacing-xl);
    min-height: unset;
  }

  .login-page__hero {
    text-align: center;
    padding: clamp(0.75rem, 2vw, 1rem);
    justify-content: center;
  }

  .login-page__hero-panel {
    max-width: 26rem;
    margin-left: auto;
    margin-right: auto;
  }

  .login-page__hero-inner {
    max-width: none;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .login-brand--hero {
    flex-direction: column;
    text-align: center;
    padding: clamp(1.1rem, 4vw, 1.35rem) clamp(1.25rem, 4vw, 1.5rem);
  }

  .login-brand__text {
    text-align: center;
    align-items: center;
  }

  .login-page__hero-text {
    margin-left: auto;
    margin-right: auto;
  }

}

@media (max-width: 480px) {
  .login-card {
    padding: var(--spacing-xl);
    border-radius: var(--radius-xl);
  }

  .login-card__title {
    font-size: var(--font-size-2xl);
  }
}
</style>
