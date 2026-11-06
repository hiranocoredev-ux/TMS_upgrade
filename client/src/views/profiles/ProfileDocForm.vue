<template>
  <div class="pf-page">
    <!-- ========== STICKY TOP BAR ========== -->
    <header class="pf-bar pf-bar--top">
      <div class="pf-bar__inner">
        <router-link :to="backRoute" class="pf-bar__back" aria-label="Back">
          <span aria-hidden="true">←</span>
          <span class="pf-bar__back-label">{{ isEdit ? 'Back to profile' : 'All profiles' }}</span>
        </router-link>
        <div class="pf-bar__spacer"></div>
        <div class="pf-bar__actions">
          <button type="button" class="btn btn--ghost" @click="goBack">Cancel</button>
          <button type="button" class="btn btn--primary" :disabled="saving" @click="onSubmit">
            {{ saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create profile') }}
          </button>
        </div>
      </div>
    </header>

    <main class="pf-canvas">
      <div v-if="loading" class="pf-state">Loading…</div>
      <div v-else-if="loadError" class="pf-state pf-state--error">{{ loadError }}</div>
      <div v-else-if="isEdit && !permissions.canEditAny" class="pf-state pf-state--error">
        You don't have permission to edit any part of this profile.
      </div>
      <div v-else-if="!isEdit && !permissions.canCreate" class="pf-state pf-state--error">
        You don't have permission to create profiles. Only Super Admin, Group Boss, or
        hunting-profile team members can create client profiles.
      </div>

      <form v-else class="pf-form" @submit.prevent="onSubmit">
        <!-- ========== HERO ========== -->
        <section class="pf-hero">
          <div class="pf-hero__avatar">
            <img v-if="avatarPreviewUrl" :src="avatarPreviewUrl" :alt="form.name || 'avatar'" />
            <span v-else class="pf-hero__avatar-fallback">{{ initials(form.name) }}</span>
            <label v-if="canEditBase" class="pf-hero__avatar-edit" title="Upload avatar">
              <input type="file" accept="image/*" @change="onPictureChange" hidden />
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </label>
          </div>
          <div class="pf-hero__main">
            <div class="pf-eyebrow">{{ isEdit ? 'Editing' : 'New' }} client profile</div>
            <div class="pf-hero__name-field">
              <label class="pf-hero__name-label">Profile name *</label>
              <input
                v-model="form.name"
                class="pf-hero__name"
                type="text"
                required
                placeholder="Enter client or company name…"
                :disabled="!canEditBase"
              />
            </div>
            <div class="pf-hero__selects">
              <label class="pf-pill-select" :class="`pf-pill-select--status-${form.status}`">
                <span class="pf-pill-select__label">Status</span>
                <select v-model="form.status" :disabled="!canEditBase">
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <small v-if="pictureFile" class="pf-hero__hint">
                New avatar selected · uploads on save
              </small>
            </div>
          </div>
        </section>

        <!-- ========== BASE INFORMATION ========== -->
        <section v-if="canEditBase" class="pf-card">
          <header class="pf-card__head">
            <div class="pf-card__icon pf-card__icon--blue">🪪</div>
            <div class="pf-card__title">
              <h2>Base Information</h2>
              <p>Identity, location, work role state and finances.</p>
            </div>
          </header>
          <div class="pf-card__body">
            <div class="pf-grid pf-grid--3">
              <div class="pf-field">
                <label>Country</label>
                <select v-model="form.countryCode">
                  <option value="">—</option>
                  <option v-for="c in COUNTRIES" :key="c.code" :value="c.code">
                    {{ countryFlag(c.code) }} {{ c.name }}
                  </option>
                </select>
              </div>
              <div class="pf-field">
                <label>Age</label>
                <input v-model.number="form.age" type="number" min="0" max="150" placeholder="—" />
              </div>
              <div class="pf-field">
                <label>Sex</label>
                <select v-model="form.sex">
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div class="pf-field">
              <label>Address</label>
              <textarea v-model="form.address" rows="2" placeholder="Street, city, state, postal code"></textarea>
            </div>

            <div class="pf-divider"></div>

            <div class="pf-field">
              <label>Status score <span class="pf-label-hint">click a star · 0–5</span></label>
              <div class="pf-stars">
                <button
                  v-for="n in 5"
                  :key="n"
                  type="button"
                  class="pf-star"
                  :class="{ 'pf-star--on': displayedScore(n), 'pf-star--hover': hoverScore && n <= hoverScore }"
                  :aria-label="`${n} star${n > 1 ? 's' : ''}`"
                  @click="setScore(n)"
                  @mouseenter="hoverScore = n"
                  @mouseleave="hoverScore = 0"
                >★</button>
                <span class="pf-stars__value">{{ form.statusScore || 0 }} / 5</span>
                <button
                  v-if="form.statusScore > 0"
                  type="button"
                  class="pf-stars__clear"
                  @click="form.statusScore = 0"
                >Clear</button>
              </div>
            </div>

            <div class="pf-field">
              <label>Work role state <span class="pf-label-hint">multi-select · each opens a tab below</span></label>
              <div class="pf-chips">
                <button
                  v-for="wr in PROFILE_WORK_ROLE_VALUES"
                  :key="wr"
                  type="button"
                  class="pf-chip"
                  :class="{ 'pf-chip--on': form.workingRoles.includes(wr) }"
                  @click="toggleWorkingRole(wr)"
                >
                  <span class="pf-chip__icon">{{ WORKING_ROLE_ICONS[wr] }}</span>
                  <span>{{ WORKING_ROLE_LABELS[wr] }}</span>
                  <span class="pf-chip__check" v-if="form.workingRoles.includes(wr)">✓</span>
                </button>
              </div>
            </div>

            <div class="pf-divider"></div>

            <!-- Read-only computed totals (USD) -->
            <div class="pf-grid pf-grid--3">
              <div class="pf-field">
                <label>Total incoming <span class="pf-label-hint">computed</span></label>
                <div class="pf-stat pf-stat--readonly">
                  <span class="pf-stat__sym">$</span>
                  <span class="pf-stat__value">{{ fmtAmount(computedTotals.incoming) }}</span>
                </div>
              </div>
              <div class="pf-field">
                <label>Total given <span class="pf-label-hint">computed</span></label>
                <div class="pf-stat pf-stat--readonly">
                  <span class="pf-stat__sym">$</span>
                  <span class="pf-stat__value">{{ fmtAmount(computedTotals.given) }}</span>
                </div>
              </div>
              <div class="pf-field">
                <label>Total profit <span class="pf-label-hint">computed</span></label>
                <div class="pf-stat pf-stat--readonly pf-stat--profit">
                  <span class="pf-stat__sym">$</span>
                  <span class="pf-stat__value">{{ fmtAmount(computedTotals.profit) }}</span>
                </div>
              </div>
            </div>
            <small class="pf-hint pf-hint--muted">
              Totals are summed from per-tab transactions. Use the Transactions section inside each
              Working Role tab (below) to record income — `given` and `profit` are derived from
              the Client share % in Contract Information.
            </small>

            <div class="pf-divider"></div>

            <div class="pf-grid pf-grid--2">
              <div class="pf-field">
                <label>
                  Profile owner
                  <span class="pf-label-hint">hunting-profile members only</span>
                </label>
                <select v-if="canEditBase" v-model="form.ownerUserId">
                  <option value="">— Select owner —</option>
                  <option v-for="u in huntingProfileUsers" :key="u.id" :value="u.id">
                    {{ u.name }} · {{ u.email }}
                  </option>
                </select>
                <div v-else class="pf-readonly">
                  <div class="pf-readonly__avatar">{{ initials(ownerLabel?.name) }}</div>
                  <div class="pf-readonly__id">
                    <strong>{{ ownerLabel ? ownerLabel.name : '—' }}</strong>
                    <span class="pf-muted">{{ ownerLabel ? ownerLabel.email : '' }}</span>
                  </div>
                </div>
                <small v-if="canEditBase && !huntingProfileUsers.length" class="pf-hint pf-hint--muted">
                  No members carry the Hunting Profile working role yet — assign it in Admin → Users first.
                </small>
              </div>
              <div class="pf-field">
                <label>Hunting owner</label>
                <div class="pf-readonly">
                  <div class="pf-readonly__avatar">
                    {{ huntingOwnerLabel ? initials(huntingOwnerLabel.name) : initials(authStore.user?.name) }}
                  </div>
                  <div class="pf-readonly__id">
                    <strong>
                      {{ huntingOwnerLabel ? huntingOwnerLabel.name : (isEdit ? '—' : (authStore.user?.name || 'You')) }}
                    </strong>
                    <span class="pf-muted">
                      {{ huntingOwnerLabel ? huntingOwnerLabel.email : (isEdit ? '' : (authStore.user?.email || '')) }}
                    </span>
                  </div>
                  <span class="pf-lock-tag">🔒 immutable</span>
                </div>
              </div>
              <div class="pf-field">
                <label>Call support</label>
                <div class="pf-toggle-card" :class="{ 'pf-toggle-card--on': form.callSupportEnabled }">
                  <label class="pf-switch">
                    <input v-model="form.callSupportEnabled" type="checkbox" />
                    <span class="pf-switch__track"><span class="pf-switch__thumb"></span></span>
                    <span class="pf-switch__label">{{ form.callSupportEnabled ? 'Enabled' : 'Disabled' }}</span>
                  </label>
                  <select
                    v-if="form.callSupportEnabled"
                    v-model="form.callerUserId"
                    class="pf-toggle-card__select"
                  >
                    <option value="">— Select caller —</option>
                    <option v-for="u in users" :key="u.id" :value="u.id">
                      {{ u.name }} · {{ u.email }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div class="pf-field">
              <label>Comment</label>
              <textarea v-model="form.comment" rows="3" placeholder="Notes, context, anything internal teams should know"></textarea>
            </div>
          </div>
        </section>

        <!-- ========== CONTACT INFORMATION ========== -->
        <section v-if="canEditContact" class="pf-card">
          <header class="pf-card__head">
            <div class="pf-card__icon pf-card__icon--violet">📞</div>
            <div class="pf-card__title">
              <h2>Contact Information</h2>
              <p>Channels we use to reach this client.</p>
            </div>
            <span class="pf-badge pf-badge--private">Private</span>
          </header>
          <div class="pf-card__body">
            <div class="pf-grid pf-grid--2">
              <div class="pf-field">
                <label>Email</label>
                <input v-model="form.email" type="email" placeholder="contact@example.com" />
              </div>
              <div class="pf-field">
                <label>Phone</label>
                <input v-model="form.phone" type="tel" placeholder="+1 555 0100" />
              </div>
            </div>
            <div class="pf-grid pf-grid--3">
              <div class="pf-field">
                <label>LinkedIn</label>
                <input v-model="form.linkedinUrl" type="url" placeholder="https://linkedin.com/in/…" />
              </div>
              <div class="pf-field">
                <label>GitHub</label>
                <input v-model="form.githubUrl" type="url" placeholder="https://github.com/…" />
              </div>
              <div class="pf-field">
                <label>Website</label>
                <input v-model="form.websiteUrl" type="url" placeholder="https://…" />
              </div>
            </div>

            <div class="pf-divider"></div>

            <div class="pf-handles">
              <header class="pf-sub__head">
                <h4>Messaging handles</h4>
                <button type="button" class="btn btn--ghost btn--xs" @click="addHandle">+ Add handle</button>
              </header>
              <div
                v-for="(h, i) in form.contactHandles"
                :key="`h-${i}`"
                class="handle"
              >
                <span
                  class="handle__icon"
                  :style="CONTACT_HANDLE_ICON_URLS[h.platform]
                    ? { background: '#fff', border: `1px solid var(--pf-border)` }
                    : { background: CONTACT_HANDLE_ACCENTS[h.platform] || CONTACT_HANDLE_ACCENTS.custom }"
                  :title="CONTACT_HANDLE_LABELS[h.platform] || h.platform"
                >
                  <img
                    v-if="CONTACT_HANDLE_ICON_URLS[h.platform]"
                    :src="CONTACT_HANDLE_ICON_URLS[h.platform]"
                    :alt="CONTACT_HANDLE_LABELS[h.platform] || h.platform"
                  />
                  <span v-else>{{ CONTACT_HANDLE_ICONS[h.platform] || CONTACT_HANDLE_ICONS.custom }}</span>
                </span>
                <div class="handle__platform">
                  <label>Platform</label>
                  <select v-model="h.platform">
                    <option v-for="p in CONTACT_HANDLE_PLATFORMS" :key="p" :value="p">
                      {{ CONTACT_HANDLE_LABELS[p] || p }}
                    </option>
                  </select>
                </div>
                <div v-if="h.platform === 'custom'" class="handle__label">
                  <label>Custom label</label>
                  <input v-model="h.customLabel" type="text" placeholder="e.g. Threema" />
                </div>
                <div class="handle__handle">
                  <label>Handle</label>
                  <input v-model="h.handle" type="text" :placeholder="`@user / link / id…`" />
                </div>
                <button
                  type="button"
                  class="handle__remove"
                  @click="form.contactHandles.splice(i, 1)"
                  :aria-label="`Remove ${CONTACT_HANDLE_LABELS[h.platform] || 'handle'}`"
                  title="Remove handle"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                  </svg>
                </button>
              </div>
              <p v-if="!form.contactHandles.length" class="pf-empty">No handles yet — click <strong>+ Add handle</strong> to add one.</p>
            </div>
          </div>
        </section>

        <!-- ========== CONTRACT INFORMATION ========== -->
        <section v-if="canEditContract" class="pf-card">
          <header class="pf-card__head">
            <div class="pf-card__icon pf-card__icon--green">📑</div>
            <div class="pf-card__title">
              <h2>Contract Information</h2>
              <p>How revenue is shared with the client and within the team.</p>
            </div>
            <span class="pf-badge pf-badge--private">Private</span>
          </header>
          <div class="pf-card__body">
            <div class="pf-grid pf-grid--2">
              <div class="pf-field">
                <label>Client share</label>
                <div class="pf-pct">
                  <input v-model.number="form.clientSharePercent" type="number" min="0" max="100" step="0.1" />
                  <span class="pf-pct__sym">%</span>
                </div>
                <small class="pf-hint">Portion of income paid to / kept by the client.</small>
              </div>
              <div class="pf-field">
                <label>Internal hiring split</label>
                <div class="pf-pct">
                  <input v-model.number="form.internalHiringSharePercent" type="number" min="0" max="100" step="0.1" />
                  <span class="pf-pct__sym">%</span>
                </div>
                <small class="pf-hint">Portion redistributed internally to hiring teams.</small>
              </div>
            </div>
          </div>
        </section>

        <!-- ========== WORKING ROLE TABS ========== -->
        <section v-if="editableTabs.length" class="pf-card pf-card--tabs">
          <header class="pf-card__head">
            <div class="pf-card__icon pf-card__icon--amber">🤝</div>
            <div class="pf-card__title">
              <h2>Working Roles</h2>
              <p>Devices, manager group, and income transactions per role.</p>
            </div>
          </header>

          <nav class="pf-tabs" role="tablist">
            <button
              v-for="role in editableTabs"
              :key="role"
              type="button"
              class="pf-tab"
              :class="{ 'pf-tab--active': activeTabRole === role }"
              :aria-selected="activeTabRole === role"
              role="tab"
              @click="activeTabRole = role"
            >
              <span class="pf-tab__icon">{{ WORKING_ROLE_ICONS[role] }}</span>
              <span>{{ WORKING_ROLE_LABELS[role] }}</span>
            </button>
          </nav>

          <div v-if="activeTabRole" class="pf-tab__panel">
            <!-- ===== TAB META ===== -->
            <div class="pf-grid pf-grid--2">
              <div class="pf-field">
                <label>Start time <span class="pf-label-hint">when work on this role began</span></label>
                <input
                  v-model="currentTabStartedAt"
                  type="date"
                  :disabled="!canEditCurrentTab"
                />
              </div>
            </div>

            <div class="pf-divider"></div>

            <!-- ===== DEVICES (redesigned) ===== -->
            <div class="pf-sub">
              <header class="pf-sub__head">
                <h3>💻 Devices</h3>
                <div class="pf-sub__actions">
                  <button
                    v-if="isEdit && currentTabHasAnyStored && !revealed[activeTabRole]"
                    type="button"
                    class="btn btn--reveal btn--xs"
                    :disabled="revealing"
                    @click="revealActiveTab"
                  >
                    {{ revealing ? 'Revealing…' : '🔓 Reveal credentials' }}
                  </button>
                  <button type="button" class="btn btn--primary btn--xs" @click="addDevice(activeTabRole)">+ Add device</button>
                </div>
              </header>

              <p v-if="isEdit && currentTabHasStoredRemote && !revealed[activeTabRole]" class="pf-callout">
                {{ currentTabStoredCount }} device(s) hold stored remote credentials.
                Reveal to edit them; new entries can be added without revealing.
              </p>

              <article
                v-for="(d, i) in currentTabDevices"
                :key="`dev-${i}`"
                class="device"
              >
                <header class="device__head">
                  <span class="device__index">Device #{{ i + 1 }}</span>
                  <button
                    type="button"
                    class="device__remove"
                    @click="currentTabDevices.splice(i, 1)"
                    aria-label="Remove device"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                    </svg>
                  </button>
                </header>

                <div class="device__body">
                  <!-- Row 1: Device name + price/currency combined -->
                  <div class="device__row device__row--name">
                    <div class="pf-field device__name">
                      <label>Device name</label>
                      <input v-model="d.detail" type="text" placeholder="e.g. Lenovo X1 Carbon, 2023" />
                    </div>
                    <div class="pf-field device__price">
                      <label>Price</label>
                      <div class="pf-money">
                        <span class="pf-money__sym">$</span>
                        <input v-model.number="d.price" type="number" min="0" step="0.01" placeholder="0.00" />
                      </div>
                    </div>
                  </div>

                  <!-- Row 2: Bought by (segmented) + conditional team member -->
                  <div class="device__row device__row--buyer">
                    <div class="pf-field device__buyer-type">
                      <label>Bought by</label>
                      <div class="pf-seg">
                        <label class="pf-seg__opt" :class="{ 'pf-seg__opt--on': d.buyerType === 'client' }">
                          <input type="radio" :value="'client'" v-model="d.buyerType" />
                          <span class="pf-seg__icon">🏢</span>
                          <span>Client</span>
                        </label>
                        <label class="pf-seg__opt" :class="{ 'pf-seg__opt--on': d.buyerType === 'user' }">
                          <input type="radio" :value="'user'" v-model="d.buyerType" />
                          <span class="pf-seg__icon">👤</span>
                          <span>Team member</span>
                        </label>
                      </div>
                    </div>
                    <div v-if="d.buyerType === 'user'" class="pf-field device__buyer-user">
                      <label>Team member</label>
                      <select v-model="d.buyerUserId">
                        <option value="">— Select team member —</option>
                        <option v-for="u in users" :key="u.id" :value="u.id">
                          {{ u.name }} · {{ u.email }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <!-- Remote access (collapsible card) -->
                  <div class="device__remote" :class="{ 'device__remote--on': d.remoteEnabled }">
                    <header class="device__remote-head">
                      <label class="pf-switch">
                        <input type="checkbox" v-model="d.remoteEnabled" />
                        <span class="pf-switch__track"><span class="pf-switch__thumb"></span></span>
                      </label>
                      <div class="device__remote-title">
                        <strong>Remote access</strong>
                        <span class="device__remote-sub">
                          {{ d.remoteEnabled ? 'Credentials encrypted at rest' : 'Disabled — turn on to add tool & login' }}
                        </span>
                      </div>
                      <span class="pf-lock-tag">🔒 encrypted</span>
                    </header>

                    <div v-if="d.remoteEnabled" class="device__remote-body">
                      <div class="pf-grid pf-grid--3">
                        <div class="pf-field">
                          <label>Tool</label>
                          <select v-model="d.remoteTool">
                            <option v-for="rt in REMOTE_TOOLS" :key="rt" :value="rt">
                              {{ REMOTE_TOOL_ICONS[rt] }} {{ REMOTE_TOOL_LABELS[rt] }}
                            </option>
                          </select>
                        </div>
                        <div v-if="d.remoteTool === 'custom'" class="pf-field">
                          <label>Tool name</label>
                          <input v-model="d.remoteToolCustomName" type="text" placeholder="e.g. TeamViewer" />
                        </div>
                        <div class="pf-field" :class="{ 'pf-field--span2': d.remoteTool !== 'custom' }">
                          <label>Remote ID</label>
                          <input
                            v-model="d.remoteId"
                            type="text"
                            autocomplete="off"
                            :disabled="d._existing && !revealed[activeTabRole]"
                            :placeholder="d._existing && !revealed[activeTabRole] ? '•••• stored. Reveal to edit.' : ''"
                          />
                        </div>
                        <div class="pf-field">
                          <label>Remote password</label>
                          <input
                            v-model="d.remotePassword"
                            :type="(!d._existing || revealed[activeTabRole]) ? 'text' : 'password'"
                            autocomplete="new-password"
                            :disabled="d._existing && !revealed[activeTabRole]"
                            :placeholder="d._existing && !revealed[activeTabRole] ? '•••• stored' : ''"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Notes -->
                  <div class="pf-field">
                    <label>Notes <span class="pf-label-hint">non-sensitive</span></label>
                    <input v-model="d.notes" type="text" placeholder="Notes about this device" />
                  </div>
                </div>
              </article>

              <p v-if="!currentTabDevices.length" class="pf-empty">No devices in this tab yet — click <strong>+ Add device</strong>.</p>
            </div>

            <div class="pf-divider"></div>

            <!-- ===== PLATFORM CREDENTIALS ===== -->
            <div class="pf-sub">
              <header class="pf-sub__head">
                <h3>🔑 Platform Credentials <span class="pf-label-hint">per-credential member ACL</span></h3>
                <button
                  v-if="canEditCurrentTab"
                  type="button"
                  class="btn btn--primary btn--xs"
                  @click="addPlatformCredential(activeTabRole)"
                >+ Add credential</button>
              </header>

              <div class="pf-creds">
                <article
                  v-for="(c, i) in currentTabPlatformCreds"
                  :key="`cred-${i}`"
                  class="cred"
                >
                  <header class="cred__head">
                    <span class="cred__icon">🔑</span>
                    <div class="cred__title">
                      <strong>{{ c.platform || `Credential #${i + 1}` }}</strong>
                      <span>{{ c.hint || 'Platform login (gmail + password, encrypted)' }}</span>
                    </div>
                    <span
                      class="cred-status"
                      :style="credStatusStyle(c.status)"
                    >{{ PLATFORM_CREDENTIAL_STATUS_LABELS[c.status || DEFAULT_PLATFORM_CREDENTIAL_STATUS] }}</span>
                    <button
                      v-if="canEditCurrentTab"
                      type="button"
                      class="cred__remove"
                      @click="currentTabPlatformCreds.splice(i, 1)"
                      aria-label="Remove credential"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                      </svg>
                    </button>
                  </header>

                  <div class="cred__body">
                    <div class="pf-grid pf-grid--2">
                      <div class="pf-field">
                        <label>Platform name</label>
                        <input
                          v-model="c.platform"
                          type="text"
                          placeholder="e.g. Upwork, Fiverr, Toptal"
                          :disabled="!canEditCurrentTab"
                        />
                      </div>
                      <div class="pf-field">
                        <label>Public hint <span class="pf-label-hint">visible to all viewers</span></label>
                        <input
                          v-model="c.hint"
                          type="text"
                          placeholder="e.g. @user_xx · main account"
                          :disabled="!canEditCurrentTab"
                        />
                      </div>
                      <div class="pf-field">
                        <label>Status <span class="pf-label-hint">account lifecycle</span></label>
                        <select v-model="c.status" :disabled="!canEditCurrentTab">
                          <option v-for="s in PLATFORM_CREDENTIAL_STATUSES" :key="s" :value="s">
                            {{ PLATFORM_CREDENTIAL_STATUS_LABELS[s] }}
                          </option>
                        </select>
                      </div>
                    </div>

                    <div class="pf-grid pf-grid--2">
                      <div class="pf-field">
                        <label>Gmail (login) 🔒</label>
                        <input
                          v-model="c.gmail"
                          type="text"
                          autocomplete="off"
                          :disabled="!canEditCurrentTab || (c._existing && !revealed[activeTabRole])"
                          :placeholder="c._existing && !revealed[activeTabRole] ? '•••• stored. Click Reveal credentials above.' : 'login@example.com'"
                        />
                      </div>
                      <div class="pf-field">
                        <label>Password 🔒</label>
                        <input
                          v-model="c.password"
                          :type="(!c._existing || revealed[activeTabRole]) ? 'text' : 'password'"
                          autocomplete="new-password"
                          :disabled="!canEditCurrentTab || (c._existing && !revealed[activeTabRole])"
                          :placeholder="c._existing && !revealed[activeTabRole] ? '•••• stored' : ''"
                        />
                      </div>
                    </div>

                    <div class="pf-field">
                      <label>Notes <span class="pf-label-hint">non-sensitive</span></label>
                      <input
                        v-model="c.notes"
                        type="text"
                        placeholder="Notes about this credential"
                        :disabled="!canEditCurrentTab"
                      />
                    </div>

                    <!-- Per-credential member ACL (picked from this tab's managers) -->
                    <div class="cred__acl-head">
                      <h5>👥 Who can reveal this credential</h5>
                      <span class="cred__acl-count">
                        {{ (c.allowedMembers || []).filter(m => m.isActive).length }} active
                        / {{ (c.allowedMembers || []).length }} listed
                      </span>
                    </div>
                    <p v-if="!currentTabManagerUsers.length" class="pf-callout">
                      Add managers to this tab first (Manager Group below). Only this tab's
                      managers can be granted reveal access.
                    </p>
                    <div v-else class="cred__acl-grid">
                      <label
                        v-for="mu in currentTabManagerUsers"
                        :key="mu.id"
                        class="cred__acl-item"
                        :class="{
                          'cred__acl-item--on': isCredentialMember(c, mu.id),
                          'cred__acl-item--inactive': isCredentialMember(c, mu.id) && !isCredentialMemberActive(c, mu.id),
                        }"
                      >
                        <input
                          type="checkbox"
                          :checked="isCredentialMember(c, mu.id)"
                          :disabled="!canEditCurrentTab"
                          @change="toggleCredentialMember(c, mu.id)"
                        />
                        <div class="cred__acl-avatar">
                          <img v-if="mu.avatarUrl" :src="mu.avatarUrl" :alt="mu.name" />
                          <span v-else>{{ initials(mu.name) }}</span>
                        </div>
                        <div class="cred__acl-info">
                          <strong>{{ mu.name }}</strong>
                          <span>{{ mu.email }}</span>
                        </div>
                        <button
                          v-if="isCredentialMember(c, mu.id) && canEditCurrentTab"
                          type="button"
                          class="cred__acl-toggle"
                          :class="{ 'cred__acl-toggle--on': isCredentialMemberActive(c, mu.id) }"
                          :title="isCredentialMemberActive(c, mu.id) ? 'Active — click to deactivate' : 'Inactive — click to activate'"
                          @click.prevent="toggleCredentialMemberActive(c, mu.id)"
                        >
                          <span class="pf-mgr__dot"></span>
                          {{ isCredentialMemberActive(c, mu.id) ? 'Active' : 'Off' }}
                        </button>
                      </label>
                    </div>
                  </div>
                </article>

                <p v-if="!currentTabPlatformCreds.length" class="pf-empty">
                  No platform credentials in this tab yet
                  <span v-if="canEditCurrentTab">— click <strong>+ Add credential</strong>.</span>
                </p>
              </div>
            </div>

            <div class="pf-divider"></div>

            <!-- ===== TRANSACTIONS (group boss / super admin) ===== -->
            <div v-if="canManageTx || (activeTabTransactions || []).length" class="pf-sub">
              <header class="pf-sub__head">
                <h3>💰 Transactions <span class="pf-label-hint">income; given &amp; profit derived from Client share %</span></h3>
                <button
                  v-if="canManageTx && isEdit"
                  type="button"
                  class="btn btn--primary btn--xs"
                  @click="newTxOpen = !newTxOpen"
                >{{ newTxOpen ? '× Close' : '+ Add transaction' }}</button>
              </header>

              <p v-if="canManageTx && !isEdit" class="pf-callout">
                Save the profile first, then come back to record transactions here.
              </p>

              <!-- Add-transaction inline panel -->
              <div v-if="canManageTx && isEdit && newTxOpen" class="pf-tx-add">
                <div class="pf-grid pf-grid--3">
                  <div class="pf-field">
                    <label>Income *</label>
                    <div class="pf-money">
                      <span class="pf-money__sym">$</span>
                      <input v-model.number="newTx.income" type="number" min="0" step="0.01" placeholder="0.00" />
                    </div>
                  </div>
                  <div class="pf-field">
                    <label>Date</label>
                    <input v-model="newTx.date" type="date" />
                  </div>
                  <div class="pf-field">
                    <label>Description</label>
                    <input v-model="newTx.description" type="text" placeholder="e.g. Sprint 12 milestone" />
                  </div>
                </div>
                <div class="pf-tx-add__preview">
                  <div class="pf-tx-add__cell">
                    <span class="pf-tx-add__cell-label">Given</span>
                    <span class="pf-tx-add__cell-value">${{ fmtAmount(txPreview.given) }}</span>
                  </div>
                  <div class="pf-tx-add__cell pf-tx-add__cell--profit">
                    <span class="pf-tx-add__cell-label">Profit</span>
                    <span class="pf-tx-add__cell-value">${{ fmtAmount(txPreview.profit) }}</span>
                  </div>
                  <div class="pf-tx-add__actions">
                    <button type="button" class="btn btn--ghost btn--xs" @click="newTxOpen = false">Cancel</button>
                    <button
                      type="button"
                      class="btn btn--primary btn--xs"
                      :disabled="savingTx || !(Number(newTx.income) > 0)"
                      @click="submitTransaction"
                    >{{ savingTx ? 'Saving…' : 'Save transaction' }}</button>
                  </div>
                </div>
                <p v-if="txError" class="pf-error pf-mt-6">{{ txError }}</p>
              </div>

              <!-- Transactions table -->
              <div v-if="(activeTabTransactions || []).length" class="pf-tx-table">
                <div class="pf-tx-table__head">
                  <span>Date</span>
                  <span>Description</span>
                  <span class="pf-tx-table__num">Income</span>
                  <span class="pf-tx-table__num">Given</span>
                  <span class="pf-tx-table__num">Profit</span>
                  <span></span>
                </div>
                <div v-for="tx in activeTabTransactions" :key="tx._id" class="pf-tx-row">
                  <span class="pf-tx-row__date">{{ tx.date || formatShortDate(tx.createdAt) }}</span>
                  <span class="pf-tx-row__desc">{{ tx.description || '—' }}</span>
                  <span class="pf-tx-row__num">${{ fmtAmount(tx.income) }}</span>
                  <span class="pf-tx-row__num">${{ fmtAmount(tx.given) }}</span>
                  <span class="pf-tx-row__num pf-tx-row__num--profit">${{ fmtAmount(tx.profit) }}</span>
                  <button
                    v-if="canManageTx"
                    type="button"
                    class="pf-tx-row__remove"
                    :disabled="deletingTxId === tx._id"
                    @click="removeTransaction(tx)"
                    aria-label="Delete transaction"
                  >×</button>
                  <span v-else></span>
                </div>
                <div class="pf-tx-row pf-tx-row--total">
                  <span>Subtotal</span>
                  <span></span>
                  <span class="pf-tx-row__num">${{ fmtAmount(activeTabSubtotals.incoming) }}</span>
                  <span class="pf-tx-row__num">${{ fmtAmount(activeTabSubtotals.given) }}</span>
                  <span class="pf-tx-row__num pf-tx-row__num--profit">${{ fmtAmount(activeTabSubtotals.profit) }}</span>
                  <span></span>
                </div>
              </div>
              <p v-else-if="canManageTx && isEdit && !newTxOpen" class="pf-empty">
                No transactions in this tab yet — click <strong>+ Add transaction</strong>.
              </p>
            </div>

            <div v-if="canManageTx || (activeTabTransactions || []).length" class="pf-divider"></div>

            <!-- ===== MANAGER GROUP ===== -->
            <div class="pf-sub">
              <header class="pf-sub__head">
                <h3>👥 Manager Group</h3>
                <input
                  v-model="managerSearch"
                  type="search"
                  class="pf-search"
                  placeholder="Search same-role users…"
                />
              </header>

              <p v-if="loadingUsers" class="pf-empty">Loading users…</p>
              <p v-else-if="!sameRoleUsers.length" class="pf-callout">
                No team members have the <strong>{{ WORKING_ROLE_LABELS[activeTabRole] }}</strong> working role yet.
                Assign the role to a teammate first in <em>User Management</em>.
              </p>
              <div v-else class="pf-mgr-grid">
                <label
                  v-for="u in filteredSameRoleUsers"
                  :key="u.id"
                  class="pf-mgr"
                  :class="{
                    'pf-mgr--on': isManagerSelected(u.id),
                    'pf-mgr--inactive': isManagerSelected(u.id) && !isManagerActive(u.id),
                  }"
                >
                  <input
                    type="checkbox"
                    :checked="isManagerSelected(u.id)"
                    @change="toggleManager(u.id)"
                  />
                  <div class="pf-mgr__avatar">
                    <img v-if="u.avatarUrl" :src="u.avatarUrl" :alt="u.name" />
                    <span v-else>{{ initials(u.name) }}</span>
                  </div>
                  <div class="pf-mgr__info">
                    <strong>{{ u.name }}</strong>
                    <span class="pf-muted">{{ u.email }}</span>
                  </div>
                  <button
                    v-if="isManagerSelected(u.id)"
                    type="button"
                    class="pf-mgr__toggle"
                    :class="{ 'pf-mgr__toggle--on': isManagerActive(u.id) }"
                    :title="isManagerActive(u.id) ? 'Active — click to deactivate' : 'Inactive — click to activate'"
                    @click.prevent="toggleManagerActive(u.id)"
                  >
                    <span class="pf-mgr__dot"></span>
                    {{ isManagerActive(u.id) ? 'Active' : 'Off' }}
                  </button>
                </label>
              </div>
            </div>

            <div class="pf-divider"></div>

            <div class="pf-field">
              <label>Notes for {{ WORKING_ROLE_LABELS[activeTabRole] }}</label>
              <textarea v-model="currentTabNotes" rows="2" placeholder="Anything specific to this role’s setup"></textarea>
            </div>
          </div>

          <div v-else class="pf-tab__empty">
            <p>Pick one or more <strong>work role</strong> values in Base Information to configure here.</p>
          </div>
        </section>

        <div v-if="error" class="pf-error">{{ error }}</div>

        <footer class="pf-footer">
          <button type="button" class="btn btn--ghost" @click="goBack">Cancel</button>
          <button type="submit" class="btn btn--primary" :disabled="saving">
            {{ saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create profile') }}
          </button>
        </footer>
      </form>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../composables/useAuth';
import {
  PROFILE_WORK_ROLE_VALUES,
  WORKING_ROLE_LABELS,
  WORKING_ROLE_ICONS,
  CONTACT_HANDLE_PLATFORMS,
  CONTACT_HANDLE_LABELS,
  CONTACT_HANDLE_ICONS,
  CONTACT_HANDLE_ICON_URLS,
  CONTACT_HANDLE_ACCENTS,
  REMOTE_TOOLS,
  REMOTE_TOOL_LABELS,
  REMOTE_TOOL_ICONS,
  WORKING_ROLES,
  PLATFORM_CREDENTIAL_STATUSES,
  DEFAULT_PLATFORM_CREDENTIAL_STATUS,
  PLATFORM_CREDENTIAL_STATUS_LABELS,
  PLATFORM_CREDENTIAL_STATUS_ACCENTS,
  DEFAULT_CURRENCY,
} from '../../constants/profiles.js';
import { COUNTRIES, countryFlag } from '../../constants/countries.js';
import {
  getProfile,
  createProfile,
  updateProfile,
  revealTabDevices,
  uploadProfilePicture,
  addTabTransaction,
  deleteTabTransaction,
} from '../../services/profiles';
import { fetchUsers } from '../../services/users';

const props = defineProps({
  id: { type: String, default: null },
});

const router = useRouter();
const authStore = useAuthStore();

const isEdit = computed(() => !!props.id);
const backRoute = computed(() => isEdit.value
  ? { name: 'ProfileDetail', params: { id: props.id } }
  : { name: 'Profiles' });

const loading = ref(false);
const saving = ref(false);
const error = ref(null);
const loadError = ref(null);

const permissions = ref({
  canCreate: false,
  canEditAny: false,
  canEditBase: false,
  canEditContact: false,
  canEditContract: false,
  canViewContact: false,
  canViewContract: false,
  canManageTransactions: false,
  tabs: {},
});
const canEditBase = computed(() => !!permissions.value.canEditBase);
const canEditContact = computed(() => !!permissions.value.canEditContact);
const canEditContract = computed(() => !!permissions.value.canEditContract);
const canManageTx = computed(() => !!permissions.value.canManageTransactions);

const editableTabs = computed(() => Object.entries(permissions.value.tabs || {})
  .filter(([, p]) => p && p.canEdit)
  .map(([role]) => role));

const pictureFile = ref(null);
const avatarPreviewUrl = ref('');
const huntingOwnerLabel = ref(null);
/** Fallback display for the owner when the viewer can't edit (no select rendered). */
const ownerLabel = ref(null);
const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const resolveFileUrl = (id) => `${apiBase}/files/${id}/download`;

const form = reactive({
  status: 'active',
  /** Profile owner — reassignable to any hunting-profile member. */
  ownerUserId: '',
  name: '',
  countryCode: '',
  address: '',
  age: null,
  sex: '',
  statusScore: 0,
  workingRoles: [],
  currency: DEFAULT_CURRENCY,
  callSupportEnabled: false,
  callerUserId: '',
  comment: '',
  email: '',
  phone: '',
  contactHandles: [],
  linkedinUrl: '',
  githubUrl: '',
  websiteUrl: '',
  clientSharePercent: 0,
  internalHiringSharePercent: 0,
  /**
   * Map by role: { [role]: { _id?, role, devices[], managers[], transactions[], notes } }
   * Transactions are server-side only (loaded into here on edit, but not sent in PUT;
   * mutated via the dedicated add/delete endpoints).
   */
  tabsByRole: {},
});

const activeTabRole = ref('');
const managerSearch = ref('');
const revealed = reactive({});
const revealing = ref(false);
const hoverScore = ref(0);

/* ---------- score (stars) ---------- */
const displayedScore = (n) => {
  const target = hoverScore.value || form.statusScore || 0;
  return n <= target;
};
const setScore = (n) => {
  // Clicking the current value clears it (common 5-star UX).
  form.statusScore = (form.statusScore === n) ? n - 1 : n;
};

/* ---------- computed totals (mirror server logic so UI updates live) ---------- */
const computedTotals = computed(() => {
  const share = Math.max(0, Math.min(100, Number(form.clientSharePercent) || 0));
  let incoming = 0;
  for (const role of Object.keys(form.tabsByRole)) {
    for (const tx of (form.tabsByRole[role].transactions || [])) {
      incoming += Number(tx.income) || 0;
    }
  }
  const given = +(incoming * (share / 100)).toFixed(2);
  const profit = +(incoming - given).toFixed(2);
  return { incoming: +incoming.toFixed(2), given, profit };
});

/* ---------- helpers ---------- */
const initials = (name) => String(name || '?')
  .trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
const fmtAmount = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const formatShortDate = (iso) => iso ? new Date(iso).toISOString().slice(0, 10) : '';

/* ---------- avatar ---------- */
const onPictureChange = (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  pictureFile.value = f;
  if (avatarPreviewUrl.value && avatarPreviewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(avatarPreviewUrl.value);
  }
  avatarPreviewUrl.value = URL.createObjectURL(f);
};

/* ---------- working roles + tab sync ---------- */
const ensureTab = (role) => {
  if (!form.tabsByRole[role]) {
    form.tabsByRole[role] = {
      role, startedAt: '',
      devices: [], platformCredentials: [],
      managers: [], transactions: [], notes: '',
    };
  } else {
    if (!Array.isArray(form.tabsByRole[role].platformCredentials)) {
      form.tabsByRole[role].platformCredentials = [];
    }
    if (typeof form.tabsByRole[role].startedAt !== 'string') {
      form.tabsByRole[role].startedAt = '';
    }
  }
};

const toggleWorkingRole = (wr) => {
  const idx = form.workingRoles.indexOf(wr);
  if (idx === -1) {
    form.workingRoles.push(wr);
    ensureTab(wr);
    if (!permissions.value.tabs[wr]) {
      permissions.value.tabs[wr] = {
        canView: true,
        canEdit: canEditBase.value || (Array.isArray(authStore.user?.workingRoles) && authStore.user.workingRoles.includes(wr)),
      };
    }
    if (!activeTabRole.value) activeTabRole.value = wr;
  } else {
    form.workingRoles.splice(idx, 1);
    delete form.tabsByRole[wr];
    delete permissions.value.tabs[wr];
    if (activeTabRole.value === wr) {
      activeTabRole.value = form.workingRoles[0] || '';
    }
  }
};

const currentTab = computed(() => activeTabRole.value ? form.tabsByRole[activeTabRole.value] : null);
const currentTabDevices = computed({
  get: () => (currentTab.value && currentTab.value.devices) || [],
  set: (v) => { if (currentTab.value) currentTab.value.devices = v; },
});
const currentTabNotes = computed({
  get: () => (currentTab.value && currentTab.value.notes) || '',
  set: (v) => { if (currentTab.value) currentTab.value.notes = v; },
});
const currentTabStartedAt = computed({
  get: () => (currentTab.value && currentTab.value.startedAt) || '',
  set: (v) => { if (currentTab.value) currentTab.value.startedAt = v; },
});
const canEditCurrentTab = computed(() => {
  const role = activeTabRole.value;
  return !!(role && permissions.value.tabs?.[role]?.canEdit);
});
const currentTabStoredCount = computed(() => (currentTabDevices.value || []).filter((d) => d._existing).length);
const currentTabHasStoredRemote = computed(() => (currentTabDevices.value || []).some(
  (d) => d._existing && d.remoteEnabled
));
const currentTabHasStoredPlatformCred = computed(() => (currentTabPlatformCreds.value || []).some(
  (c) => c._existing
));
const currentTabHasAnyStored = computed(() =>
  currentTabHasStoredRemote.value || currentTabHasStoredPlatformCred.value
);

/* ---------- platform credentials (per-tab) ---------- */
const currentTabPlatformCreds = computed({
  get: () => (currentTab.value && currentTab.value.platformCredentials) || [],
  set: (v) => { if (currentTab.value) currentTab.value.platformCredentials = v; },
});

/** Users in this tab's manager pool — the only pool eligible for credential ACLs. */
const currentTabManagerUsers = computed(() => {
  if (!currentTab.value) return [];
  const ids = new Set((currentTab.value.managers || []).map((m) => String(m.userId)));
  return users.value.filter((u) => ids.has(String(u.id)));
});

const isCredentialMember = (c, uid) =>
  (c.allowedMembers || []).some((m) => String(m.userId) === String(uid));
const isCredentialMemberActive = (c, uid) => {
  const m = (c.allowedMembers || []).find((x) => String(x.userId) === String(uid));
  return !!(m && m.isActive);
};
const toggleCredentialMember = (c, uid) => {
  if (!Array.isArray(c.allowedMembers)) c.allowedMembers = [];
  const idx = c.allowedMembers.findIndex((m) => String(m.userId) === String(uid));
  if (idx === -1) c.allowedMembers.push({ userId: uid, isActive: true });
  else c.allowedMembers.splice(idx, 1);
};
const toggleCredentialMemberActive = (c, uid) => {
  const m = (c.allowedMembers || []).find((x) => String(x.userId) === String(uid));
  if (m) m.isActive = !m.isActive;
};

/**
 * Tint the credential status chip from its accent colour — a translucent fill
 * plus the solid colour for text/border, so all four states read at a glance.
 */
const credStatusStyle = (status) => {
  const key = PLATFORM_CREDENTIAL_STATUSES.includes(status)
    ? status
    : DEFAULT_PLATFORM_CREDENTIAL_STATUS;
  const accent = PLATFORM_CREDENTIAL_STATUS_ACCENTS[key];
  return { color: accent, borderColor: accent, background: `${accent}1f` };
};

const addPlatformCredential = (role) => {
  ensureTab(role);
  if (!Array.isArray(form.tabsByRole[role].platformCredentials)) {
    form.tabsByRole[role].platformCredentials = [];
  }
  form.tabsByRole[role].platformCredentials.push({
    platform: '', status: DEFAULT_PLATFORM_CREDENTIAL_STATUS,
    hint: '', gmail: '', password: '', notes: '',
    allowedMembers: [],
  });
};

const activeTabTransactions = computed(() => currentTab.value?.transactions || []);
const activeTabSubtotals = computed(() => {
  const txs = activeTabTransactions.value;
  const inc = txs.reduce((s, t) => s + (Number(t.income) || 0), 0);
  const share = Math.max(0, Math.min(100, Number(form.clientSharePercent) || 0));
  const given = +(inc * (share / 100)).toFixed(2);
  return { incoming: +inc.toFixed(2), given, profit: +(inc - given).toFixed(2) };
});

/* ---------- devices ---------- */
const addDevice = (role) => {
  ensureTab(role);
  form.tabsByRole[role].devices.push({
    detail: '', price: 0, currency: form.currency || DEFAULT_CURRENCY,
    buyerType: 'client', buyerUserId: '',
    remoteEnabled: false,
    remoteTool: 'anydesk',           // sensible default per user request
    remoteToolCustomName: '',
    remoteId: '', remotePassword: '', notes: '',
  });
};

/* ---------- contact handles ---------- */
const addHandle = () => form.contactHandles.push({ platform: 'telegram', customLabel: '', handle: '' });

/* ---------- users ---------- */
const users = ref([]);
const loadingUsers = ref(false);
const loadUsers = async () => {
  loadingUsers.value = true;
  try {
    const res = await fetchUsers({ limit: 1000 });
    users.value = (res?.data?.users || []).filter((u) => u.status !== 'disabled');
  } catch {
    users.value = [];
  } finally {
    loadingUsers.value = false;
  }
};

/**
 * Candidate profile owners. Ownership of a client record sits with the hunting
 * team, so only members carrying the `hunting_profile` working role qualify.
 * The current owner is always kept in the list even if their roles changed, so
 * an unrelated edit can't silently reassign the profile.
 */
const huntingProfileUsers = computed(() => {
  const eligible = users.value.filter((u) => Array.isArray(u.workingRoles)
    && u.workingRoles.includes(WORKING_ROLES.HUNTING_PROFILE));
  const current = form.ownerUserId
    && !eligible.some((u) => String(u.id) === String(form.ownerUserId))
    && users.value.find((u) => String(u.id) === String(form.ownerUserId));
  return current ? [current, ...eligible] : eligible;
});

const sameRoleUsers = computed(() => {
  if (!activeTabRole.value) return [];
  return users.value.filter((u) => Array.isArray(u.workingRoles) && u.workingRoles.includes(activeTabRole.value));
});
const filteredSameRoleUsers = computed(() => {
  const q = managerSearch.value.trim().toLowerCase();
  if (!q) return sameRoleUsers.value;
  return sameRoleUsers.value.filter((u) =>
    (u.name || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q)
  );
});

const isManagerSelected = (uid) => currentTab.value && (currentTab.value.managers || []).some((m) => String(m.userId) === String(uid));
const isManagerActive = (uid) => {
  if (!currentTab.value) return false;
  const m = (currentTab.value.managers || []).find((x) => String(x.userId) === String(uid));
  return !!(m && m.isActive);
};
const toggleManager = (uid) => {
  if (!currentTab.value) return;
  const idx = (currentTab.value.managers || []).findIndex((m) => String(m.userId) === String(uid));
  if (idx === -1) {
    currentTab.value.managers.push({ userId: uid, isActive: true });
  } else {
    currentTab.value.managers.splice(idx, 1);
  }
};
const toggleManagerActive = (uid) => {
  if (!currentTab.value) return;
  const m = (currentTab.value.managers || []).find((x) => String(x.userId) === String(uid));
  if (m) m.isActive = !m.isActive;
};

/* ---------- reveal ---------- */
const revealActiveTab = async () => {
  if (!activeTabRole.value || !isEdit.value) return;
  revealing.value = true;
  try {
    const res = await revealTabDevices(props.id, activeTabRole.value);
    const tab = form.tabsByRole[activeTabRole.value];
    if (tab) {
      // Populate decrypted device remote credentials
      const devById = new Map((res?.data?.devices || []).map((d) => [String(d._id), d]));
      for (const d of tab.devices || []) {
        if (d._existing && d._id && devById.has(String(d._id))) {
          const rev = devById.get(String(d._id));
          d.remoteId = rev.remoteId || '';
          d.remotePassword = rev.remotePassword || '';
        }
      }
      // Populate decrypted platform credentials (gmail + password)
      const credById = new Map((res?.data?.platformCredentials || []).map((c) => [String(c._id), c]));
      for (const c of tab.platformCredentials || []) {
        if (c._existing && c._id && credById.has(String(c._id))) {
          const rev = credById.get(String(c._id));
          c.gmail = rev.gmail || '';
          c.password = rev.password || '';
        }
      }
    }
    revealed[activeTabRole.value] = true;
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to reveal credentials';
  } finally {
    revealing.value = false;
  }
};

/* ---------- transactions ---------- */
const newTxOpen = ref(false);
const newTx = reactive({ income: 0, description: '', date: '', currency: DEFAULT_CURRENCY });
const savingTx = ref(false);
const deletingTxId = ref(null);
const txError = ref(null);

const txPreview = computed(() => {
  const inc = Number(newTx.income) || 0;
  const share = Math.max(0, Math.min(100, Number(form.clientSharePercent) || 0));
  const given = +(inc * (share / 100)).toFixed(2);
  return { incoming: inc, given, profit: +(inc - given).toFixed(2) };
});

const resetNewTx = () => {
  newTx.income = 0;
  newTx.description = '';
  newTx.date = '';
  newTx.currency = form.currency || DEFAULT_CURRENCY;
  txError.value = null;
};

const submitTransaction = async () => {
  if (!isEdit.value || !activeTabRole.value) return;
  if (!(Number(newTx.income) > 0)) {
    txError.value = 'Income must be greater than 0';
    return;
  }
  savingTx.value = true;
  txError.value = null;
  try {
    const res = await addTabTransaction(props.id, activeTabRole.value, {
      income: Number(newTx.income),
      description: newTx.description,
      date: newTx.date,
      currency: newTx.currency,
    });
    const updated = res?.data?.profile;
    if (updated) syncTabsFromServer(updated);
    resetNewTx();
    newTxOpen.value = false;
  } catch (err) {
    txError.value = err?.response?.data?.message || 'Failed to save transaction';
  } finally {
    savingTx.value = false;
  }
};

const removeTransaction = async (tx) => {
  if (!isEdit.value || !activeTabRole.value || !tx?._id) return;
  if (!window.confirm('Delete this transaction? This cannot be undone.')) return;
  deletingTxId.value = tx._id;
  try {
    const res = await deleteTabTransaction(props.id, activeTabRole.value, tx._id);
    const updated = res?.data?.profile;
    if (updated) syncTabsFromServer(updated);
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to delete transaction';
  } finally {
    deletingTxId.value = null;
  }
};

/**
 * Re-sync each loaded tab's `transactions` array from the server response,
 * without touching the user's in-progress edits to other tab fields.
 */
const syncTabsFromServer = (serverProfile) => {
  for (const t of (serverProfile.workingRoleTabs || [])) {
    const local = form.tabsByRole[t.role];
    if (local) local.transactions = t.transactions || [];
  }
};

/* ---------- load existing ---------- */
const loadProfile = async () => {
  if (!isEdit.value) return;
  loading.value = true;
  loadError.value = null;
  try {
    const res = await getProfile(props.id);
    const p = res?.data?.profile;
    permissions.value = res?.data?.permissions || permissions.value;
    if (!p) throw new Error('Profile not found');
    form.status = p.status || 'active';
    form.ownerUserId = (p.ownerUserId && p.ownerUserId._id) ? p.ownerUserId._id : (p.ownerUserId || '');
    form.name = p.name || '';
    form.countryCode = p.countryCode || '';
    form.address = p.address || '';
    form.age = p.age ?? null;
    form.sex = p.sex || '';
    form.statusScore = typeof p.statusScore === 'number' ? p.statusScore : 0;
    form.workingRoles = [...(p.workingRoles || [])];
    form.currency = p.currency || DEFAULT_CURRENCY;
    form.callSupportEnabled = !!p.callSupportEnabled;
    form.callerUserId = (p.callerUserId && p.callerUserId._id) ? p.callerUserId._id : (p.callerUserId || '');
    form.comment = p.comment || '';

    if (p.email !== undefined) form.email = p.email || '';
    if (p.phone !== undefined) form.phone = p.phone || '';
    if (Array.isArray(p.contactHandles)) form.contactHandles = p.contactHandles.map(({ _id, ...rest }) => ({ ...rest }));
    if (p.linkedinUrl !== undefined) form.linkedinUrl = p.linkedinUrl || '';
    if (p.githubUrl !== undefined) form.githubUrl = p.githubUrl || '';
    if (p.websiteUrl !== undefined) form.websiteUrl = p.websiteUrl || '';

    if (p.clientSharePercent !== undefined) form.clientSharePercent = Number(p.clientSharePercent) || 0;
    if (p.internalHiringSharePercent !== undefined) form.internalHiringSharePercent = Number(p.internalHiringSharePercent) || 0;

    form.tabsByRole = {};
    for (const t of (p.workingRoleTabs || [])) {
      form.tabsByRole[t.role] = {
        _id: t._id,
        role: t.role,
        startedAt: t.startedAt || '',
        notes: t.notes || '',
        devices: (t.devices || []).map((d) => ({
          _id: d._id,
          _existing: true,
          detail: d.detail || '',
          price: Number(d.price) || 0,
          currency: d.currency || DEFAULT_CURRENCY,
          buyerType: d.buyerType || 'client',
          buyerUserId: (d.buyerUserId && d.buyerUserId._id) ? d.buyerUserId._id : (d.buyerUserId || ''),
          remoteEnabled: !!d.remoteEnabled,
          remoteTool: d.remoteTool || 'anydesk',
          remoteToolCustomName: d.remoteToolCustomName || '',
          remoteId: '',
          remotePassword: '',
          notes: d.notes || '',
        })),
        platformCredentials: (t.platformCredentials || []).map((c) => ({
          _id: c._id,
          _existing: true,
          platform: c.platform || '',
          status: c.status || DEFAULT_PLATFORM_CREDENTIAL_STATUS,
          hint: c.hint || '',
          gmail: '',           // never sent from server
          password: '',
          notes: c.notes || '',
          allowedMembers: (c.allowedMembers || []).map((m) => ({
            userId: (m.userId && m.userId._id) ? m.userId._id : m.userId,
            isActive: !!m.isActive,
          })),
        })),
        managers: (t.managers || []).map((m) => ({
          userId: (m.userId && m.userId._id) ? m.userId._id : m.userId,
          isActive: !!m.isActive,
        })),
        transactions: (t.transactions || []),
      };
    }

    ownerLabel.value = (p.ownerUserId && p.ownerUserId.name)
      ? { name: p.ownerUserId.name, email: p.ownerUserId.email }
      : null;

    huntingOwnerLabel.value = p.huntingOwnerId
      ? { name: p.huntingOwnerId.name, email: p.huntingOwnerId.email }
      : null;

    if (p.pictureFileId && p.pictureFileId._id) {
      avatarPreviewUrl.value = resolveFileUrl(p.pictureFileId._id);
    }

    if (editableTabs.value.length) activeTabRole.value = editableTabs.value[0];
  } catch (err) {
    loadError.value = err?.response?.data?.message || 'Failed to load profile';
  } finally {
    loading.value = false;
  }
};

/* ---------- create-mode default permissions ---------- */
const bootstrapCreateMode = () => {
  const user = authStore.user;
  if (!user) return;
  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'GROUP_BOSS' || user.degree === 'ADMIN' || user.degree === 'TEAM_BOSS';
  const isHunter = Array.isArray(user.workingRoles) && user.workingRoles.includes('hunting_profile');
  const triad = isAdmin || isHunter;
  permissions.value = {
    canCreate: triad,
    canEditAny: triad,
    canEditBase: triad,
    canEditContact: triad,
    canEditContract: triad,
    canViewContact: triad,
    canViewContract: triad,
    canManageTransactions: isAdmin,         // GROUP_BOSS / SUPER_ADMIN
    tabs: {},
  };
  // A hunter creating a profile owns it by default; admins pick an owner explicitly.
  if (isHunter && !form.ownerUserId) form.ownerUserId = user.id || user._id || '';
};

/* ---------- submit ---------- */
const stripInternal = (obj) => {
  if (Array.isArray(obj)) return obj.map(stripInternal);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '_existing') continue;
      out[k] = stripInternal(v);
    }
    return out;
  }
  return obj;
};

const buildPayload = () => {
  const out = {};

  if (canEditBase.value) {
    Object.assign(out, {
      name: form.name,
      status: form.status,
      ownerUserId: form.ownerUserId || undefined,
      countryCode: form.countryCode,
      address: form.address,
      age: form.age,
      sex: form.sex,
      statusScore: form.statusScore,
      workingRoles: form.workingRoles,
      currency: form.currency,
      callSupportEnabled: form.callSupportEnabled,
      callerUserId: form.callerUserId || null,
      comment: form.comment,
    });
  }
  if (canEditContact.value) {
    Object.assign(out, {
      email: form.email,
      phone: form.phone,
      contactHandles: form.contactHandles,
      linkedinUrl: form.linkedinUrl,
      githubUrl: form.githubUrl,
      websiteUrl: form.websiteUrl,
    });
  }
  if (canEditContract.value) {
    Object.assign(out, {
      clientSharePercent: form.clientSharePercent,
      internalHiringSharePercent: form.internalHiringSharePercent,
    });
  }

  // Tabs: send only tabs the user can edit. Transactions are NOT sent here —
  // they're managed via the dedicated /transactions endpoints.
  const tabs = [];
  for (const role of editableTabs.value) {
    const t = form.tabsByRole[role];
    if (!t) continue;
    tabs.push(stripInternal({
      _id: t._id,
      role,
      startedAt: t.startedAt || '',
      notes: t.notes,
      devices: t.devices.map((d) => ({
        _id: d._id,
        detail: d.detail,
        price: d.price,
        currency: d.currency,
        buyerType: d.buyerType,
        buyerUserId: d.buyerType === 'user' ? (d.buyerUserId || null) : null,
        remoteEnabled: d.remoteEnabled,
        remoteTool: d.remoteTool,
        remoteToolCustomName: d.remoteToolCustomName,
        remoteId: d.remoteId,
        remotePassword: d.remotePassword,
        notes: d.notes,
      })),
      platformCredentials: (t.platformCredentials || []).map((c) => ({
        _id: c._id,
        platform: c.platform,
        status: c.status || DEFAULT_PLATFORM_CREDENTIAL_STATUS,
        hint: c.hint,
        gmail: c.gmail,
        password: c.password,
        notes: c.notes,
        allowedMembers: c.allowedMembers || [],
      })),
      managers: t.managers,
    }));
  }
  if (tabs.length) out.workingRoleTabs = tabs;

  return out;
};

const onSubmit = async () => {
  if (canEditBase.value && !form.name.trim()) { error.value = 'Name is required.'; return; }
  saving.value = true;
  error.value = null;
  try {
    const payload = buildPayload();
    let saved;
    if (isEdit.value) {
      const res = await updateProfile(props.id, payload);
      saved = res?.data?.profile;
    } else {
      const res = await createProfile(payload);
      saved = res?.data?.profile;
    }
    if (saved && saved._id && pictureFile.value) {
      try {
        const upRes = await uploadProfilePicture(saved._id, pictureFile.value);
        saved = upRes?.data?.profile || saved;
      } catch (e) {
        console.warn('Avatar upload failed', e);
      }
    }
    if (saved && saved._id) {
      router.push({ name: 'ProfileDetail', params: { id: saved._id } });
    }
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to save profile';
  } finally {
    saving.value = false;
  }
};

const goBack = () => router.push(backRoute.value);

onMounted(async () => {
  await loadUsers();
  if (isEdit.value) {
    await loadProfile();
  } else {
    bootstrapCreateMode();
  }
});

watch(() => props.id, async (newId) => {
  if (newId) await loadProfile();
});

watch(activeTabRole, () => {
  managerSearch.value = '';
  newTxOpen.value = false;
  resetNewTx();
});
</script>

<style scoped>
/* ============================================================
   DESIGN TOKENS
============================================================ */
.pf-page {
  --pf-surface: var(--bg-primary, #ffffff);
  --pf-surface-alt: var(--bg-secondary, #f8fafc);
  --pf-border: var(--border-light, #e5e7eb);
  --pf-border-strong: var(--border-medium, #cbd5e1);
  --pf-text: var(--text-primary, #0f172a);
  --pf-text-2: var(--text-secondary, #475569);
  --pf-text-3: var(--text-tertiary, #94a3b8);
  --pf-primary: var(--color-primary, #2563eb);
  --pf-primary-soft: var(--color-primary-soft, rgba(37, 99, 235, 0.08));
  --pf-primary-strong: #1d4ed8;
  --pf-success: #047857;
  --pf-success-soft: rgba(16, 185, 129, 0.1);
  --pf-warning: #b45309;
  --pf-warning-soft: rgba(245, 158, 11, 0.12);
  --pf-violet: #6d28d9;
  --pf-violet-soft: rgba(139, 92, 246, 0.12);
  --pf-danger: var(--color-error, #ef4444);
  --pf-radius: 14px;
  --pf-radius-sm: 8px;
  --pf-radius-lg: 18px;
  --pf-shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04);

  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--pf-surface-alt);
}

/* ============================================================
   STICKY TOP BAR — minimal: back + actions only
============================================================ */
.pf-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--pf-surface);
  border-bottom: 1px solid var(--pf-border);
}
.pf-bar__inner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  max-width: 1100px;
  margin: 0 auto;
}
.pf-bar__spacer { flex: 1; }
.pf-bar__back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--pf-radius-sm);
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
  color: var(--pf-text-2);
  transition: background 0.15s ease;
}
.pf-bar__back:hover { background: var(--pf-surface-alt); color: var(--pf-text); }
.pf-bar__actions { display: flex; gap: 8px; }

/* ============================================================
   BUTTONS
============================================================ */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: var(--pf-radius-sm);
  border: 1px solid transparent;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.05s ease;
  white-space: nowrap;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn:active:not(:disabled) { transform: translateY(0.5px); }

.btn--primary {
  background: var(--pf-primary);
  color: #fff;
  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.3);
}
.btn--primary:hover:not(:disabled) { background: var(--pf-primary-strong); }

.btn--ghost {
  background: var(--pf-surface);
  border-color: var(--pf-border-strong);
  color: var(--pf-text);
}
.btn--ghost:hover:not(:disabled) { background: var(--pf-surface-alt); }

.btn--reveal {
  background: #fff7ed;
  border-color: #fbbf24;
  color: var(--pf-warning);
}
.btn--reveal:hover:not(:disabled) { background: #fef3c7; }

.btn--xs { padding: 5px 10px; font-size: 0.76rem; }

/* ============================================================
   CANVAS + FORM
============================================================ */
.pf-canvas {
  flex: 1;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 16px 40px;
}
.pf-state {
  background: var(--pf-surface);
  border: 1px dashed var(--pf-border-strong);
  border-radius: var(--pf-radius);
  padding: 36px;
  text-align: center;
  color: var(--pf-text-2);
  font-size: 0.92rem;
}
.pf-state--error { color: #b91c1c; border-color: rgba(239, 68, 68, 0.5); }
.pf-form { display: flex; flex-direction: column; gap: 16px; }

/* ============================================================
   HERO
============================================================ */
.pf-hero {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 18px;
  align-items: center;
  padding: 18px;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.04), rgba(99, 102, 241, 0.07));
  border: 1px solid var(--pf-border);
  border-radius: var(--pf-radius-lg);
  box-shadow: var(--pf-shadow-sm);
}
.pf-hero__avatar {
  position: relative;
  width: 96px; height: 96px;
  border-radius: 16px; overflow: hidden;
  background: linear-gradient(135deg, #dbeafe, #e0e7ff);
  display: flex; align-items: center; justify-content: center;
  border: 3px solid #fff;
  box-shadow: var(--pf-shadow-sm);
}
.pf-hero__avatar img { width: 100%; height: 100%; object-fit: cover; }
.pf-hero__avatar-fallback { font-size: 1.8rem; font-weight: 800; color: var(--pf-primary); letter-spacing: -0.02em; }
.pf-hero__avatar-edit {
  position: absolute; bottom: 4px; right: 4px;
  width: 28px; height: 28px; border-radius: 999px;
  background: rgba(15, 23, 42, 0.85); color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; border: 2px solid #fff;
  transition: background 0.15s ease;
}
.pf-hero__avatar-edit:hover { background: rgba(15, 23, 42, 1); }
.pf-hero__main { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.pf-eyebrow {
  font-size: 0.7rem; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--pf-text-3);
}
.pf-hero__name-field { display: flex; flex-direction: column; gap: 4px; }
.pf-hero__name-label {
  font-size: 0.66rem; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--pf-text-3);
}
.pf-hero__name {
  width: 100%;
  background: var(--pf-surface);
  border: 1.5px solid var(--pf-border-strong);
  border-radius: var(--pf-radius-sm);
  font-size: clamp(1.1rem, 2vw, 1.4rem);
  font-weight: 700;
  color: var(--pf-text);
  letter-spacing: -0.01em;
  line-height: 1.2;
  padding: 9px 14px;
  outline: none;
  font-family: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  box-shadow: var(--pf-shadow-sm);
}
.pf-hero__name::placeholder {
  color: var(--pf-text-3);
  font-weight: 500;
  font-size: 0.95rem;
}
.pf-hero__name:hover:not(:disabled) { border-color: var(--pf-text-3); }
.pf-hero__name:focus {
  border-color: var(--pf-primary);
  box-shadow: 0 0 0 3px var(--pf-primary-soft);
}
.pf-hero__name:disabled {
  background: var(--pf-surface-alt); color: var(--pf-text);
  border-style: dashed;
}

.pf-hero__selects { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.pf-pill-select {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px 4px 12px;
  border-radius: 999px;
  background: var(--pf-surface);
  border: 1px solid var(--pf-border);
  cursor: pointer; font-size: 0.82rem; font-weight: 600;
}
.pf-pill-select__label {
  font-size: 0.66rem; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--pf-text-3); font-weight: 700;
}
.pf-pill-select select {
  border: none; background: transparent;
  font: inherit; color: var(--pf-text);
  padding: 0; outline: none; cursor: pointer; font-weight: 700;
}
.pf-pill-select--status-active { background: rgba(34, 197, 94, 0.12); border-color: rgba(34, 197, 94, 0.3); color: var(--pf-success); }
.pf-pill-select--status-active select { color: var(--pf-success); }
.pf-pill-select--status-archived { background: rgba(148, 163, 184, 0.2); border-color: rgba(148, 163, 184, 0.4); color: var(--pf-text-2); }
.pf-pill-select--status-archived select { color: var(--pf-text-2); }
.pf-hero__hint { font-size: 0.74rem; color: var(--pf-text-2); align-self: center; }

/* ============================================================
   CARD
============================================================ */
.pf-card {
  background: var(--pf-surface);
  border: 1px solid var(--pf-border);
  border-radius: var(--pf-radius-lg);
  box-shadow: var(--pf-shadow-sm);
  overflow: hidden;
}
.pf-card__head {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--pf-border);
}
.pf-card__icon {
  width: 36px; height: 36px; border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 1.05rem; flex-shrink: 0;
}
.pf-card__icon--blue   { background: var(--pf-primary-soft); color: var(--pf-primary); }
.pf-card__icon--violet { background: var(--pf-violet-soft); color: var(--pf-violet); }
.pf-card__icon--green  { background: var(--pf-success-soft); color: var(--pf-success); }
.pf-card__icon--amber  { background: var(--pf-warning-soft); color: var(--pf-warning); }
.pf-card__title { flex: 1; min-width: 0; line-height: 1.3; }
.pf-card__title h2 {
  margin: 0; font-size: 1.02rem; font-weight: 700;
  color: var(--pf-text); letter-spacing: -0.01em;
}
.pf-card__title p { margin: 2px 0 0; font-size: 0.8rem; color: var(--pf-text-2); }
.pf-card__body {
  padding: 20px;
  display: flex; flex-direction: column; gap: 14px;
}
.pf-card--tabs .pf-card__body { padding-top: 0; }

.pf-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: 999px;
  font-size: 0.66rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  flex-shrink: 0;
}
.pf-badge--private { background: var(--pf-warning-soft); color: var(--pf-warning); }

/* ============================================================
   GRID + FIELD
============================================================ */
.pf-grid { display: grid; gap: 12px; }
.pf-grid--2 { grid-template-columns: repeat(2, 1fr); }
.pf-grid--3 { grid-template-columns: repeat(3, 1fr); }
.pf-grid--4 { grid-template-columns: repeat(4, 1fr); }

.pf-field {
  display: flex; flex-direction: column; gap: 5px;
  min-width: 0; position: relative;
}
.pf-field--span2 { grid-column: span 2; }
.pf-field--span3 { grid-column: span 3; }

.pf-field > label,
.pf-field label {
  font-size: 0.7rem; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--pf-text-3);
  display: inline-flex; align-items: center; gap: 6px;
}
.pf-label-hint {
  text-transform: none; letter-spacing: normal;
  font-weight: 500; color: var(--pf-text-3); font-size: 0.7rem;
}

