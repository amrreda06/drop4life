const API_BASE =
  (typeof window !== 'undefined' && window.__DROP4LIFE_API_URL__) || '/api';
const AUTH_STORAGE_KEY = 'drop4life_user';
const AUTH_STORAGE_PREFIX = 'drop4life_';
const TOKEN_STORAGE_KEY = 'token';

function toSafeHeaderValue(value, fallback = '') {
  if (value == null || value === undefined) return fallback;
  const str = String(value).trim();
  if (!str) return fallback;
  const ascii = str.replace(/[^\x20-\x7E]/g, '');
  return ascii || fallback;
}

function getCleanAuthToken() {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (raw == null || raw === undefined) return '';
    const token = String(raw).trim();
    if (!token || token === 'null' || token === 'undefined') return '';
    return toSafeHeaderValue(token, '');
  } catch (_) {
    return '';
  }
}

function readTokenFromStoredSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return '';
    const user = JSON.parse(raw);
    return toSafeHeaderValue(user?.token || '', '');
  } catch (_) {
    return '';
  }
}

function resolveAuthToken() {
  // Prefer the current in-memory session token if the user is logged in.
  const liveToken = toSafeHeaderValue(
    window.__sessionToken || (window.currentUser && window.currentUser.token) || '',
    ''
  );
  if (liveToken) {
    persistAuthToken(liveToken);
    return liveToken;
  }

  const fromWindow = toSafeHeaderValue(window.__sessionToken || '', '');
  if (fromWindow) {
    persistAuthToken(fromWindow);
    return fromWindow;
  }

  const fromUser = window.currentUser && window.currentUser.token;
  const fromUserToken = toSafeHeaderValue(fromUser || '', '');
  if (fromUserToken) {
    persistAuthToken(fromUserToken);
    return fromUserToken;
  }

  const fromSession = readTokenFromStoredSession();
  if (fromSession) {
    persistAuthToken(fromSession);
    return fromSession;
  }

  const fromStorage = getCleanAuthToken();
  if (fromStorage) {
    window.__sessionToken = fromStorage;
    return fromStorage;
  }

  return '';
}

function persistAuthToken(token) {
  const clean = toSafeHeaderValue(String(token || '').trim(), '');
  if (!clean) return '';
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, clean);
  } catch (_) {}
  window.__sessionToken = clean;
  return clean;
}

function clearStoredAuthSession() {
  bumpAuthGeneration();
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    Object.keys(localStorage).forEach((key) => {
      if (key === AUTH_STORAGE_KEY || key.startsWith(AUTH_STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (_) {}
  window.currentUser = null;
  window.__sessionToken = '';
  setAuthState('anonymous', null);
  authBootstrapPromise = null;
}

function saveAuthSession(user) {
  if (!user || !user.username) return;
  const token = persistAuthToken(user.token || window.__sessionToken || '');
  const payload = {
    username: user.username,
    role: user.role,
    name: user.name || user.username || '',
    email: user.email || '',
    is_superuser: Boolean(user.is_superuser),
    token,
  };
  try {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {}
  window.currentUser = payload;
  setAuthState('authenticated', payload);
}

function restoreAuthSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!user || !user.username) return null;
    window.currentUser = user;
    const token = getCleanAuthToken() || persistAuthToken(user.token || '') || resolveAuthToken();
    if (token) {
      user.token = token;
      window.__sessionToken = token;
      window.currentUser = user;
    }
    return user;
  } catch (_) {
    return null;
  }
}

function getAuthToken() {
  return resolveAuthToken();
}

function getCookie(name) {
  if (typeof document === 'undefined' || !document.cookie) return '';
  const pattern = '(?:^|; )' + String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)';
  const match = document.cookie.match(new RegExp(pattern));
  return match ? decodeURIComponent(match[1]) : '';
}

function getCsrfToken() {
  return toSafeHeaderValue(getCookie('csrftoken'), '');
}

function buildAuthHeaders(extraHeaders = {}) {
  const headers = {};
  Object.entries(extraHeaders || {}).forEach(([key, value]) => {
    if (value != null && value !== undefined && value !== '') {
      headers[key] = toSafeHeaderValue(value);
    }
  });

  const token = resolveAuthToken();
  if (token) {
    headers.Authorization = 'Token ' + token;
  }

  return headers;
}

function buildRequestHeaders(options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const skipAuth = Boolean(options.skipAuth);
  const baseHeaders = { Accept: 'application/json', ...(options.headers || {}) };
  const rawHeaders = skipAuth ? baseHeaders : buildAuthHeaders(baseHeaders);
  const headers = {};
  Object.entries(rawHeaders).forEach(([key, value]) => {
    if (value != null && value !== undefined && value !== '') {
      headers[key] = toSafeHeaderValue(value);
    }
  });

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-CSRFToken'] = csrfToken;
    }
  }

  const hasJsonBody = options.body !== undefined && options.body !== null && typeof options.body === 'object';
  if (hasJsonBody) {
    headers['Content-Type'] = 'application/json';
  }

  return { headers, hasJsonBody };
}

