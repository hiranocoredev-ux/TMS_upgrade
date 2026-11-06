import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import Toast from 'vue-toastification';
import CKEditor from '@ckeditor/ckeditor5-vue';
import 'vue-toastification/dist/index.css';
import { initThemeAppearance } from './composables/useThemeAppearance';

initThemeAppearance();

const app = createApp(App);
app.use(CKEditor);
app.use(store);
app.use(router);

app.use(Toast, {
  transition: 'Vue-Toastification__bounce',
  maxToasts: 5,
  newestOnTop: true,
  position: 'top-right',
  timeout: 5000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: 'button',
  icon: true,
  rtl: false
});

store.dispatch('auth/restoreAuth');
app.mount('#app');