.pf-field input,
.pf-field select,
.pf-field textarea {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--pf-border-strong);
  border-radius: var(--pf-radius-sm);
  background: var(--pf-surface);
  color: var(--pf-text);
  font-size: 0.9rem;
  font-family: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.pf-field textarea { resize: vertical; min-height: 60px; }
.pf-field input:hover:not(:disabled),
.pf-field select:hover:not(:disabled),
.pf-field textarea:hover:not(:disabled) { border-color: var(--pf-text-3); }
.pf-field input:focus,
.pf-field select:focus,
.pf-field textarea:focus {
  outline: none;
  border-color: var(--pf-primary);
  box-shadow: 0 0 0 3px var(--pf-primary-soft);
}
.pf-field input:disabled,
.pf-field select:disabled,
.pf-field textarea:disabled {
  background: var(--pf-surface-alt);
  color: var(--pf-text-3); cursor: not-allowed;
}

.pf-hint { font-size: 0.74rem; color: var(--pf-text-2); }
.pf-hint--muted { color: var(--pf-text-3); }
.pf-divider { height: 1px; background: var(--pf-border); margin: 4px 0; }
.pf-mt-4 { margin-top: 4px; }
.pf-mt-6 { margin-top: 6px; }
.pf-mt-8 { margin-top: 8px; }
.pf-muted { color: var(--pf-text-3); font-weight: normal; }

