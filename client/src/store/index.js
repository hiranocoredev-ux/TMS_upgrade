import { createStore } from 'vuex';
import auth from './modules/auth';
import projects from './modules/projects';
import jobTickets from './modules/jobTickets';

export default createStore({
  modules: {
    auth,
    projects,
    jobTickets
  }
});
