(function (global) {
  'use strict';

  const SESSION_KEY = 'drop4life:session';
  const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  function tr(key, fallback, vars) {
    if (typeof global.trMsg === 'function' && fallback && /[\u0600-\u06FF]/.test(String(fallback))) {
      fallback = global.trMsg(fallback);
    }
    if (typeof global.t === 'function') return global.t(key, fallback, vars);
    if (typeof global.tf === 'function' && vars) return global.tf(key, vars, fallback);
    return fallback != null ? fallback : key;
  }

  function localizeApiMessage(message) {
    if (typeof global.trMsg === 'function') return global.trMsg(message);
    return message;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const PRODUCT_TYPES = [
    { id: 'Whole', days: 42 },
    { id: 'RBC', days: 42 },
    { id: 'Plasma', days: 365 },
    { id: 'Platelets', days: 5 },
  ];

  function productTypeLabel(id) {
    return tr(`product.${id}`, id);
  }
  const DEFAULT_CRITICAL_LIMITS = {
    'A+': 30, 'A-': 15, 'B+': 25, 'B-': 15,
    'AB+': 20, 'AB-': 10, 'O+': 40, 'O-': 25,
  };

  function getApiBase() {
    return '/api';
  }

  function getSessionToken() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return parsed && parsed.token ? parsed.token : '';
    } catch (_) {
      return '';
    }
  }

  function emptyBloodInventoryTemplate() {
    const inv = {};
    BLOOD_TYPES.forEach((type) => {
      inv[type] = {};
      PRODUCT_TYPES.forEach((product) => {
        inv[type][product.id] = {
          available: 0,
          reserved: 0,
          issued: 0,
          expired: 0,
          criticalLimit: DEFAULT_CRITICAL_LIMITS[type] || 20,
        };
      });
    });
    return inv;
  }

  function ensureBloodTypeSlot(base, bloodType) {
    if (base[bloodType]) return base[bloodType];
    base[bloodType] = {};
    PRODUCT_TYPES.forEach((product) => {
      base[bloodType][product.id] = {
        available: 0,
        reserved: 0,
        issued: 0,
        expired: 0,
        criticalLimit: DEFAULT_CRITICAL_LIMITS[bloodType] || 20,
      };
    });
    return base[bloodType];
  }

  function normalizeInventory(data) {
    if (!data || typeof data !== 'object') return emptyBloodInventoryTemplate();
    const base = emptyBloodInventoryTemplate();
    Object.keys(data).forEach((rawKey) => {
      let bloodType = rawKey;
      let entry = data[rawKey];
      if (!entry || typeof entry !== 'object') return;

      let flatProduct = null;
      if (String(rawKey).includes('|')) {
        const parts = String(rawKey).split('|');
        bloodType = parts[0];
        flatProduct = parts[1] || null;
      }

      if ('available' in entry) {
        const slot = ensureBloodTypeSlot(base, bloodType);
        const counts = {
          available: Number(entry.available) || 0,
          reserved: Number(entry.reserved) || 0,
          issued: Number(entry.issued) || 0,
          expired: Number(entry.expired) || 0,
          criticalLimit: Number(entry.criticalLimit ?? entry.critical_limit) || DEFAULT_CRITICAL_LIMITS[bloodType] || 20,
        };
        if (flatProduct && slot[flatProduct]) {
          slot[flatProduct] = { ...slot[flatProduct], ...counts };
          return;
        }
        slot.RBC = { ...slot.RBC, ...counts };
        return;
      }
      PRODUCT_TYPES.forEach((product) => {
        const item = entry[product.id] || {};
        base[bloodType][product.id] = {
          available: Number(item.available) || 0,
          reserved: Number(item.reserved) || 0,
          issued: Number(item.issued) || 0,
          expired: Number(item.expired) || 0,
          criticalLimit: Number(item.criticalLimit ?? item.critical_limit) || DEFAULT_CRITICAL_LIMITS[bloodType] || 20,
        };
      });
    });
    return base;
  }

  function productLabel(productType) {
    return productTypeLabel(productType);
  }

  function getInventoryStock(bloodType, productType = 'RBC') {
    return Number(global.bloodInventory?.[bloodType]?.[productType]?.available) || 0;
  }

  async function request(endpoint, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = Object.assign({ Accept: 'application/json' }, options.headers || {});
    const token = getSessionToken();

    if (token) {
      headers.Authorization = `Token ${token}`;
    }

    const init = { method, headers, credentials: 'same-origin' };

    if (options.body !== undefined && method !== 'GET' && method !== 'HEAD') {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }

    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${getApiBase()}${path}`;

    let response;
    try {
      response = await fetch(url, init);
    } catch (err) {
      const error = new Error(tr('msg.api.connectionFailed', 'Could not connect to server.'));
      error.cause = err;
      throw error;
    }

    let payload = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        payload = await response.json();
      } catch (_) {
        payload = null;
      }
    } else if (response.status !== 204) {
      payload = await response.text();
    }

    if (!response.ok) {
      const detail = payload && (payload.detail || payload.message);
      const error = new Error(
        typeof detail === 'string'
          ? localizeApiMessage(detail)
          : Array.isArray(detail)
            ? detail.map((part) => localizeApiMessage(part)).join(' ')
            : tr('msg.api.httpError', `Error ${response.status}`, { status: response.status })
      );
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  function applyBootstrap(data) {
    if (!data || typeof data !== 'object') return;

    if (data.bloodInventory !== undefined) {
      global.bloodInventory = normalizeInventory(data.bloodInventory);
    }
    if (data.bloodBags !== undefined) global.bloodBags = data.bloodBags || [];
    if (data.donors !== undefined) global.donors = data.donors || [];
    if (data.requests !== undefined) global.requests = data.requests || [];
    if (data.hospitals !== undefined) global.hospitals = data.hospitals || [];
    if (data.hospitalDeliveryRecords !== undefined) {
      global.hospitalDeliveryRecords = data.hospitalDeliveryRecords || [];
    }
    if (data.disposalLogs !== undefined) global.disposalLogs = data.disposalLogs || [];
    if (data.auditLogs !== undefined) global.auditLogs = data.auditLogs || [];
    if (data.notifications !== undefined) global.notifications = data.notifications || [];
    if (data.messages !== undefined) global.messages = data.messages || [];
    if (data.storageUnits !== undefined) global.storageUnits = data.storageUnits || [];
    if (data.accounts !== undefined) global.accounts = data.accounts || [];
    if (data.pendingDonors !== undefined) global.pendingDonors = data.pendingDonors || {};
    if (data.beneficiaries !== undefined) global.beneficiaries = data.beneficiaries || [];
    if (data.dashboardStats !== undefined) global.dashboardStats = data.dashboardStats || {};
    if (data.superAdminContact !== undefined) global.superAdminContact = data.superAdminContact || null;

    if (data.storageConfig !== undefined && data.storageConfig) {
      global.storageConfig = Object.assign({}, global.storageConfig || {}, data.storageConfig);
    }

    if (data.currentSession) {
      global.currentUser = Object.assign({}, global.currentUser || {}, {
        username: data.currentSession.username,
        role: data.currentSession.role,
        role_code: data.currentSession.role_code,
        role_label: data.currentSession.role_label,
        name: data.currentSession.name,
        email: data.currentSession.email || '',
        phone: data.currentSession.phone || '',
        is_superuser: Boolean(data.currentSession.is_superuser),
        token: getSessionToken(),
      });
      if (data.currentSession.token) {
        global.__sessionToken = data.currentSession.token;
      }
    }
  }

  function saveAuthSession(user) {
    if (!user) return;
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          username: user.username,
          token: user.token || global.__sessionToken || getSessionToken(),
          name: user.name,
          role: user.role,
          role_code: user.role_code,
          is_superuser: user.is_superuser,
        })
      );
    } catch (_) {}
    global.currentUser = user;
    if (user.token) global.__sessionToken = user.token;
  }

  function clearAuthSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (_) {}
    global.currentUser = null;
    global.__sessionToken = '';
  }

  function isPageReload() {
    try {
      const navEntries = performance.getEntriesByType?.('navigation') || [];
      if (navEntries[0] && navEntries[0].type === 'reload') return true;
      if (performance.navigation && performance.navigation.type === 1) return true;
    } catch (_) {}
    return false;
  }

  function clearAuthSessionOnReload() {
    if (isPageReload()) clearAuthSession();
  }

  function isLoggedIn() {
    return Boolean(getSessionToken() && global.currentUser && global.currentUser.username);
  }

  function restoreSessionUser() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.token || !parsed.username) return null;
      global.__sessionToken = parsed.token;
      global.currentUser = {
        username: parsed.username,
        name: parsed.name || parsed.username,
        role: parsed.role,
        role_code: parsed.role_code,
        is_superuser: Boolean(parsed.is_superuser),
        token: parsed.token,
      };
      return global.currentUser;
    } catch (_) {
      return null;
    }
  }

  const Drop4LifeAPI = {
    request,
    applyBootstrap,
    saveAuthSession,
    clearAuthSession,
    clearAuthSessionOnReload,
    isLoggedIn,
    restoreSessionUser,

    async login(username, password) {
      const account = await request('/accounts/login/', {
        method: 'POST',
        body: { username, password },
      });
      if (account && account.token) {
        global.__sessionToken = account.token;
        account.token = account.token;
      }
      return account;
    },

    async logout() {
      try {
        await request('/accounts/logout/', { method: 'POST', body: {} });
      } catch (_) {}
    },

    async loadBootstrap() {
      return request('/bootstrap/');
    },

    async loadLiveSync() {
      return request(`/live-sync/?_=${Date.now()}`);
    },

    async loadDashboardStats() {
      return request('/dashboard-stats/');
    },

    async loadBloodOutputStats(months = 12) {
      return request(`/blood-output-stats/?months=${months}`);
    },

    async clearBloodOutputStats(password) {
      return request('/operations/clear-blood-output-stats/', {
        method: 'POST',
        body: { password },
      });
    },

    async refreshAiPredictions() {
      const panel = document.getElementById('ai-predictions-panel');
      const statusEl = document.getElementById('ai-model-status');
      if (!panel) return null;
      try {
        const data = await request('/ai-predictions/');
        if (!data || !data.insights || !data.insights.length) {
          if (statusEl) {
            statusEl.innerHTML = `<div class="ai-empty-icon">🧠</div><strong>${tr('ai.emptyStable', 'No predictions — inventory stable.')}</strong>`;
          }
          return data;
        }
        panel.innerHTML = data.insights.map((item) => {
          const title = (typeof global.translateAiText === 'function' ? global.translateAiText(item.title) : item.title) || tr('ai.defaultTitle', 'Prediction');
          const body = (typeof global.translateAiText === 'function' ? global.translateAiText(item.text || item.message) : (item.text || item.message)) || '';
          const risk = item.riskLevel && typeof global.translateAiText === 'function' ? global.translateAiText(item.riskLevel) : (item.riskLevel || '');
          return `
          <div class="ai-insight-card" style="padding:0.85rem; border-radius:12px; border:1px solid rgba(148,163,184,0.2); margin-bottom:0.65rem; background:rgba(255,255,255,0.9);">
            <div style="font-weight:700; margin-bottom:0.35rem;">${escapeHtml(title)}</div>
            <div style="font-size:13px; color:#475569;">${escapeHtml(body)}</div>
            ${item.bloodType ? `<div style="margin-top:0.35rem; font-size:12px;"><span class="badge badge-info">${escapeHtml(item.bloodType)}</span> ${escapeHtml(risk)}</div>` : ''}
          </div>
        `;
        }).join('');
        return data;
      } catch (err) {
        if (statusEl) {
          statusEl.innerHTML = `<div class="ai-empty-icon">⚠️</div><strong>${err.message || tr('ai.loadFailed', 'Could not load predictions')}</strong>`;
        }
        return null;
      }
    },

    async loadBeneficiaries(page, pageSize) {
      const p = page || global.beneficiariesPage || 1;
      const size = pageSize || 10;
      const data = await request(`/beneficiaries/?page=${p}&page_size=${size}`);
      global.beneficiaries = data.results || [];
      global.beneficiariesTotal = data.count || 0;
      global.beneficiariesPage = data.page || p;
      return data;
    },

    async createBeneficiary(body) {
      return request('/beneficiaries/', { method: 'POST', body });
    },

    async updateBeneficiary(id, body) {
      return request(`/beneficiaries/${id}/`, { method: 'PATCH', body });
    },

    async deleteBeneficiary(id) {
      return request(`/beneficiaries/${id}/`, { method: 'DELETE' });
    },

    async createHospital(body) {
      return request('/hospitals/', { method: 'POST', body });
    },

    async updateHospital(name, body) {
      return request(`/hospitals/${encodeURIComponent(name)}/`, { method: 'PATCH', body });
    },

    async deleteHospital(name) {
      return request(`/hospitals/${encodeURIComponent(name)}/`, { method: 'DELETE' });
    },

    async createRequest(body) {
      return request('/requests/', { method: 'POST', body });
    },

    async updateRequest(id, body) {
      return request(`/requests/${encodeURIComponent(id)}/`, { method: 'PATCH', body });
    },

    async deleteRequest(id) {
      return request(`/requests/${encodeURIComponent(id)}/`, { method: 'DELETE' });
    },

    async updateRequestStatus(requestId, status) {
      return request('/operations/update-request-status/', {
        method: 'POST',
        body: { requestId, status },
      });
    },

    async deliverRequest(body) {
      return request('/operations/deliver-request/', { method: 'POST', body });
    },

    async addDonation(body) {
      return request('/operations/add-donation/', { method: 'POST', body });
    },

    async submitLab(body) {
      return request('/operations/submit-lab/', { method: 'POST', body });
    },

    async dispose(body) {
      return request('/operations/dispose/', { method: 'POST', body });
    },

    async transferBag(body) {
      return request('/operations/transfer-bag/', { method: 'POST', body });
    },

    async updateBloodBag(bagId, body) {
      return request(`/blood-bags/${encodeURIComponent(bagId)}/`, { method: 'PATCH', body });
    },

    async deleteBloodBag(bagId) {
      return request(`/blood-bags/${encodeURIComponent(bagId)}/`, { method: 'DELETE' });
    },

    async updateDonor(id, body) {
      return request(`/donors/${encodeURIComponent(id)}/`, { method: 'PATCH', body });
    },

    async deleteDonor(id) {
      return request(`/donors/${encodeURIComponent(id)}/`, { method: 'DELETE' });
    },

    async updateDisposalLog(dbId, body) {
      return request(`/disposal-logs/${dbId}/`, { method: 'PATCH', body });
    },

    async deleteDisposalLog(dbId) {
      return request(`/disposal-logs/${dbId}/`, { method: 'DELETE' });
    },

    async deleteHospitalDelivery(recordId) {
      return request(`/hospital-deliveries/${encodeURIComponent(recordId)}/`, { method: 'DELETE' });
    },

    async saveStorageConfig(body) {
      return request('/operations/save-storage-config/', { method: 'POST', body });
    },

    async resetOperationalData() {
      return request('/operations/reset-data/', { method: 'POST', body: {} });
    },

    async createAccount(body) {
      return request('/accounts/', { method: 'POST', body });
    },

    async updateAccount(username, body) {
      return request(`/accounts/${encodeURIComponent(username)}/`, { method: 'PATCH', body });
    },

    async deleteAccount(username) {
      return request(`/accounts/${encodeURIComponent(username)}/`, { method: 'DELETE' });
    },

    async updateProfile(body) {
      return request('/accounts/me/', { method: 'PATCH', body });
    },

    async createNotification(body) {
      return request('/notifications/', { method: 'POST', body });
    },

    async updateNotification(id, body) {
      return request(`/notifications/${id}/`, { method: 'PATCH', body });
    },

    async createMessage(body) {
      return request('/messages/', { method: 'POST', body });
    },

    async updateMessage(id, body) {
      return request(`/messages/${id}/`, { method: 'PATCH', body });
    },

    async deleteMessage(id) {
      return request(`/messages/${encodeURIComponent(id)}/`, { method: 'DELETE' });
    },

    async pushAudit(user, role, action, details) {
      const now = new Date();
      const timeStr = now.toISOString().replace('T', ' ').substring(0, 16);
      return request('/audit-logs/', {
        method: 'POST',
        body: { time: timeStr, user, role, action, details },
      });
    },
  };

  global.emptyBloodInventoryTemplate = emptyBloodInventoryTemplate;
  global.PRODUCT_TYPES = PRODUCT_TYPES;
  global.productLabel = productLabel;
  global.getInventoryStock = getInventoryStock;
  global.Drop4LifeAPI = Drop4LifeAPI;
})(typeof window !== 'undefined' ? window : globalThis);