/* ============================================================
   STARS (status score)
============================================================ */
.pf-stars {
  display: inline-flex; align-items: center; gap: 2px;
}
.pf-star {
  background: transparent; border: none;
  padding: 4px 2px; font-size: 1.5rem; line-height: 1;
  color: rgba(148, 163, 184, 0.45);
  cursor: pointer;
  transition: color 0.12s ease, transform 0.08s ease;
}
.pf-star:hover { transform: scale(1.15); }
.pf-star--on { color: #f59e0b; }
.pf-star--hover { color: #fbbf24; }
.pf-stars__value {
  margin-left: 10px;
  font-size: 0.84rem; font-weight: 700;
  color: var(--pf-text); font-variant-numeric: tabular-nums;
}
.pf-stars__clear {
  margin-left: 6px;
  background: transparent; border: none;
  font-size: 0.72rem; color: var(--pf-text-3);
  cursor: pointer; padding: 4px 6px; border-radius: 4px;
  text-decoration: underline;
}
.pf-stars__clear:hover { color: var(--pf-text); }

/* ============================================================
   WORK ROLE CHIPS
============================================================ */
.pf-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.pf-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 999px;
  border: 1px solid var(--pf-border-strong);
  background: var(--pf-surface);
  font-size: 0.84rem; font-weight: 600;
  color: var(--pf-text);
  cursor: pointer;
  transition: all 0.15s ease;
}
.pf-chip:hover { border-color: var(--pf-primary); color: var(--pf-primary); }
.pf-chip__icon { font-size: 0.95rem; line-height: 1; }
.pf-chip__check {
  width: 16px; height: 16px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 0.7rem;
}
.pf-chip--on {
  background: var(--pf-primary);
  border-color: var(--pf-primary);
  color: #fff;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
}

/* ============================================================
   MONEY INPUT + READ-ONLY STAT
============================================================ */
.pf-money {
  display: flex; align-items: stretch;
  border: 1px solid var(--pf-border-strong);
  border-radius: var(--pf-radius-sm);
  background: var(--pf-surface);
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.pf-money:focus-within {
  border-color: var(--pf-primary);
  box-shadow: 0 0 0 3px var(--pf-primary-soft);
}
.pf-money__sym {
  display: inline-flex; align-items: center;
  padding: 0 10px;
  background: var(--pf-surface-alt);
  color: var(--pf-text-2);
  font-size: 0.86rem; font-weight: 700;
  border-right: 1px solid var(--pf-border);
}
.pf-money input {
  flex: 1; border: none !important;
  box-shadow: none !important;
  padding: 9px 10px !important;
  font-variant-numeric: tabular-nums;
}
.pf-money input:focus { box-shadow: none !important; }
.pf-money__cur {
  border: none !important;
  background: var(--pf-surface-alt);
  font-size: 0.76rem !important;
  padding: 0 8px !important;
  width: auto !important;
  border-left: 1px solid var(--pf-border) !important;
  border-radius: 0 !important;
}

.pf-stat {
  display: flex; align-items: center;
  background: var(--pf-surface-alt);
  border: 1px solid var(--pf-border);
  border-radius: var(--pf-radius-sm);
  padding: 0;
  min-height: 38px;
}
.pf-stat__sym {
  display: inline-flex; align-items: center;
  padding: 0 10px;
  color: var(--pf-text-2); font-weight: 700;
  font-size: 0.86rem;
  border-right: 1px solid var(--pf-border);
  align-self: stretch;
}
.pf-stat__value {
  flex: 1; padding: 0 12px;
  font-size: 0.92rem; font-weight: 700;
  color: var(--pf-text);
  font-variant-numeric: tabular-nums;
}
.pf-stat--readonly { background: var(--pf-surface-alt); }
.pf-stat--profit { background: var(--pf-success-soft); border-color: rgba(34, 197, 94, 0.35); }
.pf-stat--profit .pf-stat__value { color: var(--pf-success); }
.pf-stat--profit .pf-stat__sym { color: var(--pf-success); border-color: rgba(34, 197, 94, 0.25); }

.pf-pct {
  display: flex; align-items: stretch;
  border: 1px solid var(--pf-border-strong);
  border-radius: var(--pf-radius-sm);
  background: var(--pf-surface);
  overflow: hidden;
}
.pf-pct:focus-within {
  border-color: var(--pf-primary);
  box-shadow: 0 0 0 3px var(--pf-primary-soft);
}
.pf-pct input {
  flex: 1; border: none !important;
  box-shadow: none !important;
  padding: 9px 12px !important;
  font-variant-numeric: tabular-nums; font-weight: 600;
}
.pf-pct__sym {
  display: inline-flex; align-items: center;
  padding: 0 14px;
  background: var(--pf-surface-alt);
  border-left: 1px solid var(--pf-border);
  font-weight: 700; color: var(--pf-text-2);
}

/* Hunting owner */
.pf-readonly {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px;
  border: 1px dashed var(--pf-border-strong);
  background: var(--pf-surface-alt);
  border-radius: var(--pf-radius-sm);
}
.pf-readonly__avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--pf-primary-soft); color: var(--pf-primary);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 0.74rem; font-weight: 700; flex-shrink: 0;
}
.pf-readonly__id { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.pf-readonly__id strong { font-size: 0.88rem; color: var(--pf-text); }
.pf-readonly__id span { font-size: 0.74rem; }
.pf-lock-tag {
  font-size: 0.62rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  background: rgba(148, 163, 184, 0.16);
  color: var(--pf-text-2);
  padding: 2px 7px; border-radius: 999px;
  flex-shrink: 0;
}

/* Call support */
.pf-toggle-card {
  padding: 9px 12px;
  border: 1px dashed var(--pf-border-strong);
  background: var(--pf-surface-alt);
  border-radius: var(--pf-radius-sm);
  display: flex; flex-direction: column; gap: 8px;
}
.pf-toggle-card--on {
  border-style: solid;
  border-color: rgba(34, 197, 94, 0.35);
  background: rgba(34, 197, 94, 0.04);
}
.pf-toggle-card__select { font-size: 0.86rem; }

/* Switch */
.pf-switch {
  display: inline-flex; align-items: center; gap: 10px;
  cursor: pointer; user-select: none;
}
.pf-switch input { position: absolute; opacity: 0; pointer-events: none; }
.pf-switch__track {
  width: 36px; height: 20px;
  border-radius: 999px;
  background: var(--pf-border-strong);
  position: relative;
  transition: background 0.18s ease;
}
.pf-switch__thumb {
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: var(--pf-shadow-sm);
  transition: transform 0.18s ease;
}
.pf-switch input:checked + .pf-switch__track { background: var(--pf-success); }
.pf-switch input:checked + .pf-switch__track .pf-switch__thumb { transform: translateX(16px); }
.pf-switch__label {
  font-size: 0.84rem; font-weight: 600; color: var(--pf-text);
}

/* ============================================================
   LIST (handles)
============================================================ */
.pf-list { display: flex; flex-direction: column; gap: 8px; }
.pf-list__head {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
}
.pf-list__head h4 { margin: 0; font-size: 0.85rem; font-weight: 700; color: var(--pf-text); }
.pf-list__row {
  position: relative;
  background: var(--pf-surface-alt);
  border: 1px solid var(--pf-border);
  border-radius: var(--pf-radius-sm);
  padding: 12px; padding-right: 44px;
}
.pf-remove {
  position: absolute; top: 8px; right: 8px;
  width: 28px; height: 28px;
  border-radius: var(--pf-radius-sm);
  border: 1px solid var(--pf-border-strong);
  background: var(--pf-surface);
  color: var(--pf-text-2);
  cursor: pointer; font-size: 1.1rem; line-height: 1;
}
.pf-remove:hover {
  background: var(--pf-danger); border-color: var(--pf-danger); color: #fff;
}

/* ============================================================
   MESSAGING HANDLES (polished row)
============================================================ */
.pf-handles {
  display: flex; flex-direction: column; gap: 8px;
}
.handle {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 10px;
  padding: 10px;
  background: var(--pf-surface-alt);
  border: 1px solid var(--pf-border);
  border-radius: var(--pf-radius);
  transition: border-color 0.15s ease;
}
.handle__platform { width: 180px; }
.handle__label { width: 180px; }
.handle__handle { flex: 1; min-width: 220px; }
.handle:hover { border-color: var(--pf-border-strong); }
.handle__icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--pf-text-3);
  color: #fff;
  font-size: 1.15rem;
  align-self: end;
  margin-bottom: 1px;
  box-shadow: var(--pf-shadow-sm);
  overflow: hidden;
  padding: 4px;
}
.handle__icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.handle__platform,
.handle__label,
.handle__handle {
  display: flex; flex-direction: column; gap: 4px; min-width: 0;
}
.handle__platform label,
.handle__label label,
.handle__handle label {
  font-size: 0.66rem; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--pf-text-3);
}
.handle__platform select,
.handle__label input,
.handle__handle input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--pf-border-strong);
  border-radius: var(--pf-radius-sm);
  background: var(--pf-surface);
  color: var(--pf-text);
  font-size: 0.88rem;
  font-family: inherit;
}
.handle__platform select:focus,
.handle__label input:focus,
.handle__handle input:focus {
  outline: none;
  border-color: var(--pf-primary);
  box-shadow: 0 0 0 3px var(--pf-primary-soft);
}
.handle__label { grid-column: auto; }
.handle__remove {
  align-self: end;
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  border-radius: var(--pf-radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--pf-text-3);
  cursor: pointer;
  transition: all 0.15s ease;
}
.handle__remove:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: var(--pf-danger);
}