function resetLoginForm() {
  const form = document.getElementById('login-form');
  if (form) form.reset();
  const errorDiv = document.getElementById('login-error');
  if (errorDiv) {
    errorDiv.innerText = '';
    errorDiv.style.display = 'none';
  }
  const submitBtn = document.getElementById('login-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>تسجيل الدخول المأمن</span>';
  }
}

function showLoginScreen() {
  const authWrapper = document.getElementById('auth-wrapper');
  const appWrapper = document.getElementById('app-wrapper');
  if (authWrapper) authWrapper.style.display = 'flex';
  if (appWrapper) appWrapper.style.display = 'none';
  resetLoginForm();
}

let authInitDone = false;
let authInitResolve;
const authInitReady = new Promise((resolve) => {
  authInitResolve = resolve;
});

let authBootstrapPromise = null;
let loginPromise = null;
let authVerifyGeneration = 0;
let authState = { status: 'pending', user: null };

function bumpAuthGeneration() {
  authVerifyGeneration += 1;
  return authVerifyGeneration;
}

function isAuthVerifyStale(generation) {
  return generation !== authVerifyGeneration;
}

function setAuthState(status, user = null) {
  authState = { status, user: user || null };
  if (user) {
    window.currentUser = user;
  }
}

function finishAuthInit() {
  if (authInitDone) return;
  authInitDone = true;
  if (typeof authInitResolve === 'function') {
    authInitResolve();
  }
}

async function rawApiCall(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const method = options.method || 'GET';
  const skipAuth = Boolean(options.skipAuth);
  const { headers, hasJsonBody } = buildRequestHeaders({ ...options, method, skipAuth });

  const config = {
    method,
    headers,
    credentials: 'include',
  };
  if (options.body !== undefined && options.body !== null) {
    config.body = hasJsonBody ? JSON.stringify(options.body) : options.body;
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (_) {
    throw new Error('تعذر الاتصال بالخادم. تأكد أن الخادم يعمل.');
  }

  const text = await response.text();
  let data = null;
  if (text && text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw createApiError(parseApiError(data, response.status), response.status, data);
  }

  if (response.status === 204 || data === null || data === undefined) {
    return { success: true };
  }

  if (response.status === 201 && data && typeof data === 'object' && data.success === undefined) {
    return { ...data, success: true, created: true };
  }

  return data;
}

function userFromProfile(profile, tokenOverride) {
  if (!profile || !profile.username) return null;
  const token = tokenOverride !== undefined ? tokenOverride : resolveAuthToken();
  return {
    username: profile.username,
    role: profile.role,
    name: profile.name || profile.username || '',
    email: profile.email || '',
    is_superuser: Boolean(profile.is_superuser),
    token: token || '',
  };
}

async function tryRestoreSessionFromCookie(generation) {
  try {
    const profile = await rawApiCall('/accounts/me/', {
      method: 'GET',
      skipAuth: true,
    });
    if (isAuthVerifyStale(generation)) {
      return window.currentUser || null;
    }
    const user = userFromProfile(profile, resolveAuthToken());
    if (user) {
      saveAuthSession(user);
      setAuthState('authenticated', user);
      return user;
    }
  } catch (err) {
    if (err && err.status !== 401 && err.status !== 403) {
      if (!isAuthVerifyStale(generation) && authState.status !== 'authenticated') {
        setAuthState('anonymous', null);
      }
    }
  }
  return null;
}

async function verifySessionWithServer(startGeneration) {
  const generation = startGeneration !== undefined ? startGeneration : authVerifyGeneration;
  restoreAuthSession();

  if (isAuthVerifyStale(generation)) {
    return window.currentUser || null;
  }

  const cookieUser = await tryRestoreSessionFromCookie(generation);
  if (cookieUser) {
    return cookieUser;
  }

  if (isAuthVerifyStale(generation)) {
    return window.currentUser || null;
  }

  const token = resolveAuthToken();
  if (!token) {
    if (!isAuthVerifyStale(generation) && authState.status !== 'authenticated') {
      clearStoredAuthSession();
      setAuthState('anonymous', null);
    }
    return null;
  }

  try {
    const profile = await rawApiCall('/accounts/me/', {
      method: 'GET',
    });
    if (isAuthVerifyStale(generation)) {
      return window.currentUser || null;
    }
    const user = userFromProfile(profile, token);
    if (!user) {
      if (!isAuthVerifyStale(generation) && authState.status !== 'authenticated') {
        clearStoredAuthSession();
        setAuthState('anonymous', null);
      }
      return null;
    }
    saveAuthSession(user);
    setAuthState('authenticated', user);
    return user;
  } catch (err) {
    if (isAuthVerifyStale(generation)) {
      return window.currentUser || null;
    }

    if (err && (err.status === 401 || err.status === 403)) {
      try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      } catch (_) {}
      window.__sessionToken = '';

      const cookieRetryUser = await tryRestoreSessionFromCookie(generation);
      if (cookieRetryUser) {
        return cookieRetryUser;
      }

      if (!isAuthVerifyStale(generation) && authState.status !== 'authenticated') {
        clearStoredAuthSession();
        setAuthState('anonymous', null);
      }
      return null;
    }

    if (!isAuthVerifyStale(generation) && authState.status !== 'authenticated') {
      setAuthState('anonymous', null);
    }
    return null;
  }
}

