import * as projectService from '../../services/projects';

export default {
  namespaced: true,

  state: () => ({
    projects: [],
    currentProject: null,
    loading: false,
    error: null,
    pagination: {
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 0
    }
  }),

  getters: {
    projects: (s) => s.projects,
    currentProject: (s) => s.currentProject,
    loading: (s) => s.loading,
    error: (s) => s.error,
    pagination: (s) => s.pagination,

    projectsByStatus: (s) => {
      const grouped = { active: [], paused: [], done: [] };
      s.projects.forEach((project) => {
        if (grouped[project.status]) {
          grouped[project.status].push(project);
        }
      });
      return grouped;
    },

    activeProjects: (state, getters) => getters.projectsByStatus.active,
    pausedProjects: (state, getters) => getters.projectsByStatus.paused,
    completedProjects: (state, getters) => getters.projectsByStatus.done,

    projectById: (s) => (id) => s.projects.find((p) => p._id === id),

    projectsByOwner: (s) => (userId) => s.projects.filter((p) => p.ownerUserId === userId),

    projectsByCollaborator: (s) => (userId) =>
      s.projects.filter((p) => p.collaboratorUserIds && p.collaboratorUserIds.includes(userId))
  },

  mutations: {
    SET_LOADING(s, v) {
      s.loading = v;
    },
    SET_ERROR(s, v) {
      s.error = v;
    },
    SET_PROJECTS(s, projects) {
      s.projects = projects;
    },
    SET_CURRENT_PROJECT(s, project) {
      s.currentProject = project;
    },
    SET_PAGINATION(s, pagination) {
      s.pagination = pagination;
    },
    UPSERT_PROJECT(s, project) {
      const index = s.projects.findIndex((p) => p._id === project._id);
      if (index !== -1) {
        s.projects.splice(index, 1, project);
      } else {
        s.projects.push(project);
      }
    },
    REMOVE_PROJECT(s, id) {
      s.projects = s.projects.filter((p) => p._id !== id);
      if (s.currentProject && s.currentProject._id === id) {
        s.currentProject = null;
      }
    },
    CLEAR_ERROR(s) {
      s.error = null;
    }
  },

  actions: {
    async fetchProjects({ commit }, filters = {}) {
      commit('SET_LOADING', true);
      commit('SET_ERROR', null);
      try {
        const response = await projectService.fetchProjects(filters);
        if (response.ok && response.data) {
          commit('SET_PROJECTS', response.data.projects || []);
          if (response.data.pagination) {
            commit('SET_PAGINATION', response.data.pagination);
          }
        } else {
          throw new Error(response.message || 'Failed to fetch projects');
        }
      } catch (err) {
        commit('SET_ERROR', err.response?.data?.message || err.message || 'Failed to fetch projects');
        commit('SET_PROJECTS', []);
        throw err;
      } finally {
        commit('SET_LOADING', false);
      }
    },

    async fetchProject({ commit, state }, id) {
      commit('SET_LOADING', true);
      commit('SET_ERROR', null);
      try {
        const response = await projectService.getProject(id);
        if (response.ok && response.data) {
          commit('SET_CURRENT_PROJECT', response.data.project);
          commit('UPSERT_PROJECT', response.data.project);
          return response.data.project;
        }
        throw new Error(response.message || 'Failed to fetch project');
      } catch (err) {
        commit('SET_ERROR', err.response?.data?.message || err.message || 'Failed to fetch project');
        throw err;
      } finally {
        commit('SET_LOADING', false);
      }
    },

    async createProject({ commit }, projectData) {
      commit('SET_LOADING', true);
      commit('SET_ERROR', null);
      try {
        const response = await projectService.createProject(projectData);
        if (response.ok && response.data) {
          commit('UPSERT_PROJECT', response.data.project);
          commit('SET_CURRENT_PROJECT', response.data.project);
          return response.data.project;
        }
        throw new Error(response.message || 'Failed to create project');
      } catch (err) {
        commit('SET_ERROR', err.response?.data?.message || err.message || 'Failed to create project');
        throw err;
      } finally {
        commit('SET_LOADING', false);
      }
    },

    async updateProject({ commit, state }, { id, projectData }) {
      commit('SET_LOADING', true);
      commit('SET_ERROR', null);
      try {
        const response = await projectService.updateProject(id, projectData);
        if (response.ok && response.data) {
          commit('UPSERT_PROJECT', response.data.project);
          if (state.currentProject && state.currentProject._id === id) {
            commit('SET_CURRENT_PROJECT', response.data.project);
          }
          return response.data.project;
        }
        throw new Error(response.message || 'Failed to update project');
      } catch (err) {
        commit('SET_ERROR', err.response?.data?.message || err.message || 'Failed to update project');
        throw err;
      } finally {
        commit('SET_LOADING', false);
      }
    },

    async deleteProject({ commit, state }, id) {
      commit('SET_LOADING', true);
      commit('SET_ERROR', null);
      try {
        const response = await projectService.deleteProject(id);
        if (response.ok) {
          commit('REMOVE_PROJECT', id);
          return true;
        }
        throw new Error(response.message || 'Failed to delete project');
      } catch (err) {
        commit('SET_ERROR', err.response?.data?.message || err.message || 'Failed to delete project');
        throw err;
      } finally {
        commit('SET_LOADING', false);
      }
    },

    setCurrentProject({ commit }, project) {
      commit('SET_CURRENT_PROJECT', project);
    },

    clearCurrentProject({ commit }) {
      commit('SET_CURRENT_PROJECT', null);
    },

    clearError({ commit }) {
      commit('CLEAR_ERROR');
    }
  }
};