/* ============================================================
   PLATFORM CREDENTIALS (per-tab)
============================================================ */
.pf-creds { display: flex; flex-direction: column; gap: 10px; }
.cred-status {
  flex: 0 0 auto;
  padding: 3px 10px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .02em;
  white-space: nowrap;
}
.cred {
  position: relative;
  background: var(--pf-surface);
  border: 1px solid var(--pf-border);
  border-radius: var(--pf-radius);
  box-shadow: var(--pf-shadow-sm);
  overflow: hidden;
}
.cred__head {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px;
  background: linear-gradient(180deg, var(--pf-surface-alt), transparent);
  border-bottom: 1px solid var(--pf-border);
}
.cred__icon {
  width: 32px; height: 32px;
  border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--pf-violet-soft);
  color: var(--pf-violet);
  font-size: 1rem;
  flex-shrink: 0;
}
.cred__title { flex: 1; min-width: 0; }
.cred__title strong {
  display: block; font-size: 0.92rem; color: var(--pf-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cred__title span { font-size: 0.72rem; color: var(--pf-text-3); }
.cred__remove {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--pf-text-3);
  cursor: pointer; transition: all 0.15s ease;
}
.cred__remove:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: var(--pf-danger);
}
.cred__body { padding: 14px; display: flex; flex-direction: column; gap: 12px; }