async function bootstrapAuth() {
  if (authBootstrapPromise) {
    return authBootstrapPromise;
  }

  const generation = authVerifyGeneration;
  authBootstrapPromise = (async () => {
    const user = await verifySessionWithServer(generation);
    if (isAuthVerifyStale(generation)) {
      return window.currentUser || user;
    }
    finishAuthInit();
    if (!user && !isAuthVerifyStale(generation)) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showLoginScreen, { once: true });
      } else {
        showLoginScreen();
      }
    }
    return user;
  })();

  return authBootstrapPromise;
}

function initAuthOnLoad() {
  // Skip initial auth verification to prevent 401 errors on page load
  // Auth will be verified when needed (e.g., when user explicitly logs in).
  finishAuthInit();

  // Always show login screen - no auto-login from stored sessions.
  // Clear any stored session so the app starts in a clean unauthenticated state.
  clearStoredAuthSession();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showLoginScreen, { once: true });
  } else {
    showLoginScreen();
  }
}

initAuthOnLoad();

function emptyBloodInventoryTemplate() {
  const types = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const limits = { 'A+': 30, 'A-': 15, 'B+': 25, 'B-': 15, 'AB+': 20, 'AB-': 10, 'O+': 40, 'O-': 25 };
  const inv = {};
  types.forEach((t) => {
    inv[t] = { available: 0, reserved: 0, issued: 0, expired: 0, criticalLimit: limits[t] };
  });
  return inv;
}

const HTTP_STATUS_HINTS = {
  400: 'طلب غير صالح — تحقق من البيانات المدخلة.',
  401: 'انتهت الجلسة أو بيانات الدخول غير صحيحة. سجّل الدخول مجدداً.',
  403: 'ليس لديك صلاحية لتنفيذ هذا الإجراء.',
  404: 'المورد المطلوب غير موجود على الخادم.',
  409: 'تعارض في البيانات — قد يكون السجل موجوداً مسبقاً.',
  500: 'خطأ داخلي في الخادم. حاول لاحقاً أو راجع المسؤول.',
};

function parseApiError(data, status) {
  const hint = HTTP_STATUS_HINTS[status];
  let detail = '';

  if (!data) {
    detail = hint || `خطأ في الخادم (${status})`;
    return detail;
  }
  if (typeof data === 'string') {
    detail = data;
  } else if (typeof data.detail === 'string') {
    detail = data.detail;
  } else if (Array.isArray(data.detail)) {
    detail = data.detail.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join(' — ');
  } else if (typeof data.detail === 'object' && data.detail !== null) {
    detail = Object.entries(data.detail)
      .map(([key, value]) => {
        const msg = Array.isArray(value) ? value.join(', ') : String(value);
        return `${key}: ${msg}`;
      })
      .join(' — ');
  } else if (typeof data === 'object') {
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
      const value = data[firstKey];
      if (Array.isArray(value)) detail = value.join(' — ');
      else if (typeof value === 'string') detail = value;
    }
    if (!detail) {
      try {
        detail = JSON.stringify(data);
      } catch {
        detail = '';
      }
    }
  }

  if (!detail) {
    return hint || `خطأ في الخادم (${status})`;
  }
  if (hint && status >= 400) {
    return `${detail} (${hint})`;
  }
  return detail;
}

