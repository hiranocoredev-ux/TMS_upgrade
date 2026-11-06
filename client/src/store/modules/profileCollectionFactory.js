/**
 * Builds a namespaced Vuex module for job / freelancer / personal profiles.
 * @param {object} api - service methods (fetchProfiles, getProfile, createProfile, ...)
 * @param {object} [defaultFilters]
 */
export function buildProfileCollectionModule(api, defaultFilters = {}) {
  const state = () => ({
    profiles: [],
    selectedProfile: null,
    loading: false,
    error: null,
    filters: {
      search: '',
      status: '',
      owner: '',
      ...defaultFilters
    }
  });

  const getters = {
    profiles: (s) => s.profiles,
    selectedProfile: (s) => s.selectedProfile,
    loading: (s) => s.loading,
    error: (s) => s.error,
    filters: (s) => s.filters,
    hasSelectedProfile: (s) => !!s.selectedProfile && Object.keys(s.selectedProfile).length > 0
  };

  const mutations = {
    SET_LOADING(s, v) {
      s.loading = v;
    },
    SET_ERROR(s, v) {
      s.error = v;
    },
    SET_PROFILES(s, profiles) {
      s.profiles = profiles;
    },
    SET_SELECTED_PROFILE(s, profile) {
      s.selectedProfile = profile;
    },
    CLEAR_SELECTED_PROFILE(s) {
      s.selectedProfile = null;
    },
    SET_SELECTED_PROFILE_PATCH(s, patch) {
      if (!s.selectedProfile) {
        s.selectedProfile = { ...patch };
        return;
      }
      s.selectedProfile = {
        ...s.selectedProfile,
        ...patch,
        pictureFileId: patch.pictureFileId ?? s.selectedProfile.pictureFileId,
        attachments: patch.attachments ?? s.selectedProfile.attachments
      };
    },
    UPDATE_PROFILE_IN_LIST(s, updatedProfile) {
      const id = updatedProfile._id || updatedProfile.id;
      const index = s.profiles.findIndex((p) => (p._id || p.id) === id);
      if (index !== -1) {
        s.profiles[index] = { ...s.profiles[index], ...updatedProfile };
      }
    },
    REMOVE_PROFILE_FROM_LIST(s, profileId) {
      s.profiles = s.profiles.filter((p) => (p._id || p.id) !== profileId);
    },
    SET_FILTERS(s, partial) {
      s.filters = { ...s.filters, ...partial };
    }
  };

  const actions = {
    async fetchProfiles({ commit, state }) {
      commit('SET_LOADING', true);
      commit('SET_ERROR', null);
      try {
        const query = { limit: 1000, ...state.filters };
        const response = await api.fetchProfiles(query);
        if (response.ok && response.data) {
          commit('SET_PROFILES', response.data.profiles || []);
          return { ok: true, data: response.data };
        }
        const msg = response.message || 'Failed to load profiles';
        commit('SET_ERROR', msg);
        return { ok: false, message: msg };
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to load profiles';
        commit('SET_ERROR', msg);
        return { ok: false, message: msg };
      } finally {
        commit('SET_LOADING', false);
      }
    },

    async fetchProfile({ commit }, profileId) {
      commit('SET_LOADING', true);
      commit('SET_ERROR', null);
      try {
        const response = await api.getProfile(profileId);
        if (response.ok && response.data?.profile) {
          commit('SET_SELECTED_PROFILE', response.data.profile);
          return { ok: true, data: response.data };
        }
        const msg = response.message || 'Failed to load profile';
        commit('SET_ERROR', msg);
        return { ok: false, message: msg };
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to load profile';
        commit('SET_ERROR', msg);
        return { ok: false, message: msg };
      } finally {
        commit('SET_LOADING', false);
      }
    },

    async createProfile({ commit, dispatch }, profileData) {
      commit('SET_LOADING', true);
      commit('SET_ERROR', null);
      try {
        const response = await api.createProfile(profileData);
        if (response.ok && response.data?.profile) {
          await dispatch('fetchProfiles');
          return { ok: true, data: response.data };
        }
        const msg = response.message || 'Failed to create profile';
        commit('SET_ERROR', msg);
        return { ok: false, message: msg };
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to create profile';
        commit('SET_ERROR', msg);
        return { ok: false, message: msg };
      } finally {
        commit('SET_LOADING', false);
      }
    },

    async updateProfile({ commit, state }, { profileId, profileData }) {
      commit('SET_LOADING', true);
      commit('SET_ERROR', null);
      try {
        const response = await api.updateProfile(profileId, profileData);
        if (response.ok) {
          const updatedProfile = response.data.profile || response.data.data?.profile;
          if (updatedProfile) {
            commit('UPDATE_PROFILE_IN_LIST', updatedProfile);
          }
          const sel = state.selectedProfile;
          if (sel && (sel._id || sel.id) === profileId) {
            commit('SET_SELECTED_PROFILE_PATCH', updatedProfile || profileData);
          }
          return { ok: true, data: response.data };
        }
        const msg = response.message || 'Failed to update profile';
        commit('SET_ERROR', msg);
        return { ok: false, message: msg };
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to update profile';
        commit('SET_ERROR', msg);
        return { ok: false, message: msg };
      } finally {
        commit('SET_LOADING', false);
      }
    },

    async deleteProfile({ commit, state }, profileId) {
      commit('SET_LOADING', true);
      commit('SET_ERROR', null);
      try {
        const response = await api.deleteProfile(profileId);
        if (response.ok) {
          commit('REMOVE_PROFILE_FROM_LIST', profileId);
          const sel = state.selectedProfile;
          if (sel && (sel._id || sel.id) === profileId) {
            commit('CLEAR_SELECTED_PROFILE');
          }
          return { ok: true };
        }
        const msg = response.message || 'Failed to delete profile';
        commit('SET_ERROR', msg);
        return { ok: false, message: msg };
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to delete profile';
        commit('SET_ERROR', msg);
        return { ok: false, message: msg };
      } finally {
        commit('SET_LOADING', false);
      }
    },

    async uploadProfilePicture({ commit, state }, { profileId, pictureFile }) {
      commit('SET_LOADING', true);
      commit('SET_ERROR', null);
      try {
        const response = await api.uploadProfilePicture(profileId, pictureFile);
        if (response.ok) {
          const updatedProfile = response.data.profile || response.data.data?.profile;
          if (updatedProfile) {
            commit('SET_SELECTED_PROFILE_PATCH', updatedProfile);
            commit('UPDATE_PROFILE_IN_LIST', updatedProfile);
          }
          return { ok: true, data: response.data };
        }
        const msg = response.message || 'Failed to upload picture';
        commit('SET_ERROR', msg);
        return { ok: false, message: msg };
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to upload picture';
        commit('SET_ERROR', msg);
        return { ok: false, message: msg };
      } finally {
        commit('SET_LOADING', false);
      }
    },

    async uploadAttachments({ commit, state }, { profileId, files }) {
      commit('SET_LOADING', true);
      commit('SET_ERROR', null);
      try {
        const response =
          files.length > 1
            ? await api.uploadAttachments(profileId, files)
            : await api.uploadAttachment(profileId, files[0]);
        if (response.ok) {
          const updatedProfile = response.data.profile || response.data.data?.profile;
          if (updatedProfile) {
            commit('SET_SELECTED_PROFILE_PATCH', updatedProfile);
            commit('UPDATE_PROFILE_IN_LIST', updatedProfile);
          }
          return { ok: true, data: response.data };
        }
        const msg = response.message || 'Failed to upload attachments';
        commit('SET_ERROR', msg);
        return { ok: false, message: msg };
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to upload attachments';
        commit('SET_ERROR', msg);
        return { ok: false, message: msg };
      } finally {
        commit('SET_LOADING', false);
      }
    },

    async deleteAttachment({ commit, state }, { profileId, fileId }) {
      commit('SET_LOADING', true);
      commit('SET_ERROR', null);
      try {
        const response = await api.deleteAttachment(profileId, fileId);
        if (response.ok) {
          const updatedProfile = response.data.profile || response.data.data?.profile;
          if (updatedProfile) {
            commit('SET_SELECTED_PROFILE_PATCH', updatedProfile);
            commit('UPDATE_PROFILE_IN_LIST', updatedProfile);
          }
          return { ok: true, data: response.data };
        }
        const msg = response.message || 'Failed to delete attachment';
        commit('SET_ERROR', msg);
        return { ok: false, message: msg };
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to delete attachment';
        commit('SET_ERROR', msg);
        return { ok: false, message: msg };
      } finally {
        commit('SET_LOADING', false);
      }
    },

    setFilters({ commit }, partial) {
      commit('SET_FILTERS', partial);
    },

    selectProfile({ commit }, profile) {
      commit('SET_SELECTED_PROFILE', profile);
    },

    clearSelectedProfile({ commit }) {
      commit('CLEAR_SELECTED_PROFILE');
    }
  };

  return {
    namespaced: true,
    state,
    getters,
    mutations,
    actions
  };
}