.cred__acl-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding-top: 8px;
  border-top: 1px dashed var(--pf-border);
}
.cred__acl-head h5 {
  margin: 0; font-size: 0.82rem; font-weight: 700;
  color: var(--pf-text);
  display: inline-flex; align-items: center; gap: 6px;
}
.cred__acl-count { font-size: 0.72rem; color: var(--pf-text-3); }
.cred__acl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 6px;
}
.cred__acl-item {
  position: relative;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px;
  border-radius: var(--pf-radius-sm);
  background: var(--pf-surface-alt);
  border: 1px solid var(--pf-border);
  cursor: pointer; user-select: none;
  transition: all 0.15s ease;
}
.cred__acl-item input[type="checkbox"] { position: absolute; opacity: 0; pointer-events: none; }
.cred__acl-item:hover { border-color: var(--pf-primary); }
.cred__acl-item--on {
  border-color: var(--pf-primary);
  background: var(--pf-primary-soft);
}
.cred__acl-item--inactive { opacity: 0.55; }
.cred__acl-avatar {
  width: 28px; height: 28px;
  border-radius: 50%; overflow: hidden;
  background: var(--pf-primary-soft); color: var(--pf-primary);
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 0.74rem;
  flex-shrink: 0;
}
.cred__acl-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cred__acl-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.cred__acl-info strong {
  font-size: 0.82rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cred__acl-info span { font-size: 0.7rem; color: var(--pf-text-3); }
.cred__acl-toggle {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 2px 6px; border-radius: 999px;
  border: 1px solid var(--pf-border-strong);
  background: var(--pf-surface);
  color: var(--pf-text-3);
  font-size: 0.66rem; font-weight: 700;
  cursor: pointer; flex-shrink: 0;
}
.cred__acl-toggle--on {
  background: rgba(34, 197, 94, 0.14);
  border-color: rgba(34, 197, 94, 0.4);
  color: var(--pf-success);
}
.cred__acl-toggle .pf-mgr__dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.cred__reveal-block {
  display: flex; flex-direction: column; gap: 6px;
  padding: 10px 12px;
  background: #fff7ed;
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-radius: var(--pf-radius-sm);
  font-size: 0.86rem;
}
.cred__reveal-block code {
  background: rgba(15, 23, 42, 0.06);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.86rem;
}
.pf-empty {
  margin: 0; padding: 14px;
  font-style: italic; color: var(--pf-text-3);
  background: var(--pf-surface-alt);
  border: 1px dashed var(--pf-border);
  border-radius: var(--pf-radius-sm);
  font-size: 0.86rem; text-align: center;
}
.pf-callout {
  margin: 0; padding: 10px 14px;
  background: var(--pf-warning-soft);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--pf-radius-sm);
  color: var(--pf-warning);
  font-size: 0.82rem;
}