function createApiError(message, status, data) {
  const err = new Error(message);
  err.status = status;
  err.data = data;
  return err;
}

const Drop4LifeAPI = {
  async waitForAuthInit() {
    await authInitReady;
    resolveAuthToken();
  },

  getAuthState() {
    return { ...authState };
  },

  async verifySession() {
    return verifySessionWithServer();
  },

  async request(path, options = {}) {
    if (!options.skipAuth) {
      await this.waitForAuthInit();
      resolveAuthToken();

      if (authState.status === 'pending') {
        await bootstrapAuth();
      }

      if (!this.isLoggedIn()) {
        if (!options.skipAuthRedirect) {
          showLoginScreen();
        }
        throw createApiError('يجب تسجيل الدخول قبل إرسال هذا الطلب.', 401, null);
      }
    }

    const method = options.method || 'GET';
    const requestOptions = { ...options, method };
    let retried = false;

    while (true) {
      try {
        return await rawApiCall(path, requestOptions);
      } catch (err) {
        const isAuthFailure =
          err &&
          (err.status === 401 ||
            (err.status === 403 &&
              typeof err.data === 'object' &&
              err.data &&
              typeof err.data.detail === 'string' &&
              err.data.detail.includes('تسجيل الدخول')));

        if (!retried && isAuthFailure && !options.skipAuth) {
          retried = true;
          const generation = authVerifyGeneration;
          const verified = await verifySessionWithServer(generation);
          if (verified || authState.status === 'authenticated') {
            continue;
          }
        }

        if (
          isAuthFailure &&
          !options.skipAuth &&
          !options.skipAuthRedirect &&
          authState.status !== 'authenticated'
        ) {
          clearStoredAuthSession();
          setAuthState('anonymous', null);
          showLoginScreen();
        }

        throw err;
      }
    }
  },

  clearAuthSession() {
    clearStoredAuthSession();
    showLoginScreen();
  },

  saveAuthSession(user) {
    saveAuthSession(user);
  },

  restoreAuthSession() {
    return restoreAuthSession();
  },

  isLoggedIn() {
    if (authState.status === 'authenticated' && Boolean(window.currentUser && window.currentUser.username)) {
      return true;
    }
    return Boolean(resolveAuthToken() && window.currentUser && window.currentUser.username);
  },

  authContext() {
    if (!window.currentUser || !window.currentUser.username) {
      throw new Error('يجب تسجيل الدخول أولاً.');
    }
    return {
      username: window.currentUser.username,
      role: window.currentUser.role,
      userName: window.currentUser?.name || window.currentUser?.username,
    };
  },

  ensureInventoryTarget() {
    if (!window.bloodInventory || typeof window.bloodInventory !== 'object') {
      window.bloodInventory = emptyBloodInventoryTemplate();
    }
    return window.bloodInventory;
  },

  replaceArrayInPlace(target, source) {
    if (!Array.isArray(target)) {
      return Array.isArray(source) ? [...source] : [];
    }
    if (!Array.isArray(source)) {
      return target;
    }
    target.length = 0;
    target.push(...source);
    return target;
  },

  applyBootstrap(data) {
    if (!data || typeof data !== 'object') {
      data = {};
    }

    const invSource = data.bloodInventory && typeof data.bloodInventory === 'object' ? data.bloodInventory : null;
    const targetInv = this.ensureInventoryTarget();
    if (invSource) {
      Object.keys(targetInv).forEach((key) => {
        delete targetInv[key];
      });
      Object.assign(targetInv, emptyBloodInventoryTemplate(), invSource);
    }

    if (!Array.isArray(window.bloodBags)) window.bloodBags = [];
    this.replaceArrayInPlace(window.bloodBags, data.bloodBags);

    if (!Array.isArray(window.donors)) window.donors = [];
    this.replaceArrayInPlace(window.donors, data.donors);

    if (!Array.isArray(window.requests)) window.requests = [];
    this.replaceArrayInPlace(window.requests, data.requests);

    if (!Array.isArray(window.hospitals)) window.hospitals = [];
    this.replaceArrayInPlace(window.hospitals, data.hospitals);

    if (!Array.isArray(window.hospitalDeliveryRecords)) window.hospitalDeliveryRecords = [];
    this.replaceArrayInPlace(window.hospitalDeliveryRecords, data.hospitalDeliveryRecords);

    if (!Array.isArray(window.disposalLogs)) window.disposalLogs = [];
    this.replaceArrayInPlace(window.disposalLogs, data.disposalLogs);

    if (!Array.isArray(window.auditLogs)) window.auditLogs = [];
    this.replaceArrayInPlace(window.auditLogs, data.auditLogs);

    if (data.currentSession && window.currentUser && window.currentUser.username === data.currentSession.username) {
      window.currentUser.role = data.currentSession.role;
      window.currentUser.is_superuser = Boolean(data.currentSession.is_superuser);
      if (!window.profileFormDirty) {
        window.currentUser.name = data.currentSession.name || window.currentUser.name;
      }
      window.currentUser.email = data.currentSession.email || window.currentUser.email;
      saveAuthSession(window.currentUser);
    }

    if (!Array.isArray(window.notifications)) window.notifications = [];
    this.replaceArrayInPlace(window.notifications, data.notifications);

    if (!Array.isArray(window.messages)) window.messages = [];
    this.replaceArrayInPlace(window.messages, data.messages);

    if (!Array.isArray(window.storageUnits)) window.storageUnits = [];
    this.replaceArrayInPlace(window.storageUnits, data.storageUnits);

    if (!Array.isArray(window.accounts)) window.accounts = [];
    this.replaceArrayInPlace(window.accounts, data.accounts);

    const defaultConfig = {
      totalRooms: 0,
      totalFridgesPerRoom: 0,
      totalShelvesPerFridge: 4,
      capacityPerShelf: 100,
      roomNames: [],
      details: [],
    };
    const configSource =
      data.storageConfig && typeof data.storageConfig === 'object' ? data.storageConfig : null;
    if (!window.storageConfig || typeof window.storageConfig !== 'object') {
      window.storageConfig = { ...defaultConfig };
    }
    if (configSource) {
      Object.assign(window.storageConfig, configSource);
    }

    const pendingSource =
      data.pendingDonors && typeof data.pendingDonors === 'object' ? data.pendingDonors : null;
    if (!window.pendingDonors || typeof window.pendingDonors !== 'object') {
      window.pendingDonors = {};
    }
    if (pendingSource) {
      Object.keys(window.pendingDonors).forEach((key) => {
        delete window.pendingDonors[key];
      });
      Object.assign(window.pendingDonors, pendingSource);
    }

    if (!Array.isArray(window.beneficiaries)) window.beneficiaries = [];
    this.replaceArrayInPlace(window.beneficiaries, data.beneficiaries);

    if (data.dashboardStats && typeof data.dashboardStats === 'object') {
      window.dashboardStats = { ...window.dashboardStats, ...data.dashboardStats };
    }
  },

  async loadBootstrap() {
    if (!this.isLoggedIn()) {
      throw createApiError('يجب تسجيل الدخول أولاً لتحميل بيانات المنظومة.', 401, null);
    }
    const data = await this.request('/bootstrap/');
    if (!data || typeof data !== 'object') {
      throw createApiError('استجابة bootstrap غير صالحة من الخادم', 500, data);
    }
    return data;
  },

  async loadLiveSync() {
    if (!this.isLoggedIn()) {
      throw createApiError('يجب تسجيل الدخول أولاً لتحميل بيانات التزامن الحية.', 401, null);
    }
    const data = await this.request('/live-sync/');
    if (!data || typeof data !== 'object') {
      throw createApiError('استجابة live-sync غير صالحة من الخادم', 500, data);
    }
    return data;
  },

  async loadDashboardStats() {
    const data = await this.request('/dashboard-stats/');
    if (data && typeof data === 'object') {
      window.dashboardStats = { ...data };
    }
    return data;
  },

  async loadBeneficiaries() {
    const data = await this.request('/beneficiaries/?page_size=1000');
    const list = Array.isArray(data) ? data : (data.results || []);
    if (!Array.isArray(window.beneficiaries)) window.beneficiaries = [];
    this.replaceArrayInPlace(window.beneficiaries, list);
    return list;
  },

  async createBeneficiary(body) {
    return this.request('/beneficiaries/', { method: 'POST', body });
  },

  async updateBeneficiary(id, body) {
    return this.request(`/beneficiaries/${id}/`, { method: 'PATCH', body });
  },

  async deleteBeneficiary(id) {
    return this.request(`/beneficiaries/${id}/`, { method: 'DELETE' });
  },

  async loadAuditLogs() {
    const role = window.currentUser?.role;
    if (!this.isLoggedIn() || role !== 'superadmin') {
      return [];
    }
    try {
      const data = await this.request('/audit-logs/');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (err.status === 403 || err.status === 401) return [];
      throw err;
    }
  },

  async loadAiPredictions() {
    const data = await this.request('/ai-predictions/');
    if (!data || typeof data !== 'object') {
      throw new Error('استجابة تحليلات الذكاء الاصطناعي غير صالحة من الخادم');
    }
    return data;
  },

  aiSeverityColor(severity) {
    if (severity === 'high' || severity === 'danger') return 'var(--red)';
    if (severity === 'medium' || severity === 'moderate' || severity === 'warning') return 'var(--gold)';
    return 'var(--success)';
  },

  renderAiPredictionsCard(data) {
    if (!data || typeof data !== 'object') return;

    const statusEl = document.getElementById('ai-model-status');
    const insightsEl = document.getElementById('ai-insights-list');
    const recommendationsEl = document.getElementById('ai-recommendations-list');

    if (!statusEl || !insightsEl || !recommendationsEl) return;

    if (!data.hasData) {
      statusEl.innerHTML = `<strong style="color:var(--text-gray)">⏳ ${data.modelStatusText || 'في انتظار البيانات التشغيلية'}:</strong>`;
      statusEl.style.color = 'var(--text-gray)';
      insightsEl.innerHTML = `<p style="color:var(--text-gray); margin:0;">${data.statusMessage || 'سيُفعَّل التحليل الذكي تلقائياً عند توفر بيانات.'}</p>`;
      recommendationsEl.innerHTML = '';
      return;
    }

    statusEl.innerHTML = `<strong style="color:var(--success)">✓ ${data.modelStatusText || 'نموذج الاستهلاك الذكي نشط'}:</strong>`;
    statusEl.style.color = 'var(--success)';

    const insights = Array.isArray(data.insights) ? data.insights : [];
    if (insights.length === 0) {
      insightsEl.innerHTML = '<p style="color:var(--text-gray); margin:0;">لا توجد ملاحظات تحليلية حالياً.</p>';
    } else {
      insightsEl.innerHTML = insights.map((insight) => {
        const color = this.aiSeverityColor(insight.severity);
        let text = insight.text || '';
        if (insight.type === 'wastage' && data.wastageRate && data.wastageRate.formatted) {
          text = text.replace(
            data.wastageRate.formatted,
            `<span style="color:${color}">${data.wastageRate.formatted}</span>`
          );
        }
        const textColor = insight.type === 'stable' ? 'var(--success)' : (insight.severity === 'low' ? 'inherit' : color);
        return `<p style="margin-bottom:0.45rem; color:${textColor}">• ${text}</p>`;
      }).join('');
    }

    const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
    if (recommendations.length === 0) {
      recommendationsEl.innerHTML = '';
    } else {
      recommendationsEl.innerHTML = [
        '<p style="margin-bottom:0.35rem;"><strong>التوصيات الآلية:</strong></p>',
        ...recommendations.map((item) => {
          const color = item.active ? 'var(--gold)' : 'var(--text-gray)';
          return `<p style="margin-bottom:0.35rem; color:${color}">↳ ${item.text || ''}</p>`;
        }),
      ].join('');
    }
  },

  async refreshAiPredictions() {
    if (!this.isLoggedIn()) return null;
    try {
      const data = await this.loadAiPredictions();
      this.renderAiPredictionsCard(data);
      return data;
    } catch (err) {
      console.warn('AI predictions failed', err);
      const statusEl = document.getElementById('ai-model-status');
      if (statusEl) {
        statusEl.innerHTML = '<strong>⚠ تعذر تحميل تحليلات الذكاء الاصطناعي</strong>';
        statusEl.style.color = 'var(--gold)';
      }
      throw err;
    }
  },

  async refreshAll() {
    const data = await this.loadBootstrap();
    this.applyBootstrap(data);
    try {
      await this.loadBeneficiaries();
    } catch (err) {
      console.warn('Failed loading beneficiaries after bootstrap', err);
    }
    if (typeof window.renderAllViews === 'function') {
      window.renderAllViews();
    }
    return data;
  },

  async login(username, password) {
    if (loginPromise) {
      return loginPromise;
    }

    loginPromise = (async () => {
      bumpAuthGeneration();
      try {
        try {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        } catch (_) {}
        window.__sessionToken = '';

        const payload = {
        username: String(username).trim().toLowerCase(),
        password: String(password).replace(/[ - - - - -]/g, ''),
      };

      const loginHeaders = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        loginHeaders['X-CSRFToken'] = csrfToken;
      }

      const response = await fetch(`${API_BASE}/accounts/login/`, {
        method: 'POST',
        headers: loginHeaders,
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let data = null;
      if (text && text.trim()) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { detail: text };
        }
      }

      if (!response.ok) {
        throw createApiError(parseApiError(data, response.status), response.status, data);
      }

      const isSuccessful =
        data &&
        typeof data === 'object' &&
        data.username &&
        (data.authenticated === true || data.success === true);

      if (!isSuccessful) {
        throw new Error('استجابة تسجيل الدخول غير صالحة من الخادم');
      }

      const rawToken = data.token || data.session_key || data.sessionKey || '';
      const sessionToken = toSafeHeaderValue(rawToken, '');
      if (!sessionToken) {
        throw new Error('تعذر الحصول على رمز الجلسة من الخادم. أعد تسجيل الدخول.');
      }

      console.log('[Drop4LifeAPI] Login successful, session token:', sessionToken.substring(0, 10) + '...');

      persistAuthToken(sessionToken);
      const user = {
        username: data.username,
        role: data.role,
        name: data.name || data.username || '',
        email: data.email || '',
        is_superuser: Boolean(data.is_superuser),
        token: sessionToken,
      };
      saveAuthSession(user);
      setAuthState('authenticated', window.currentUser);
      finishAuthInit();
      authBootstrapPromise = null;

      try {
        const confirmHeaders = {
          Accept: 'application/json',
          Authorization: 'Token ' + sessionToken,
        };
        const csrfToken2 = getCsrfToken();
        if (csrfToken2) {
          confirmHeaders['X-CSRFToken'] = csrfToken2;
        }

        console.log('[Drop4LifeAPI] Confirming session with Authorization header:', confirmHeaders.Authorization.substring(0, 20) + '...');

        const confirmUrl = `${API_BASE}/accounts/me/`;
        const confirmResponse = await fetch(confirmUrl, {
          method: 'GET',
          headers: confirmHeaders,
          credentials: 'include',
        });

        const confirmText = await confirmResponse.text();
        let profile = null;
        if (confirmText && confirmText.trim()) {
          try {
            profile = JSON.parse(confirmText);
          } catch {
            profile = null;
          }
        }

        if (!confirmResponse.ok || !profile) {
          console.error('[Drop4LifeAPI] Session confirmation failed:', {
            status: confirmResponse.status,
            headers: Array.from(confirmResponse.headers.entries()),
            body: confirmText,
          });
          throw new Error(`Session confirmation failed (${confirmResponse.status}): ${confirmText || 'No response'}`);
        }

        console.log('[Drop4LifeAPI] Session confirmed successfully');
        const confirmed = userFromProfile(profile, sessionToken);
        if (!confirmed) {
          throw new Error('تعذر تأكيد الجلسة بعد تسجيل الدخول.');
        }
        saveAuthSession(confirmed);
        setAuthState('authenticated', window.currentUser);
      } catch (confirmErr) {
        console.error('[Drop4LifeAPI] Login confirmation error:', confirmErr);
        clearStoredAuthSession();
        throw createApiError(
          confirmErr.message || 'تعذر تأكيد الجلسة بعد تسجيل الدخول.',
          confirmErr.status || 401,
          confirmErr.data || null
        );
      }

      bumpAuthGeneration();
      return data;
    } finally {
      loginPromise = null;
    }
    })();

    return loginPromise;
  },

  async pushAudit(user, role, action, details) {
    await this.waitForAuthInit();
    if (!this.isLoggedIn()) {
      throw createApiError('يجب تسجيل الدخول قبل إرسال سجل التدقيق.', 401, null);
    }
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').substring(0, 16);
    return this.request('/audit-logs/', {
      method: 'POST',
      body: { time: timeStr, user, role, action, details },
    });
  },

  async addDonation(payload) {
    return this.request('/operations/add-donation/', {
      method: 'POST',
      body: { ...payload, ...this.authContext() },
    });
  },

  async submitLab(payload) {
    return this.request('/operations/submit-lab/', {
      method: 'POST',
      body: { ...payload, ...this.authContext() },
    });
  },

  async dispose(payload) {
    return this.request('/operations/dispose/', {
      method: 'POST',
      body: { ...payload, ...this.authContext() },
    });
  },

  async deliverRequest(payload) {
    return this.request('/operations/deliver-request/', {
      method: 'POST',
      body: { ...payload, ...this.authContext() },
    });
  },

  async updateRequestStatus(requestId, statusValue) {
    return this.request('/operations/update-request-status/', {
      method: 'POST',
      body: { requestId, status: statusValue, ...this.authContext() },
    });
  },

  async saveStorageConfig(config) {
    return this.request('/operations/save-storage-config/', {
      method: 'POST',
      body: { ...config, ...this.authContext() },
    });
  },

  async createRequest(body) {
    return this.request('/requests/', { method: 'POST', body });
  },

  async updateBloodBag(id, body) {
    return this.request(`/blood-bags/${encodeURIComponent(id)}/`, { method: 'PUT', body });
  },

  async deleteBloodBag(id) {
    return this.request(`/blood-bags/${encodeURIComponent(id)}/`, { method: 'DELETE' });
  },

  async updateDonor(id, body) {
    return this.request(`/donors/${encodeURIComponent(id)}/`, { method: 'PATCH', body });
  },

  async deleteDonor(id) {
    return this.request(`/donors/${encodeURIComponent(id)}/`, { method: 'DELETE' });
  },

  async updateRequest(id, body) {
    return this.request(`/requests/${encodeURIComponent(id)}/`, { method: 'PATCH', body });
  },

  async deleteRequest(id) {
    return this.request(`/requests/${encodeURIComponent(id)}/`, { method: 'DELETE' });
  },

  async updateHospital(name, body) {
    return this.request(`/hospitals/${encodeURIComponent(name)}/`, { method: 'PATCH', body });
  },

  async deleteHospital(name) {
    return this.request(`/hospitals/${encodeURIComponent(name)}/`, { method: 'DELETE' });
  },

  async updateHospitalDelivery(id, body) {
    return this.request(`/hospital-deliveries/${encodeURIComponent(id)}/`, { method: 'PATCH', body });
  },

  async deleteHospitalDelivery(id) {
    return this.request(`/hospital-deliveries/${encodeURIComponent(id)}/`, { method: 'DELETE' });
  },

  async updateDisposalLog(dbId, body) {
    return this.request(`/disposal-logs/${encodeURIComponent(dbId)}/`, { method: 'PATCH', body });
  },

  async deleteDisposalLog(dbId) {
    return this.request(`/disposal-logs/${encodeURIComponent(dbId)}/`, { method: 'DELETE' });
  },

  async deleteAuditLog(id) {
    return this.request(`/audit-logs/${encodeURIComponent(id)}/`, { method: 'DELETE' });
  },

  async resetOperationalData() {
    return this.request('/operations/reset-data/', { method: 'POST' });
  },

  async createHospital(body) {
    return this.request('/hospitals/', { method: 'POST', body });
  },

  async createMessage(body) {
    return this.request('/messages/', { method: 'POST', body });
  },

  async createNotification(body) {
    return this.request('/notifications/', { method: 'POST', body });
  },

  async updateMessage(id, body) {
    return this.request(`/messages/${id}/`, { method: 'PATCH', body });
  },

  async updateNotification(id, body) {
    return this.request(`/notifications/${id}/`, { method: 'PATCH', body });
  },

  async updateAccount(username, body) {
    const payload = { ...body };
    if (payload.password != null) {
      payload.password = String(payload.password);
    }
    return this.request(`/accounts/${encodeURIComponent(username)}/`, { method: 'PATCH', body: payload });
  },

  async createAccount(body) {
    if (!this.isLoggedIn()) {
      throw new Error('يجب تسجيل الدخول كمسؤول أعلى (Superadmin) لإنشاء حساب.');
    }
    const token = resolveAuthToken();
    if (!token) {
      throw new Error('رمز الجلسة غير متوفر. سجّل الدخول مجدداً كـ Superadmin.');
    }
    const payload = {
      username: String(body.username || '').trim().toLowerCase(),
      name: String(body.name || '').trim(),
      role: body.role || 'lab',
      email: String(body.email || '').trim(),
      password: String(body.password || ''),
      status: body.status || 'active',
    };
    const data = await this.request('/accounts/', {
      method: 'POST',
      body: payload,
    });
    return { ...data, success: true, created: true };
  },

  async deleteAccount(username) {
    return this.request(`/accounts/${encodeURIComponent(username)}/`, { method: 'DELETE' });
  },

  async updateProfile(body) {
    const payload = { ...body };
    if (payload.password != null) {
      payload.password = String(payload.password);
    }
    return this.request('/accounts/me/', { method: 'PATCH', body: payload });
  },

  async logout() {
    return this.request('/accounts/logout/', { method: 'POST', body: {} });
  },

  async deleteNotification(id) {
    return this.request(`/notifications/${id}/`, { method: 'DELETE' });
  },
};

window.Drop4LifeAPI = Drop4LifeAPI;
window.emptyBloodInventoryTemplate = emptyBloodInventoryTemplate;
window.parseApiError = parseApiError;