/* ============================================================
   TABS
============================================================ */
.pf-tabs {
  display: flex; gap: 4px;
  padding: 0 20px;
  border-bottom: 1px solid var(--pf-border);
  overflow-x: auto;
  background: var(--pf-surface-alt);
}
.pf-tab {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 16px;
  border: none; background: transparent;
  font-size: 0.88rem; font-weight: 600;
  color: var(--pf-text-2); cursor: pointer;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.pf-tab:hover { color: var(--pf-text); }
.pf-tab--active { color: var(--pf-primary); border-bottom-color: var(--pf-primary); }
.pf-tab__icon { font-size: 1rem; line-height: 1; }

.pf-tab__panel { display: flex; flex-direction: column; gap: 16px; padding: 20px; }
.pf-tab__empty {
  padding: 32px 20px; text-align: center;
  color: var(--pf-text-2); font-size: 0.92rem;
}

/* ============================================================
   SUBSECTION
============================================================ */
.pf-sub { display: flex; flex-direction: column; gap: 10px; }
.pf-sub__head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
}
.pf-sub__head h3 { margin: 0; font-size: 0.96rem; font-weight: 700; color: var(--pf-text); }
.pf-sub__actions { display: flex; gap: 6px; align-items: center; }
.pf-search {
  padding: 6px 10px;
  border: 1px solid var(--pf-border-strong);
  border-radius: var(--pf-radius-sm);
  font-size: 0.82rem;
  background: var(--pf-surface);
  min-width: 200px;
}
.pf-search:focus {
  outline: none;
  border-color: var(--pf-primary);
  box-shadow: 0 0 0 3px var(--pf-primary-soft);
}

/* ============================================================
   DEVICE CARD (redesigned, production-grade)
============================================================ */
.device {
  background: var(--pf-surface);
  border: 1px solid var(--pf-border);
  border-radius: var(--pf-radius);
  box-shadow: var(--pf-shadow-sm);
  overflow: hidden;
  transition: border-color 0.15s ease;
}
.device:hover { border-color: var(--pf-border-strong); }

.device__head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px;
  background: linear-gradient(180deg, var(--pf-surface-alt), transparent);
  border-bottom: 1px solid var(--pf-border);
}
.device__index {
  font-size: 0.7rem; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--pf-text-3);
}
.device__remove {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--pf-text-3);
  cursor: pointer;
  transition: all 0.15s ease;
}
.device__remove:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: var(--pf-danger);
}

.device__body {
  padding: 14px;
  display: flex; flex-direction: column; gap: 12px;
}

.device__row {
  display: grid;
  gap: 12px;
}
.device__row--name {
  grid-template-columns: 2fr 1fr;
}
.device__row--buyer {
  grid-template-columns: minmax(280px, max-content) 1fr;
  align-items: end;
}
.device__name { min-width: 0; }
.device__price { min-width: 200px; }
.device__buyer-type { min-width: 280px; }
.device__buyer-user { min-width: 0; }

/* Segmented control */
.pf-seg {
  display: inline-flex;
  background: var(--pf-surface-alt);
  border: 1px solid var(--pf-border);
  border-radius: 10px;
  padding: 3px;
  gap: 2px;
  width: 100%;
}
.pf-seg__opt {
  flex: 1;
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 7px;
  font-size: 0.84rem; font-weight: 600;
  color: var(--pf-text-2);
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  white-space: nowrap;
}
.pf-seg__opt input { position: absolute; opacity: 0; pointer-events: none; }
.pf-seg__opt:hover { color: var(--pf-text); background: rgba(15, 23, 42, 0.04); }
.pf-seg__opt--on {
  background: var(--pf-surface);
  color: var(--pf-primary);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}
.pf-seg__icon { font-size: 0.95rem; line-height: 1; }

/* Remote access sub-card */
.device__remote {
  border: 1px solid var(--pf-border);
  border-radius: var(--pf-radius);
  background: var(--pf-surface-alt);
  overflow: hidden;
  transition: all 0.18s ease;
}
.device__remote--on {
  background: linear-gradient(180deg, #fff7ed, #fffbeb);
  border-color: rgba(245, 158, 11, 0.35);
}
.device__remote-head {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px;
}
.device__remote-title { display: flex; flex-direction: column; flex: 1; line-height: 1.3; }
.device__remote-title strong { font-size: 0.88rem; color: var(--pf-text); }
.device__remote-sub { font-size: 0.74rem; color: var(--pf-text-2); }
.device__remote-body {
  padding: 12px;
  border-top: 1px solid rgba(245, 158, 11, 0.2);
  background: rgba(255, 255, 255, 0.5);
}

/* ============================================================
   TRANSACTIONS
============================================================ */
.pf-tx-add {
  background: var(--pf-primary-soft);
  border: 1px solid rgba(37, 99, 235, 0.25);
  border-radius: var(--pf-radius);
  padding: 14px;
  display: flex; flex-direction: column; gap: 12px;
}
.pf-tx-add__preview {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 10px;
  align-items: end;
  padding-top: 10px;
  border-top: 1px dashed rgba(37, 99, 235, 0.25);
}
.pf-tx-add__cell {
  display: flex; flex-direction: column; gap: 2px;
  padding: 6px 12px;
  background: var(--pf-surface);
  border-radius: var(--pf-radius-sm);
  border: 1px solid var(--pf-border);
}
.pf-tx-add__cell--profit {
  background: var(--pf-success-soft);
  border-color: rgba(34, 197, 94, 0.35);
}
.pf-tx-add__cell-label {
  font-size: 0.64rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--pf-text-3);
}
.pf-tx-add__cell-value {
  font-size: 0.92rem; font-weight: 800;
  color: var(--pf-text);
  font-variant-numeric: tabular-nums;
}
.pf-tx-add__cell--profit .pf-tx-add__cell-value { color: var(--pf-success); }
.pf-tx-add__actions { display: flex; gap: 6px; justify-content: flex-end; }

.pf-tx-table {
  display: flex; flex-direction: column;
  border: 1px solid var(--pf-border);
  border-radius: var(--pf-radius);
  overflow: hidden;
  background: var(--pf-surface);
}
.pf-tx-table__head,
.pf-tx-row {
  display: grid;
  grid-template-columns: 110px 1fr 110px 110px 110px 36px;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  font-size: 0.84rem;
}
.pf-tx-table__head {
  background: var(--pf-surface-alt);
  border-bottom: 1px solid var(--pf-border);
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  color: var(--pf-text-3);
}
.pf-tx-table__num { text-align: right; }
.pf-tx-row + .pf-tx-row { border-top: 1px solid var(--pf-border); }
.pf-tx-row__date { color: var(--pf-text-2); font-variant-numeric: tabular-nums; }
.pf-tx-row__desc { color: var(--pf-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pf-tx-row__num { text-align: right; font-variant-numeric: tabular-nums; color: var(--pf-text); }
.pf-tx-row__num--profit { color: var(--pf-success); font-weight: 700; }
.pf-tx-row__remove {
  width: 24px; height: 24px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--pf-text-3);
  cursor: pointer;
  font-size: 1rem; line-height: 1;
}
.pf-tx-row__remove:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: var(--pf-danger);
}
.pf-tx-row--total {
  background: var(--pf-surface-alt);
  border-top: 2px solid var(--pf-border-strong);
  font-weight: 700;
  color: var(--pf-text);
}

/* ============================================================
   MANAGER GRID
============================================================ */
.pf-mgr-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 8px;
}
.pf-mgr {
  position: relative;
  display: flex; align-items: center; gap: 10px;
  padding: 10px;
  border-radius: var(--pf-radius);
  background: var(--pf-surface);
  border: 1px solid var(--pf-border);
  cursor: pointer; user-select: none;
  transition: all 0.15s ease;
}
.pf-mgr input[type="checkbox"] { position: absolute; opacity: 0; pointer-events: none; }
.pf-mgr:hover { border-color: var(--pf-primary); background: var(--pf-primary-soft); }
.pf-mgr--on {
  border-color: var(--pf-primary);
  background: var(--pf-primary-soft);
  box-shadow: 0 0 0 1px var(--pf-primary);
}
.pf-mgr--inactive { opacity: 0.65; }

.pf-mgr__avatar {
  width: 36px; height: 36px;
  border-radius: 50%; overflow: hidden;
  background: var(--pf-primary-soft); color: var(--pf-primary);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 0.82rem; flex-shrink: 0;
}
.pf-mgr__avatar img { width: 100%; height: 100%; object-fit: cover; }
.pf-mgr__info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.pf-mgr__info strong {
  font-size: 0.86rem; color: var(--pf-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pf-mgr__info span { font-size: 0.74rem; }

.pf-mgr__toggle {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 999px;
  border: 1px solid var(--pf-border-strong);
  background: var(--pf-surface);
  color: var(--pf-text-3);
  font-size: 0.7rem; font-weight: 700;
  cursor: pointer; flex-shrink: 0;
}
.pf-mgr__toggle .pf-mgr__dot {
  width: 6px; height: 6px;
  border-radius: 50%; background: currentColor;
}
.pf-mgr__toggle--on {
  background: rgba(34, 197, 94, 0.14);
  border-color: rgba(34, 197, 94, 0.4);
  color: var(--pf-success);
}

/* ============================================================
   ERROR + FOOTER
============================================================ */
.pf-error {
  padding: 12px 14px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--pf-radius-sm);
  color: #b91c1c;
  font-size: 0.86rem;
}
.pf-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--pf-border);
}

/* ============================================================
   RESPONSIVE
============================================================ */
@media (max-width: 1024px) {
  .pf-grid--4 { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
  .pf-bar__inner { padding: 8px 12px; gap: 8px; }
  .pf-bar__back-label { display: none; }
  .pf-bar__actions .btn { padding: 7px 12px; }
  .pf-canvas { padding: 16px 12px 32px; }

  .pf-hero { grid-template-columns: 80px 1fr; padding: 14px; gap: 14px; }
  .pf-hero__avatar { width: 80px; height: 80px; }
  .pf-hero__avatar-fallback { font-size: 1.5rem; }

  .pf-card__head { padding: 14px 16px; gap: 10px; }
  .pf-card__body { padding: 16px; gap: 12px; }
  .pf-card__icon { width: 32px; height: 32px; font-size: 0.95rem; }
  .pf-card__title h2 { font-size: 0.96rem; }
  .pf-card__title p { font-size: 0.76rem; }

  .pf-grid--2,
  .pf-grid--3,
  .pf-grid--4 { grid-template-columns: 1fr; }
  .pf-field--span2,
  .pf-field--span3 { grid-column: span 1; }

  .pf-tabs { padding: 0 12px; }
  .pf-tab { padding: 10px 12px; font-size: 0.84rem; }
  .pf-tab__panel { padding: 16px; gap: 14px; }

  .pf-sub__head { flex-direction: column; align-items: flex-start; gap: 8px; }
  .pf-search { width: 100%; }

  .device__row--name,
  .device__row--buyer { grid-template-columns: 1fr; }
  .device__price,
  .device__buyer-type,
  .device__buyer-user { min-width: 0; }

  .pf-mgr-grid { grid-template-columns: 1fr; }

  .pf-tx-table__head,
  .pf-tx-row {
    grid-template-columns: 1fr 1fr 1fr;
    font-size: 0.78rem;
  }
  .pf-tx-table__head span:nth-child(1),
  .pf-tx-row__date { grid-column: 1 / 4; padding-bottom: 4px; border-bottom: 1px dashed var(--pf-border); }
  .pf-tx-table__head span:nth-child(2),
  .pf-tx-row__desc { grid-column: 1 / 4; padding-bottom: 4px; }
  .pf-tx-row__remove { grid-column: 3 / 4; justify-self: end; }

  .pf-tx-add__preview { grid-template-columns: 1fr 1fr; }
  .pf-tx-add__actions { grid-column: 1 / -1; }
}
@media (max-width: 480px) {
  .pf-hero { grid-template-columns: 1fr; text-align: center; }
  .pf-hero__avatar { margin: 0 auto; }
  .pf-hero__selects { justify-content: center; }
  .pf-hero__name { text-align: center; }
}
</style>
