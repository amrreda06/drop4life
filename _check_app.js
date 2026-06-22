
// ==================== LIVE DATA (loaded from API) — مربوطة بـ window لتحديثها من api-client ====================
window.currentUser = null;
window.bloodInventory = {};
window.bloodBags = [];
window.donors = [];
window.requests = [];
window.hospitals = [];
window.hospitalDeliveryRecords = [];
window.disposalLogs = [];
window.auditLogs = [];
window.notifications = [];
window.messages = [];
window.storageUnits = [];
window.accounts = [];
window.storageConfig = {
  totalRooms: 0,
  totalFridgesPerRoom: 0,
  totalShelvesPerFridge: 4,
  capacityPerShelf: 100,
  roomNames: [],
  details: []
};
window.pendingDonors = {};
window.beneficiaries = [];
window.dashboardStats = {};
window.profileFormDirty = false;
window.storageConfigPanelDirty = false;
let beneficiariesPage = 1;
const BENEFICIARIES_PAGE_SIZE = 10;
let messagesPageHandled = false;
let notificationsPageHandled = false;
let liveSyncTimer = null;
const LIVE_SYNC_INTERVAL_MS = 5000;
const BENEFICIARY_BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const BENEFICIARY_PRODUCT_TYPES = ['RBC', 'Plasma', 'Platelets'];

function sumInventoryField(field) {
  let total = 0;
  BENEFICIARY_BLOOD_TYPES.forEach((bloodType) => {
    BENEFICIARY_PRODUCT_TYPES.forEach((productType) => {
      const inv = bloodInventory[bloodType]?.[productType];
      if (inv) total += Number(inv[field]) || 0;
    });
  });
  return total;
}

function countLowInventoryRows() {
  let low = 0;
  BENEFICIARY_BLOOD_TYPES.forEach((bloodType) => {
    BENEFICIARY_PRODUCT_TYPES.forEach((productType) => {
      const inv = bloodInventory[bloodType]?.[productType];
      if (inv && inv.available <= inv.criticalLimit) low += 1;
    });
  });
  return low;
}

function sumBloodTypeAvailable(bloodType) {
  return BENEFICIARY_PRODUCT_TYPES.reduce((sum, productType) => {
    return sum + (Number(bloodInventory[bloodType]?.[productType]?.available) || 0);
  }, 0);
}

const PRODUCT_TYPE_LABELS = {};

function productLabel(productType) {
  return t(`product.${productType || 'RBC'}`, productType || 'RBC');
}

const PENDING_BLOOD_TYPES = new Set(['Unknown', 'غير محدد', 'غير معروف', '---', '']);

function isPendingBloodType(bloodType) {
  const value = String(bloodType ?? '').trim();
  return !value || PENDING_BLOOD_TYPES.has(value);
}

function renderBloodTag(bloodType) {
  if (isPendingBloodType(bloodType)) {
    return `<span class="blood-tag blood-tag-pending" title="${t('blood.pendingTitle')}">${t('blood.pending')}</span>`;
  }
  const label = escapeHtml(String(bloodType).trim());
  return `<span class="blood-tag" title="${label}">${label}</span>`;
}

function bloodTypeCell(bloodType) {
  return `<td class="col-blood">${renderBloodTag(bloodType)}</td>`;
}

function getInventoryStock(bloodType, productType = 'RBC') {
  return Number(bloodInventory[bloodType]?.[productType]?.available) || 0;
}

var currentUser = window.currentUser;
var bloodInventory = window.bloodInventory;
var bloodBags = window.bloodBags;
const ACTIVE_BAG_STATUSES = ['Pending', 'Approved', 'Reserved'];

function getActiveBloodBags() {
  return (bloodBags || []).filter(b => ACTIVE_BAG_STATUSES.includes(b.status));
}
var donors = window.donors;
var requests = window.requests;
var hospitals = window.hospitals;
var hospitalDeliveryRecords = window.hospitalDeliveryRecords;
var disposalLogs = window.disposalLogs;
var auditLogs = window.auditLogs;
var notifications = window.notifications;
var messages = window.messages;
var storageUnits = window.storageUnits;
var accounts = window.accounts;
var storageConfig = window.storageConfig;
var pendingDonors = window.pendingDonors;
var beneficiaries = window.beneficiaries;
let apiLoading = false;

function isSuperUser() {
  return Boolean(currentUser && currentUser.is_superuser === true);
}

function getAuditActor() {
  if (!currentUser) return { user: 'system', role: 'System' };
  return {
    user: currentUser.name || currentUser.username,
    role: getRoleLabel(getAccountRole()),
  };
}

function validatePhone11(value, fieldLabel) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 11) {
    const label = fieldLabel || t('msg.validation.phone');
    return tf('msg.validation.phone11', { field: label });
  }
  return null;
}

function validateNationalId14(value, fieldLabel) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 14) {
    const label = fieldLabel || t('msg.validation.nationalId');
    return tf('msg.validation.nationalId14', { field: label });
  }
  return null;
}

function bindDigitsOnlyInput(input, maxDigits) {
  if (!input || input.dataset.numericBound) return;
  input.setAttribute('inputmode', 'numeric');
  input.setAttribute('pattern', '[0-9]*');
  if (maxDigits) input.setAttribute('maxlength', String(maxDigits));
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '');
    input.value = maxDigits ? digits.slice(0, maxDigits) : digits;
  });
  input.dataset.numericBound = '1';
}

function setupNumericFields() {
  const phoneFields = [
    'donor-phone', 'edit-donor-phone', 'm-dr-phone',
    'new-beneficiary-phone', 'edit-beneficiary-phone',
    'delivery-recipient-phone', 'new-hospital-phone', 'edit-hospital-phone'
  ];
  const nationalIdFields = [
    'donor-national', 'edit-donor-national-id',
    'new-beneficiary-national-id', 'edit-beneficiary-national-id'
  ];
  phoneFields.forEach((id) => bindDigitsOnlyInput(document.getElementById(id), 11));
  nationalIdFields.forEach((id) => bindDigitsOnlyInput(document.getElementById(id), 14));
}

function canManageBeneficiaries() {
  const role = getAccountRole();
  return role === 'superadmin' || role === 'admin';
}

function canManageHospitals() {
  return isSuperUser();
}

function renderHospitalCrudButtons(editOnclick, deleteOnclick) {
  if (!canManageHospitals()) return '';
  return `
    <button class="btn btn-primary btn-sm" onclick='${editOnclick}'>✏️ ${t('btn.edit', t('common.edit'))}</button>
    <button class="btn btn-danger btn-sm" onclick='${deleteOnclick}'>🗑️ ${t('btn.delete', t('common.delete'))}</button>
  `;
}

function renderSuperAdminDeleteButton(deleteOnclick) {
  if (!isSuperUser()) return '';
  return `<button class="btn btn-danger btn-sm" onclick="${deleteOnclick}">🗑️ ${t('btn.delete', t('common.delete'))}</button>`;
}

function bindProfileFormListeners() {
  const profileInputs = [
    document.getElementById('profile-name'),
    document.getElementById('profile-email'),
    document.getElementById('profile-password'),
  ].filter(Boolean);

  profileInputs.forEach((input) => {
    if (input.dataset.bound) return;
    input.addEventListener('input', () => {
      window.profileFormDirty = true;
    });
    input.dataset.bound = '1';
  });
}

function refreshSidebarCategoryHeaders() {
  const nav = document.querySelector('.nav-section');
  if (!nav) return;

  let currentLabel = null;
  let hasVisibleItemInSection = false;

  Array.from(nav.children).forEach((child) => {
    if (child.classList.contains('nav-label')) {
      if (currentLabel && !hasVisibleItemInSection) {
        currentLabel.style.display = 'none';
      }
      currentLabel = child;
      hasVisibleItemInSection = false;
      currentLabel.style.display = '';
    } else if (child.classList.contains('nav-item')) {
      if (child.style.display !== 'none') {
        hasVisibleItemInSection = true;
      }
    }
  });

  if (currentLabel && !hasVisibleItemInSection) {
    currentLabel.style.display = 'none';
  }
}

function getRolePageAllowlist(role) {
  if (role === 'superadmin') return null;
  if (role === 'lab') return ['lab', 'dashboard', 'notifications', 'messages', 'profile', 'settings'];
  if (role === 'admin') return ['dashboard', 'inventory', 'donations', 'storage', 'donors', 'beneficiaries', 'requests', 'hospitals', 'notifications', 'messages', 'profile', 'settings'];
  return ['dashboard', 'notifications', 'messages', 'profile', 'settings'];
}

function rebindLiveDataRefs() {
  currentUser = window.currentUser;
  bloodInventory = window.bloodInventory;
  bloodBags = window.bloodBags;
  donors = window.donors;
  requests = window.requests;
  hospitals = window.hospitals;
  hospitalDeliveryRecords = window.hospitalDeliveryRecords;
  disposalLogs = window.disposalLogs;
  auditLogs = window.auditLogs;
  notifications = window.notifications;
  messages = window.messages;
  storageUnits = window.storageUnits;
  accounts = window.accounts;
  storageConfig = window.storageConfig;
  pendingDonors = window.pendingDonors;
  beneficiaries = window.beneficiaries;
}

function displayLocation(loc) {
  if (typeof I18n !== 'undefined' && I18n.ui && typeof I18n.ui.formatLocation === 'function') {
    return I18n.ui.formatLocation(loc);
  }
  return loc || t('common.empty');
}

function displayWorker(name) {
  if (typeof I18n !== 'undefined' && I18n.ui && typeof I18n.ui.formatWorker === 'function') {
    return I18n.ui.formatWorker(name);
  }
  return name || t('common.empty');
}

function displayChatSender(name) {
  if (typeof I18n !== 'undefined' && I18n.ui && typeof I18n.ui.formatChatSender === 'function') {
    return I18n.ui.formatChatSender(name);
  }
  return name || t('common.user');
}

function isMessageSeenByUser(msg) {
  if (!currentUser || !msg) return true;
  const seenBy = Array.isArray(msg.seenBy) ? msg.seenBy : [];
  return seenBy.includes(currentUser.username);
}

function isSystemBroadcastMessage(msg) {
  const from = String(msg?.sender_name || msg?.from || '').trim();
  return from === '📢 النظام' || from.startsWith('📢 ');
}

function getChatMessages() {
  return messages.filter((msg) => !isSystemBroadcastMessage(msg));
}

function getUnreadMessagesCount() {
  if (!currentUser) return 0;
  return getChatMessages().filter((msg) => !isMessageSeenByUser(msg)).length;
}

function formatBadgeCount(count) {
  return count > 99 ? '99+' : String(count);
}

function playMessageAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (_) {}
}

function startLiveSync() {
  stopLiveSync();
  liveSyncTimer = setInterval(() => {
    if (Drop4LifeAPI.isLoggedIn()) {
      void syncFromServer({ silent: true, liveOnly: true });
    }
  }, LIVE_SYNC_INTERVAL_MS);
}

function stopLiveSync() {
  if (liveSyncTimer) {
    clearInterval(liveSyncTimer);
    liveSyncTimer = null;
  }
}

function notificationTimeNow() {
  return typeof formatLocaleTime === 'function' ? formatLocaleTime(new Date()) : new Date().toLocaleTimeString(getDateLocale ? getDateLocale() : 'en-US', { hour: '2-digit', minute: '2-digit' });
}

async function postRequestNotification(title, message) {
  if (!message) return;
  try {
    await Drop4LifeAPI.createNotification({
      title,
      type: 'request',
      time: notificationTimeNow(),
      message,
      read: false
    });
  } catch (_) {}
}

async function syncFromServer(options = {}) {
  const silent = options && options.silent === true;
  if (!Drop4LifeAPI.isLoggedIn()) return;
  if (apiLoading && silent) return;

  const prevMessageIds = new Set(getChatMessages().map((msg) => msg.id).filter(Boolean));
  const prevUnread = getUnreadMessagesCount();
  const prevUnreadNotifications = notifications.filter((note) => !note.read).length;

  apiLoading = true;
  try {
    const liveOnly = options && options.liveOnly === true;
    const data = liveOnly ? await Drop4LifeAPI.loadLiveSync() : await Drop4LifeAPI.loadBootstrap();
    Drop4LifeAPI.applyBootstrap(data);
    rebindLiveDataRefs();
    auditLogs = window.auditLogs || [];
    if (!liveOnly) {
      try {
        await Drop4LifeAPI.loadBeneficiaries();
        rebindLiveDataRefs();
      } catch (benefErr) {
        console.warn('Failed loading beneficiaries', benefErr);
      }
    }

    if (silent) {
      const newMessages = getChatMessages().filter((msg) => msg.id && !prevMessageIds.has(msg.id));
      const isMessagesPage = document.getElementById('page-messages')?.classList.contains('active');
      if (newMessages.length > 0) {
        if (isMessagesPage) {
          messagesPageHandled = false;
          void markMessagesSeen();
        } else if (getUnreadMessagesCount() > prevUnread) {
          const latest = newMessages[0];
          playMessageAlertSound();
          triggerToast(
            t('toast.newMessage'),
            latest ? `${latest.sender_name || latest.from || 'Unknown'}: ${String(latest.text).slice(0, 80)}` : t('toast.newMessageBody')
          );
        }
      }

      const unreadNotifications = notifications.filter((note) => !note.read).length;
      const isNotificationsPage = document.getElementById('page-notifications')?.classList.contains('active');
      if (!isNotificationsPage && unreadNotifications > prevUnreadNotifications) {
        const latestNote = notifications.find((note) => !note.read);
        playMessageAlertSound();
        triggerToast(
          t('toast.newNotification'),
          latestNote ? `${latestNote.title}: ${String(latestNote.message).slice(0, 80)}` : t('toast.newNotificationBody')
        );
      }
    }

    renderAllViews();
  } catch (err) {
    console.error(err);
    if (err && (err.status === 401 || err.status === 403)) {
      stopLiveSync();
      Drop4LifeAPI.clearAuthSession();
      currentUser = null;
      throw err;
    }
    if (!silent && typeof triggerToast === 'function') {
      const title = err && err.status === 403 ? t('toast.forbiddenTitle') : t('toast.loadErrorTitle');
      triggerToast(title, trMsg(err && err.message) || t('toast.loadFailed'));
    }
  } finally {
    apiLoading = false;
  }
}

// ==================== COMPATIBILITY MATRIX MAP ====================
// Key: Patient Blood Type -> Array of allowed donor blood types
const compatibilityMatrix = {
  'A+':  ['A+', 'A-', 'O+', 'O-'],
  'A-':  ['A-', 'O-'],
  'B+':  ['B+', 'B-', 'O+', 'O-'],
  'B-':  ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'O+':  ['O+', 'O-'],
  'O-':  ['O-']
};

// ==================== AUTHENTICATION WORKFLOW ====================
function togglePasswordVisibility() {
  const pInput = document.getElementById('login-password');
  pInput.type = pInput.type === 'password' ? 'text' : 'password';
}

let loginInProgress = false;

async function handleLogin(e) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }
  if (loginInProgress) return;
  if (typeof window.Drop4LifeAPI === 'undefined') {
    const errorDiv = document.getElementById('login-error');
    errorDiv.innerText = t('msg.api.loadFailed');
    errorDiv.style.display = 'block';
    return;
  }
  const user = document.getElementById('login-username').value.trim().toLowerCase();
  const pass = document.getElementById('login-password').value;
  const btn = document.getElementById('login-submit-btn');
  const errorDiv = document.getElementById('login-error');

  errorDiv.style.display = 'none';
  btn.innerHTML = t('login.verifying');
  btn.disabled = true;
  loginInProgress = true;

  try {
    const account = await Drop4LifeAPI.login(user, pass);
    if (!account || !account.username || (!account.authenticated && !account.success)) {
      throw new Error(t('login.invalidResponse'));
    }
    window.currentUser = {
      username: account.username,
      role: account.role,
      role_code: account.role_code || getRoleCode(account.role),
      role_label: account.role_label || getRoleLabel(account.role),
      name: account.name || account.username || '',
      email: account.email || '',
      is_superuser: Boolean(account.is_superuser),
      token: window.__sessionToken || account.token || ''
    };
    currentUser = window.currentUser;
    Drop4LifeAPI.saveAuthSession(window.currentUser);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('drop4life:critical-alert-dismissed');
    }
    try {
      await Drop4LifeAPI.pushAudit(account.name || user, getRoleLabel(account.role), t('auditAction.loginSuccess'), t('auditAction.loginDetails'));
    } catch (auditErr) {
      console.warn('audit log failed', auditErr);
    }
    await syncFromServer();
    if (!Drop4LifeAPI.isLoggedIn()) {
      throw new Error(t('login.sessionFailed'));
    }
    rebindLiveDataRefs();
    buildApplicationAccess();
    navigateToDashboardPath();
    startLiveSync();
    document.getElementById('auth-wrapper').style.display = 'none';
    document.getElementById('app-wrapper').style.display = 'flex';
    triggerToast(t('toast.loginSuccess'), t('toast.loginWelcome').replace('{name}', account.name || account.username));
  } catch (err) {
    const msg = err && err.message ? trMsg(err.message) : t('login.invalidCredentials');
    errorDiv.innerText = msg;
    errorDiv.style.display = 'block';
  } finally {
    loginInProgress = false;
    btn.innerHTML = `<span>${t('login.submit')}</span>`;
    btn.disabled = false;
  }
}

function navigateToDashboardPath() {
  if (typeof window !== 'undefined' && window.history && typeof window.history.replaceState === 'function') {
    try {
      window.history.replaceState(null, '', '/dashboard');
    } catch (_) {
      // ignore history errors
    }
  }
  resolveInitialRoute();
}

const SPA_ROUTE_PAGES = {
  dashboard: 'dashboard',
  profile: 'profile',
  inventory: 'inventory',
  donations: 'donations',
  storage: 'storage',
  donors: 'donors',
  beneficiaries: 'beneficiaries',
  requests: 'requests',
  hospitals: 'hospitals',
  lab: 'lab',
  statistics: 'statistics',
  notifications: 'notifications',
  messages: 'messages',
  settings: 'settings',
  'admin-settings': 'admin-settings',
};

function resolveInitialRoute() {
  const segment = (window.location.pathname || '/').replace(/^\/+/, '').split('/')[0] || 'dashboard';
  const pageId = SPA_ROUTE_PAGES[segment] || 'dashboard';
  if (typeof switchPage === 'function') {
    switchPage(pageId);
  }
}

async function handleLogout() {
  stopLiveSync();
  if (window.currentUser) {
    try {
      const actor = getAuditActor();
      await Drop4LifeAPI.pushAudit(actor.user, actor.role, t('auditAction.logout'), t('auditAction.logoutDetails'));
    } catch (_) {}
    try {
      await Drop4LifeAPI.logout();
    } catch (_) {}
  }
  Drop4LifeAPI.clearAuthSession();
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('drop4life:critical-alert-dismissed');
  }
  currentUser = null;
  document.getElementById('auth-wrapper').style.display = 'flex';
  document.getElementById('app-wrapper').style.display = 'none';
}

// ==================== ROLE-BASED ACCESS CONTROL (RBAC) COMPILER ====================
function getUserDisplayName() {
  if (!currentUser) return t('common.user');
  return currentUser?.name || currentUser?.username || t('common.user');
}

function getRoleCode(role) {
  const normalizedRole = String(role || '').toLowerCase();
  if (normalizedRole === 'superadmin' || normalizedRole === 'dr') return 'DR';
  if (normalizedRole === 'admin' || normalizedRole === 'adm') return 'ADM';
  if (normalizedRole === 'lab' || normalizedRole === 'mls') return 'MLS';
  return 'MLS';
}

function getRoleLabel(role) {
  if (typeof I18n !== 'undefined' && I18n.ui && typeof I18n.ui.roleLabel === 'function') {
    return I18n.ui.roleLabel(role);
  }
  const normalizedRole = String(role || '').toLowerCase();
  if (normalizedRole === 'superadmin' || normalizedRole === 'dr') return t('role.superadmin');
  if (normalizedRole === 'admin' || normalizedRole === 'adm') return t('role.admin');
  if (normalizedRole === 'lab' || normalizedRole === 'mls') return t('role.lab');
  return role || t('role.lab');
}

function uiBadge(method, arg, fallbackKey, fallbackClass) {
  if (typeof I18n !== 'undefined' && I18n.ui && typeof I18n.ui[method] === 'function') {
    return I18n.ui[method](arg);
  }
  return `<span class="badge ${fallbackClass}">${escapeHtml(t(fallbackKey))}</span>`;
}

function getAccountRole() {
  if (!currentUser) return 'lab';
  if (currentUser.is_superuser === true) return 'superadmin';
  const normalizedCode = String(currentUser.role_code || '').trim().toUpperCase();
  if (normalizedCode === 'DR') return 'superadmin';
  if (normalizedCode === 'ADM') return 'admin';
  if (normalizedCode === 'MLS') return 'lab';
  if (currentUser.role) return currentUser.role;
  return 'lab';
}

function buildApplicationAccess() {
  rebindLiveDataRefs();
  if (!currentUser) {
    if (typeof showLoginScreen === 'function') {
      showLoginScreen();
    }
    return;
  }

  const displayName = getUserDisplayName();
  const avatarLabel = displayName.substring(0, 2) || '??';
  const role = getAccountRole();
  const roleCode = getRoleCode(role);

  // Update Profile Footer UI
  const profileBtnName = document.getElementById('profile-btn-name');
  if (profileBtnName) profileBtnName.innerText = displayName;
  const profileBtnRole = document.getElementById('profile-btn-role');
  if (profileBtnRole) profileBtnRole.innerText = roleCode;

  const accountRole = role;
  const allowedPages = getRolePageAllowlist(role);
  
  // Backup system button strict protection
  const backupBtn = document.getElementById('btn-backup');
  if (backupBtn) backupBtn.style.display = (role === 'superadmin') ? 'inline-flex' : 'none';
  // Fast donation action button restrictions
  const quickDonationBtn = document.getElementById('btn-quick-donation');
  if (quickDonationBtn) quickDonationBtn.style.display = (role === 'superadmin' || role === 'admin') ? 'inline-flex' : 'none';
  const addBeneficiaryBtn = document.getElementById('btn-add-beneficiary');
  if (addBeneficiaryBtn) addBeneficiaryBtn.style.display = canManageBeneficiaries() ? 'inline-flex' : 'none';

  // Sidebar Menu Filter Engine (account role)
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    const pageTarget = item.dataset.pages;
    const accessGranted = allowedPages === null || allowedPages.includes(pageTarget);
    item.style.display = accessGranted ? 'flex' : 'none';
  });
  refreshSidebarCategoryHeaders();

  const profileSettingsItem = document.querySelector('.profile-menu-item-settings');
  if(profileSettingsItem) profileSettingsItem.style.display = accountRole === 'superadmin' ? 'block' : 'none';

  // Reset to page from URL (or dashboard) once auth/UI is ready
  resolveInitialRoute();
}

// ==================== SYSTEM ENGINE & NAVIGATION ====================
function navigateToModule(pageId) {
  const navBtn = document.querySelector(`.nav-item[data-pages="${pageId}"]`);
  if (navBtn && navBtn.style.display === 'none') {
    triggerToast(t('toast.accessDeniedTitle'), t('toast.accessDeniedBody'));
    return;
  }
  switchPage(pageId, navBtn);
  if (typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
    try {
      window.history.pushState(null, '', `/${pageId}`);
    } catch (_) {}
  }
}

function updatePageHeader(pageId) {
  const titleEl = document.getElementById('main-title');
  const subtitleEl = document.getElementById('main-subtitle');
  const pageKey = pageId || 'dashboard';
  const title = typeof t === 'function' ? t(`page.${pageKey}.title`, t('page.default.title')) : pageKey;
  const subtitle = typeof t === 'function' ? t(`page.${pageKey}.subtitle`, '') : '';
  if (titleEl) titleEl.textContent = title;
  if (subtitleEl) {
    subtitleEl.textContent = subtitle;
    subtitleEl.style.display = subtitle ? 'block' : 'none';
  }
}

function switchPage(pageId, btnElement) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById('page-' + pageId);
  if (!pageEl) return;
  pageEl.classList.add('active');

  if (pageId === 'messages') messagesPageHandled = false;
  if (pageId === 'notifications') notificationsPageHandled = false;

  if (!btnElement) {
    btnElement = document.querySelector(`.nav-item[data-pages="${pageId}"]`);
  }
  if (btnElement) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    btnElement.classList.add('active');
  }

  updatePageHeader(pageId);
  if (pageId === 'beneficiaries') {
    void refreshBeneficiariesPage();
  } else {
    renderAllViews();
  }
}

// ==================== MODAL CONTROLLER ====================
function openModal(id) {
  document.getElementById(id).classList.add('open');
  setupNumericFields();
  if(id === 'modal-add-donation') {
    toggleDonationMode('bag');
  }
  if(id === 'modal-add-request') {
    const input = document.getElementById('req-hospital-input');
    if(input) {
      input.value = '';
      filterHospitalSuggestions('');
    }
  }
}
function openBeneficiaryAddModal() {
  if (!canManageBeneficiaries()) {
    alertT('msg.beneficiary.addDenied'); // ar: فقط المسؤول الأعلى أو الأدمن يمكنه إضافة مستفيدين.
    return;
  }
  const hasAvailable = BENEFICIARY_BLOOD_TYPES.some((type) => {
    return BENEFICIARY_PRODUCT_TYPES.some((productType) => {
      const stock = getBeneficiaryBloodStock(type, productType);
      return stock.exists && stock.available > 0;
    });
  });
  if (!hasAvailable) {
    alertT('msg.beneficiary.noStock'); // ar: لا يوجد مخزون متاح من أي فصيلة دم حالياً. لا يمكن تسجيل مستفيد جديد.
    return;
  }
  populateBeneficiaryBloodSelect('new-beneficiary-blood', '', true);
  updateBeneficiaryStockHint('new');
  openModal('modal-add-beneficiary');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (id === 'modal-add-donation' && typeof toggleDonationMode === 'function') {
    toggleDonationMode('bag');
  }
}

function toggleDonationMode(mode) {
  const bagSec = document.getElementById('donation-section-bag');
  const donorSec = document.getElementById('donation-section-donor');
  if (!bagSec || !donorSec) return;

  document.querySelectorAll('input[name="don-mode"]').forEach(radio => {
    radio.checked = radio.value === mode;
  });

  if (mode === 'donor') {
    bagSec.style.display = 'none';
    donorSec.style.display = 'block';
    populateDonorStorageSelectors();
  } else {
    bagSec.style.display = 'block';
    donorSec.style.display = 'none';
    populateBagStorageSelectors();
  }
}

// ==================== VIEW ENGINE PIPELINE (RENDERERS) ====================
function getActivePageId() {
  const activePage = document.querySelector('.page.active');
  if (!activePage || !activePage.id) return 'dashboard';
  return activePage.id.replace(/^page-/, '');
}

function renderAllViews() {
  rebindLiveDataRefs();
  if (!window.Drop4LifeAPI || !Drop4LifeAPI.isLoggedIn() || !currentUser) return;
  const activePageId = getActivePageId();
  void calculateDashboardMetrics();
  updateTopbarBadges();
  if (activePageId === 'dashboard' && window.Drop4LifeAPI && typeof window.Drop4LifeAPI.refreshAiPredictions === 'function') {
    window.Drop4LifeAPI.refreshAiPredictions();
  }
  if (activePageId === 'dashboard') {
    renderBloodMatrix();
  } else if (activePageId === 'statistics') {
    renderStatisticsPage();
  } else if (activePageId === 'inventory') {
    renderInventoryTable();
    renderInventoryBagsTable();
  } else if (activePageId === 'donations') {
    renderDonationsTable();
  } else if (activePageId === 'lab') {
    renderLabModuleTable();
  } else if (activePageId === 'requests') {
    renderRequestsTable();
  } else if (activePageId === 'donors') {
    renderDonorsTable();
  } else if (activePageId === 'hospitals') {
    renderHospitalsTable();
    renderHospitalDeliveriesTable();
  } else if (activePageId === 'beneficiaries') {
    renderBeneficiariesTable();
  } else if (activePageId === 'audit') {
    renderAuditTable();
    const auditSearch = document.getElementById('audit-search');
    if (auditSearch && !auditSearch.dataset.bound) {
      auditSearch.addEventListener('input', renderAuditTable);
      auditSearch.dataset.bound = '1';
    }
  } else if (activePageId === 'disposal') {
    renderDisposalTable();
  } else if (activePageId === 'storage') {
    renderStoragePage();
  } else if (activePageId === 'notifications') {
    renderNotificationsPage();
  } else if (activePageId === 'messages') {
    renderMessagesPage();
  } else if (activePageId === 'profile') {
    renderProfilePage();
    bindProfileFormListeners();
  } else if (activePageId === 'admin-settings') {
    renderAdminSettingsPage();
  }
}

function renderStatisticsPage() {
  const bloodCtx = document.getElementById('chart-blood-group-donut');
  const requestCtx = document.getElementById('chart-request-types');
  const labCtx = document.getElementById('chart-lab-outcomes');
  if(!bloodCtx || !requestCtx || !labCtx) return;

  if (typeof Chart === 'undefined') {
    return;
  }

  const bloodLabels = BENEFICIARY_BLOOD_TYPES;
  const bloodValues = bloodLabels.map((type) => sumBloodTypeAvailable(type));
  const requestLabels = [
    t('chart.priority.normal'),
    t('chart.priority.urgent'),
    t('chart.priority.critical'),
  ];
  const requestCounts = [
    requests.filter(r => r.priority === 'normal').length,
    requests.filter(r => r.priority === 'urgent').length,
    requests.filter(r => r.priority === 'critical').length
  ];
  const labLabels = [
    t('chart.lab.pending'),
    t('chart.lab.approved'),
    t('chart.lab.rejected'),
  ];
  const labCounts = [
    getActiveBloodBags().filter(b => b.status === 'Pending').length,
    getActiveBloodBags().filter(b => b.status === 'Approved').length,
    (disposalLogs || []).length
  ];

  window.statisticsCharts = window.statisticsCharts || {};
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 12 } } }
    }
  };
  const requestColors = ['#34D399', '#F59E0B', '#EF4444'];
  const buildRequestTypeDatasets = (counts) => requestLabels.map((label, i) => ({
    label,
    data: requestLabels.map((_, j) => (i === j ? counts[i] : 0)),
    backgroundColor: requestColors[i],
    borderWidth: 0,
    borderRadius: 6,
  }));
  const requestChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      tooltip: {
        filter: (item) => item.raw > 0,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}`
        }
      }
    },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 } }
    }
  };

  if(!window.statisticsCharts.bloodGroup) {
    window.statisticsCharts.bloodGroup = new Chart(bloodCtx, {
      type: 'doughnut',
      data: {
        labels: bloodLabels,
        datasets: [{
          data: bloodValues,
          backgroundColor: ['#D23B4A', '#F59E0B', '#2563EB', '#9341B8', '#10B981', '#F43F5E', '#0284C7', '#F97316'],
          borderWidth: 1
        }]
      },
      options: chartOptions
    });
  } else {
    window.statisticsCharts.bloodGroup.data.labels = bloodLabels;
    window.statisticsCharts.bloodGroup.data.datasets[0].data = bloodValues;
    window.statisticsCharts.bloodGroup.update();
  }

  if(!window.statisticsCharts.requestTypes) {
    window.statisticsCharts.requestTypes = new Chart(requestCtx, {
      type: 'bar',
      data: {
        labels: requestLabels,
        datasets: buildRequestTypeDatasets(requestCounts)
      },
      options: requestChartOptions
    });
  } else {
    window.statisticsCharts.requestTypes.data.datasets = buildRequestTypeDatasets(requestCounts);
    window.statisticsCharts.requestTypes.update();
  }

  if(!window.statisticsCharts.labOutcomes) {
    window.statisticsCharts.labOutcomes = new Chart(labCtx, {
      type: 'pie',
      data: {
        labels: labLabels,
        datasets: [{
          data: labCounts,
          backgroundColor: ['#60A5FA', '#34D399', '#F87171']
        }]
      },
      options: chartOptions
    });
  } else {
    window.statisticsCharts.labOutcomes.data.datasets[0].data = labCounts;
    window.statisticsCharts.labOutcomes.update();
  }

  renderBloodOutputStatsSection();
}

async function renderBloodOutputStatsSection() {
  const section = document.getElementById('blood-output-stats-section');
  if (!section) return;
  section.style.display = isSuperUser() ? 'block' : 'none';
  if (!isSuperUser() || typeof Chart === 'undefined') return;

  let stats = window.bloodOutputStats || null;
  if (Drop4LifeAPI.isLoggedIn()) {
    try {
      stats = await Drop4LifeAPI.loadBloodOutputStats(12);
      window.bloodOutputStats = stats;
    } catch (_) {}
  }
  if (!stats) return;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value ?? 0);
  };
  setText('blood-output-current-month', stats.currentMonthTotal);
  setText('blood-output-hospital-month', stats.currentMonthHospital);
  setText('blood-output-beneficiary-month', stats.currentMonthBeneficiary);

  const tbody = document.getElementById('table-blood-output-recent');
  if (tbody) {
    const rows = Array.isArray(stats.recentDeliveries) ? stats.recentDeliveries : [];
    tbody.innerHTML = rows.length ? rows.map(row => `
      <tr>
        <td>${escapeHtml(typeof translateBloodOutputSource === 'function' ? translateBloodOutputSource(row.source) : (row.source || ''))}</td>
        <td>${escapeHtml(row.name || '')}</td>
        ${bloodTypeCell(row.blood)}
        <td>${productLabel(row.productType || 'RBC')}</td>
        <td>${row.qty || 0}</td>
        <td>${escapeHtml(row.date || '')}</td>
      </tr>
    `).join('') : `<tr><td colspan="6" style="text-align:center; color:var(--text-gray);">${t('empty.bloodOutputDeliveries')}</td></tr>`;
  }

  const ctx = document.getElementById('chart-blood-output-monthly');
  if (!ctx) return;
  const monthly = Array.isArray(stats.monthly) ? stats.monthly : [];
  const labels = monthly.map(item => item.label);
  const hospitalData = monthly.map(item => item.hospital || 0);
  const beneficiaryData = monthly.map(item => item.beneficiary || 0);

  window.statisticsCharts = window.statisticsCharts || {};
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  };

  if (!window.statisticsCharts.bloodOutput) {
    window.statisticsCharts.bloodOutput = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: t('chart.bloodOutput.hospitals'), data: hospitalData, backgroundColor: '#2563EB', borderRadius: 6 },
          { label: t('chart.bloodOutput.beneficiaries'), data: beneficiaryData, backgroundColor: '#D23B4A', borderRadius: 6 },
        ],
      },
      options: chartOptions,
    });
  } else {
    window.statisticsCharts.bloodOutput.data.labels = labels;
    window.statisticsCharts.bloodOutput.data.datasets[0].data = hospitalData;
    window.statisticsCharts.bloodOutput.data.datasets[1].data = beneficiaryData;
    window.statisticsCharts.bloodOutput.update();
  }
}

async function calculateDashboardMetrics() {
  let stats = window.dashboardStats || {};
  if (Drop4LifeAPI.isLoggedIn()) {
    try {
      stats = await Drop4LifeAPI.loadDashboardStats();
    } catch (_) {
      stats = window.dashboardStats || {};
    }
  }

  let totalVol = stats.totalAvailableBags;
  let pendingLab = stats.pendingLabBags;
  let donorCount = stats.totalDonors;
  let hospitalCount = stats.hospitalCount;
  let hospitalRequestOrders = stats.hospitalBloodRequestOrders;

  if (totalVol == null) {
    totalVol = sumInventoryField('available');
  }
  if (donorCount == null) donorCount = donors.length;
  if (pendingLab == null) pendingLab = bloodBags.filter(b => b.status === 'Pending').length;
  if (hospitalCount == null) hospitalCount = hospitals.length;
  if (hospitalRequestOrders == null) hospitalRequestOrders = requests.length;

  let lowCount = stats.lowInventoryRows;
  if (lowCount == null) lowCount = countLowInventoryRows();

  const totalUnitsEl = document.getElementById('stat-total-units');
  const totalDonorsEl = document.getElementById('stat-total-donors');
  const pendingLabEl = document.getElementById('stat-pending-lab');
  const hospitalCountEl = document.getElementById('stat-hospital-count');
  const hospitalRequestsEl = document.getElementById('stat-hospital-requests');

  if (totalUnitsEl) totalUnitsEl.innerText = `${totalVol}`;
  if (totalDonorsEl) totalDonorsEl.innerText = `${donorCount}`;
  if (pendingLabEl) {
    pendingLabEl.innerText = `${pendingLab}`;
    const badgeLab = document.getElementById('badge-lab-pending');
    if (badgeLab) badgeLab.innerText = pendingLab;
  }
  if (hospitalCountEl) hospitalCountEl.innerText = `${hospitalCount}`;
  if (hospitalRequestsEl) hospitalRequestsEl.innerText = `${hospitalRequestOrders}`;

  const badgeLow = document.getElementById('badge-low-count');
  if (badgeLow) badgeLow.innerText = lowCount;
  updateRequestsNavBadge();

  const banner = document.getElementById('critical-alert-banner');
  const dismissed = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('drop4life:critical-alert-dismissed') === '1';
  if (banner) banner.style.display = (lowCount > 0 && !dismissed) ? 'flex' : 'none';
}

function dismissCriticalAlert() {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('drop4life:critical-alert-dismissed', '1');
  }
  const banner = document.getElementById('critical-alert-banner');
  if (banner) banner.style.display = 'none';
}

function renderBloodMatrix() {
  const grid = document.getElementById('dashboard-blood-matrix');
  if(!grid) return;
  grid.innerHTML = "";

  BENEFICIARY_BLOOD_TYPES.forEach(type => {
    const totalAvailable = sumBloodTypeAvailable(type);
    const criticalLimit = bloodInventory[type]?.RBC?.criticalLimit || 20;
    let glowClass = "";
    if (totalAvailable <= 10) glowClass = "glow-critical";
    else if (totalAvailable <= criticalLimit) glowClass = "glow-low";

    const pct = Math.min((totalAvailable / 300) * 100, 100);
    const barColor = (glowClass === "glow-critical") ? 'var(--red)' : (glowClass === "glow-low" ? 'var(--gold)' : 'var(--success)');
    const breakdown = BENEFICIARY_PRODUCT_TYPES.map((pt) => `${productLabel(pt)}: ${getInventoryStock(type, pt)}`).join(' · ');

    grid.innerHTML += `
      <div class="card blood-card ${glowClass}" onclick="triggerToast(t('toast.bloodTypeReport').replace('{type}', '${type}'), '${breakdown}')">
        <div class="b-type">${type}</div>
        <div class="b-volume">${totalAvailable} ${t('common.units')}</div>
        <div class="b-progress">
          <div class="b-bar" style="width: ${pct}%; background:${barColor}"></div>
        </div>
      </div>
    `;
  });
}

function renderDashboardUrgentRequests() {
  const tbody = document.getElementById('table-dashboard-urgent');
  if(!tbody) return;
  
  const urgent = requests.filter(r => r.priority === 'critical' && normalizeRequestStatus(r.status) !== 'تم التسليم');
  if(urgent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-gray);">${t('dashboard.urgentEmpty')}</td></tr>`;
    return;
  }

  tbody.innerHTML = urgent.map(r => {
    const pBadge = uiBadge('priorityBadge', 'critical', 'badge.priorityCritical', 'badge-danger');
    return `
    <tr>
      <td><strong>${r.hospital}</strong></td>
      ${bloodTypeCell(r.blood)}
      <td>${productLabel(r.productType || 'RBC')}</td>
      <td><strong>${r.qty} ${t('common.bags')}</strong></td>
      <td>${pBadge}</td>
      <td><button class="btn btn-primary btn-sm" onclick="executeApproveRequest('${r.id}')">${t('btn.secureDispense')}</button></td>
    </tr>
  `;
  }).join('');
}

function calculateDaysRemaining(expiryDate) {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function normalizeSearch(text) {
  return (text || '').toString().trim().toLowerCase();
}

function matchesSearchString(field, query) {
  if(!query) return true;
  return normalizeSearch(field).includes(query);
}

function normalizeRequestStatus(status) {
  const value = String(status || '').trim();
  const map = {
    'Pending Approval': 'قيد المراجعة',
    'Ready for Delivery': 'تم القبول',
    'Rejected': 'تم الرفض',
    'Completed': 'تم التسليم',
  };
  return map[value] || value;
}

function getRequestStatusBadge(status) {
  const normalized = normalizeRequestStatus(status);
  if (typeof I18n !== 'undefined' && I18n.ui && typeof I18n.ui.requestStatusBadge === 'function') {
    return I18n.ui.requestStatusBadge(normalized);
  }
  return `<span class="badge badge-info">${escapeHtml(normalized || t('common.unspecified'))}</span>`;
}

let _hospitalSuggestionMatches = [];

function filterHospitalSuggestions(query) {
  const suggestions = document.getElementById('hospital-suggestions');
  if(!suggestions) return;
  const normalized = normalizeSearch(query);
  const matches = hospitals
    .filter(h => normalizeSearch(h.name).includes(normalized) || normalizeSearch(h.address).includes(normalized) || normalizeSearch(h.phone).includes(normalized))
    .slice(0, 8);

  _hospitalSuggestionMatches = matches;

  if(!normalized || matches.length === 0) {
    suggestions.innerHTML = '';
    suggestions.classList.remove('open');
    return;
  }

  suggestions.innerHTML = matches.map((h, idx) => `
    <div class="autocomplete-suggestion" data-suggestion-index="${idx}" onmousedown="event.preventDefault(); pickHospitalSuggestion(${idx})">
      <strong>${escapeHtml(h.name)}</strong><br><small style='color:#64748B;'>${escapeHtml(h.address)} · ${escapeHtml(h.phone)}</small>
    </div>
  `).join('');
  suggestions.classList.add('open');
}

function pickHospitalSuggestion(index) {
  const match = _hospitalSuggestionMatches[index];
  if (!match) return;
  selectHospitalSuggestion(match.name);
}

function pickFirstHospitalSuggestion() {
  if (_hospitalSuggestionMatches.length > 0) {
    pickHospitalSuggestion(0);
  }
}

function hideHospitalSuggestions() {
  const suggestions = document.getElementById('hospital-suggestions');
  if (suggestions) suggestions.classList.remove('open');
}

function selectHospitalSuggestion(name) {
  const input = document.getElementById('req-hospital-input');
  if(!input) return;
  input.value = name;
  hideHospitalSuggestions();
}

function isValidHospitalSelection(name) {
  return hospitals.some(h => h.name === name);
}

function renderInventoryBagsTable() {
  const tbody = document.getElementById('table-inventory-bags-full');
  if(!tbody) return;

  const query = normalizeSearch(document.getElementById('inventory-search')?.value || '');
  const bloodFilter = document.getElementById('inventory-filter-blood')?.value || '';
  const productFilter = document.getElementById('inventory-filter-product')?.value || '';
  const statusFilter = document.getElementById('inventory-filter-status')?.value || '';

  const searchInput = document.getElementById('inventory-search');
  if(searchInput && !searchInput.dataset.bound) {
    searchInput.addEventListener('input', renderInventoryBagsTable);
    searchInput.dataset.bound = '1';
  }

  let filtered = getActiveBloodBags();

  if(bloodFilter) filtered = filtered.filter(b => b.bloodType === bloodFilter);
  if(productFilter) filtered = filtered.filter(b => (b.productType || 'RBC') === productFilter);
  if(statusFilter) filtered = filtered.filter(b => b.status === statusFilter);

  if(query) {
    filtered = filtered.filter(b => {
      return [b.id, b.bloodType, b.productType, b.donor, b.location].some(field => matchesSearchString(field, query));
    });
  }

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:var(--text-gray);">${t('empty.inventory')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(b => {
    const daysRemaining = calculateDaysRemaining(b.expiry);
    let expiryStyle = '';
    let statusBadge = '';
    
    if(daysRemaining < 0) {
      expiryStyle = 'background:rgba(220,53,69,0.05); color:var(--red);';
    }

    if(b.status === 'Approved') {
      statusBadge = uiBadge('bagStatusBadge', 'Approved', 'badge.bagApproved', 'badge-success');
    } else if(b.status === 'Pending') {
      statusBadge = uiBadge('bagStatusBadge', 'Pending', 'badge.bagPending', 'badge-warning');
    } else if(b.status === 'Reserved') {
      statusBadge = uiBadge('bagStatusBadge', 'Reserved', 'badge.bagReserved', 'badge-info');
    }

    const bagActions = canDisposeBag() && b.status !== 'Pending'
      ? `<button class="btn btn-danger btn-sm" onclick="openDisposeBagModal('${b.id}')">🗑️ ${t('btn.delete', t('common.delete'))}</button>`
      : '—';

    const daysLabel = (typeof I18n !== 'undefined' && I18n.ui && typeof I18n.ui.daysLeftLabel === 'function')
      ? I18n.ui.daysLeftLabel(daysRemaining)
      : `${daysRemaining} ${t('table.daysLeftUnit')}`;

    return `
      <tr style="${expiryStyle}">
        <td style="font-family:monospace; color:var(--info); font-weight:600;"><strong>${b.id}</strong></td>
        <td>${productLabel(b.productType || 'RBC')}</td>
        ${bloodTypeCell(b.bloodType)}
        <td>${b.donor}</td>
        <td>${b.date}</td>
        <td>${b.expiry}</td>
        <td><strong>${daysLabel}</strong></td>
        <td>${statusBadge}</td>
        <td style="font-size:12px; color:var(--text-gray);">${displayLocation(b.location)}</td>
        <td>${bagActions}</td>
      </tr>
    `;
  }).join('');
}

function renderInventoryTable() {
  const tbody = document.getElementById('table-inventory-summary');
  if(!tbody) return;

  const rows = [];
  BENEFICIARY_BLOOD_TYPES.forEach((type) => {
    BENEFICIARY_PRODUCT_TYPES.forEach((productType) => {
      const d = bloodInventory[type]?.[productType];
      if (!d) return;
      let statusBadge = uiBadge('inventoryHealthBadge', 'safe', 'badge.inventorySafe', 'badge-success');
      if (d.available <= 10) {
        statusBadge = uiBadge('inventoryHealthBadge', 'critical', 'badge.inventoryCritical', 'badge-danger');
      } else if (d.available <= d.criticalLimit) {
        statusBadge = uiBadge('inventoryHealthBadge', 'low', 'badge.inventoryLow', 'badge-warning');
      }
      rows.push(`
        <tr>
          <td><strong style="font-size:16px;">${type}</strong></td>
          <td>${productLabel(productType)}</td>
          <td><strong style="color:var(--success)">${d.available} ${t('common.units')}</strong></td>
          <td><span style="color:var(--gold)">${d.reserved} ${t('common.units')}</span></td>
          <td><span style="color:var(--text-gray)">${d.issued} ${t('common.units')}</span></td>
          <td><span style="color:#ff4d6a">${d.expired} ${t('common.units')}</span></td>
          <td>${statusBadge}</td>
        </tr>
      `);
    });
  });
  tbody.innerHTML = rows.join('');
}

function renderDonationsTable() {
  const tbody = document.getElementById('table-donations-full');
  if(!tbody) return;

  const query = normalizeSearch(document.getElementById('donations-search')?.value || '');
  const searchInput = document.getElementById('donations-search');
  if(searchInput && !searchInput.dataset.bound) {
    searchInput.addEventListener('input', renderDonationsTable);
    searchInput.dataset.bound = '1';
  }

  const filtered = getActiveBloodBags().filter(b => {
    return [b.id, b.donor, b.bloodType, b.productType, b.location, b.status].some(field => matchesSearchString(field, query));
  });

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-gray); padding:2rem;">${t('empty.donations')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(b => {
    let sBadge = uiBadge('donationStatusBadge', 'Pending', 'badge.donationPending', 'badge-warning');
    if (b.status === 'Approved') {
      sBadge = uiBadge('donationStatusBadge', 'Approved', 'badge.donationApproved', 'badge-success');
    }
    if (b.status === 'Reserved') {
      sBadge = uiBadge('donationStatusBadge', 'Reserved', 'badge.donationReserved', 'badge-info');
    }

    return `
      <tr>
        <td style="font-family:monospace; color:var(--info)">${b.id}</td>
        <td>${b.donor}</td>
        <td>${productLabel(b.productType || 'RBC')}</td>
        ${bloodTypeCell(b.bloodType)}
        <td>${b.qty} ${t('common.units')}</td>
        <td>${b.date}</td>
        <td>${sBadge}</td>
        <td><span style="font-size:11.5px; color:var(--text-gray)">${displayLocation(b.location)}</span></td>
      </tr>
    `;
  }).join('');
}

function renderLabModuleTable() {
  const tbody = document.getElementById('table-lab-full');
  if(!tbody) return;

  const searchQuery = document.getElementById('lab-search')?.value.toLowerCase().trim() || '';
  const statusFilter = document.getElementById('lab-filter-status')?.value || '';
  
  // Bind search event listener
  const searchInput = document.getElementById('lab-search');
  if(searchInput && !searchInput.dataset.bound) {
    searchInput.addEventListener('input', renderLabModuleTable);
    searchInput.dataset.bound = '1';
  }

  // Update summary counts
  const pending = bloodBags.filter(b => b.status === 'Pending').length;
  const approved = bloodBags.filter(b => b.status === 'Approved').length;
  const rejected = bloodBags.filter(b => b.status === 'Rejected').length;
  
  const pendingEl = document.getElementById('lab-pending-count');
  const approvedEl = document.getElementById('lab-approved-count');
  const rejectedEl = document.getElementById('lab-rejected-count');
  
  if(pendingEl) pendingEl.innerText = pending;
  if(approvedEl) approvedEl.innerText = approved;
  if(rejectedEl) rejectedEl.innerText = rejected;

  let filtered = bloodBags;
  
  if(statusFilter) {
    filtered = filtered.filter(b => b.status === statusFilter);
  } else {
    filtered = filtered.filter(b => b.status === 'Pending');
  }
  
  if(searchQuery) {
    filtered = filtered.filter(b => {
      const combined = `${b.id} ${b.donor}`.toLowerCase();
      return combined.includes(searchQuery);
    });
  }

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-gray);">${t('empty.labExtended')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(b => {
    let statusBadge = uiBadge('labStatusBadge', 'Pending', 'badge.labPending', 'badge-warning');
    if (b.status === 'Approved') {
      statusBadge = uiBadge('labStatusBadge', 'Approved', 'badge.labApproved', 'badge-success');
    }
    if (b.status === 'Rejected') {
      statusBadge = uiBadge('labStatusBadge', 'Rejected', 'badge.labRejected', 'badge-danger');
    }
    const actionButton = (currentUser && ['lab', 'superadmin'].includes(getAccountRole()))
      ? `<button class="btn btn-primary btn-sm" onclick="openLabTestWindow('${b.id}')">${t('btn.analyze')}</button>`
      : '';

    return `
      <tr>
        <td style="font-family:monospace; color:var(--info); font-weight:600;"><strong>${b.id}</strong></td>
        <td><strong>${b.donor}</strong></td>
        <td>${productLabel(b.productType || 'RBC')}</td>
        ${bloodTypeCell(b.bloodType)}
        <td>${statusBadge}</td>
        <td style="font-size:12px;">${b.date}</td>
        <td>${actionButton}</td>
      </tr>
    `;
  }).join('');
}

function renderRequestsTable() {
  const tbody = document.getElementById('table-requests-full');
  if(!tbody) return;

  const query = normalizeSearch(document.getElementById('request-search')?.value);
  const filtered = requests.filter(r => {
    return [r.id, r.hospital, r.blood, r.priority, r.status]
      .some(field => matchesSearchString(field, query));
  });

  const searchInput = document.getElementById('request-search');
  if(searchInput && !searchInput.dataset.bound) {
    searchInput.addEventListener('input', renderRequestsTable);
    searchInput.dataset.bound = '1';
  }

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-gray);">${t('empty.requestsSearch')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    let pBadge = (typeof I18n !== 'undefined' && I18n.ui && typeof I18n.ui.priorityBadge === 'function')
      ? I18n.ui.priorityBadge(r.priority || 'low')
      : `<span class="badge badge-info">${t('priority.badgeLow')}</span>`;
    if (!(typeof I18n !== 'undefined' && I18n.ui && typeof I18n.ui.priorityBadge === 'function')) {
      if (r.priority === 'critical') pBadge = `<span class="badge badge-danger">${t('priority.badgeCritical')}</span>`;
      if (r.priority === 'high') pBadge = `<span class="badge badge-warning">${t('priority.badgeHigh')}</span>`;
      if (r.priority === 'medium') pBadge = `<span class="badge badge-warning">${t('priority.badgeMedium')}</span>`;
    }

    const normalizedStatus = normalizeRequestStatus(r.status);
    const sBadge = getRequestStatusBadge(normalizedStatus);
    const actions = [];
    const role = getAccountRole();
    if (currentUser && role === 'superadmin' && normalizedStatus === 'قيد المراجعة') {
      actions.push(`<button class="btn btn-secondary btn-sm" onclick="approveRequest('${r.id}')">${t('btn.approve')}</button>`);
      actions.push(`<button class="btn btn-danger btn-sm" onclick="rejectRequest('${r.id}')">${t('btn.reject')}</button>`);
    }
    if (currentUser && role === 'admin' && normalizedStatus === 'تم القبول') {
      actions.push(`<button class="btn btn-primary btn-sm" onclick="openRequestDeliveryModal('${r.id}')">${t('btn.deliver')}</button>`);
    }

    return `
      <tr>
        <td style="font-family:monospace;">${r.id}</td>
        <td><strong>${r.hospital}</strong></td>
        ${bloodTypeCell(r.blood)}
        <td>${productLabel(r.productType || 'RBC')}</td>
        <td><strong>${r.qty} ${t('common.bags')}</strong></td>
        <td>${pBadge}</td>
        <td>${sBadge}</td>
        <td>${actions.length ? `<div style="display:flex; gap:0.5rem; flex-wrap:wrap;">${actions.join('')}</div>` : '<span style="color:var(--text-gray); font-size:12px;">-</span>'}</td>
      </tr>
    `;
  }).join('');
}

function renderDonorsTable() {
  const tbody = document.getElementById('table-donors-full');
  if(!tbody) return;

  const query = normalizeSearch(document.getElementById('donor-search')?.value || '');
  const filtered = donors.filter(d => {
    return [d.id, d.name, d.blood, d.phone, d.address, d.lastDate, d.nationalId]
      .some(field => matchesSearchString(field, query));
  });

  const searchInput = document.getElementById('donor-search');
  if(searchInput && !searchInput.dataset.bound) {
    searchInput.addEventListener('input', renderDonorsTable);
    searchInput.dataset.bound = '1';
  }

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-gray);">${t('empty.donors')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(d => `
    <tr>
      <td style="font-family:monospace;">${d.id}</td>
      <td><strong>${d.name}</strong></td>
      ${bloodTypeCell(d.blood)}
      <td>${d.phone}</td>
      <td>${d.age} ${t('common.years')}</td>
      <td>${d.address || t('common.unspecified')}</td>
      <td>${d.lastDate || t('common.none')}</td>
      <td>${d.totalCount || 0}</td>
    </tr>
  `).join('');
}

  function openDonationForExistingDonor(donorId) {
    const donor = donors.find(d => d.id === donorId);
    if(!donor) return;
    if (isAllStorageFull()) {
      alertT('msg.storage.donorSlotFull'); // ar: ⚠️ المخزون ممتلئ بالكامل — لا يمكن إضافة كيس جديد للمتبرع حتى يتم تفريغ مساحة.
      return;
    }
    openModal('modal-add-donation');
    toggleDonationMode('bag');
    const bloodSelect = document.getElementById('don-blood');
    const qtyInput = document.getElementById('don-qty');
    if(bloodSelect) bloodSelect.value = donor.blood || '';
    if(qtyInput) qtyInput.value = 1;
    triggerToast(t('toast.newDonation'), tf('toast.newDonationBody', { name: donor.name, blood: donor.blood || t('blood.unknown') }));
  }

function renderHospitalsTable() {
  const tbody = document.getElementById('table-hospitals-full');
  if(!tbody) return;

  const query = normalizeSearch(document.getElementById('hospital-search')?.value);
  const filtered = hospitals.filter(h => {
    return [h.name, h.address, h.phone, h.manager || '']
      .some(field => matchesSearchString(field, query));
  });

  const searchInput = document.getElementById('hospital-search');
  if(searchInput && !searchInput.dataset.bound) {
    searchInput.addEventListener('input', renderHospitalsTable);
    searchInput.dataset.bound = '1';
  }

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-gray);">${t('empty.hospitalsSearch')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(h => {
    const related = requests.filter(r => r.hospital === h.name);
    const totalQty = related.reduce((sum, item) => sum + item.qty, 0);
    const actions = renderHospitalCrudButtons(
      `openEditHospitalModal(${JSON.stringify(h.name)})`,
      `confirmDeleteHospital(${JSON.stringify(h.name)})`
    ) || `<span style="color:var(--text-gray); font-size:12px;">${t('render.notAvailable')}</span>`;
    return `
      <tr>
        <td><strong>${h.name}</strong><div style="font-size:12px; color:var(--text-gray); margin-top:4px;">${tf('render.hospitalTotalRequests', { count: related.length, bags: totalQty })}</div></td>
        <td>${h.address}</td>
        <td>${h.phone}</td>
        <td>${h.manager || t('common.unspecified')}</td>
        <td style="white-space:nowrap;">${actions}</td>
      </tr>
    `;
  }).join('');
}

async function executeAddHospital() {
  const name = document.getElementById('new-hospital-name').value.trim();
  const address = document.getElementById('new-hospital-address').value.trim();
  const manager = document.getElementById('new-hospital-manager').value.trim();
  const phone = document.getElementById('new-hospital-phone').value.trim();

  if(!name || !address || !phone || !manager) {
    alertT('msg.hospital.fieldsRequired'); // ar: يرجى إدخال جميع بيانات المستشفى.
    return;
  }

  try {
    await Drop4LifeAPI.createHospital({ name, address, phone, manager, status: 'Connected' });
    const actor = getAuditActor();
    await Drop4LifeAPI.pushAudit(actor.user, actor.role, t('auditAction.addHospital'), name);
    document.getElementById('new-hospital-name').value = '';
    document.getElementById('new-hospital-address').value = '';
    document.getElementById('new-hospital-manager').value = '';
    document.getElementById('new-hospital-phone').value = '';
    closeModal('modal-add-hospital');
    await syncFromServer();
    triggerToast('🏥 ' + t('toast.hospitalAdded'), name);
  } catch (err) {
    alert(trMsg(err.message));
  }
}

function renderHospitalDeliveriesTable() {
  const tbody = document.getElementById('table-hospital-deliveries-full');
  if(!tbody) return;

  const query = normalizeSearch(document.getElementById('hospital-delivery-search')?.value);
  const filtered = hospitalDeliveryRecords.filter(record => {
    return [record.id, record.hospital, record.blood, record.recipient, record.recipientPhone, record.deliveredBy]
      .some(field => matchesSearchString(field, query));
  });

  const searchInput = document.getElementById('hospital-delivery-search');
  if(searchInput && !searchInput.dataset.bound) {
    searchInput.addEventListener('input', renderHospitalDeliveriesTable);
    searchInput.dataset.bound = '1';
  }

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-gray);">${t('empty.deliveries')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(record => `
    <tr>
      <td style="font-family:monospace;">${record.id}</td>
      <td><strong>${record.hospital}</strong></td>
      ${bloodTypeCell(record.blood)}
      <td>${record.qty} ${t('common.bags')}</td>
      <td>${record.recipient}</td>
      <td>${record.recipientPhone}</td>
      <td>${record.deliveredAt}</td>
    </tr>
  `).join('');
}

function renderBeneficiariesTable() {
  const tbody = document.getElementById('table-beneficiaries-full');
  if (!tbody) return;

  renderBeneficiaryInventorySummary();

  const query = normalizeSearch(document.getElementById('beneficiaries-search')?.value || '');
  const searchInput = document.getElementById('beneficiaries-search');
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.addEventListener('input', () => {
      beneficiariesPage = 1;
      renderBeneficiariesTable();
    });
    searchInput.dataset.bound = '1';
  }

  const filtered = beneficiaries.filter((item) => {
    return [item.name, item.phone, item.nationalId, item.bloodTypeReceived, item.createdAt]
      .some((field) => matchesSearchString(field, query));
  });

  const countEl = document.getElementById('beneficiaries-count');
  if (countEl) {
    countEl.textContent = filtered.length
      ? tf(filtered.length === 1 ? 'render.beneficiaryCount' : 'render.beneficiaryCountPlural', { count: filtered.length })
      : t('render.noBeneficiaries');
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / BENEFICIARIES_PAGE_SIZE));
  if (beneficiariesPage > totalPages) beneficiariesPage = totalPages;

  const start = (beneficiariesPage - 1) * BENEFICIARIES_PAGE_SIZE;
  const pageItems = filtered.slice(start, start + BENEFICIARIES_PAGE_SIZE);
  const colSpan = 8;

  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center; color:var(--text-gray); padding:2rem;">${t('empty.beneficiaries')}</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map((item) => {
      const actions = canManageBeneficiaries()
        ? `<button class="btn btn-primary btn-sm" onclick="openEditBeneficiaryModal(${item.id})">✏️ ${t('common.edit')}</button>`
        : '';
      return `
        <tr>
          <td><strong>${escapeHtml(item.name)}</strong></td>
          <td>${escapeHtml(item.phone)}</td>
          <td style="font-family:monospace;">${escapeHtml(item.nationalId)}</td>
          ${bloodTypeCell(item.bloodTypeReceived)}
          <td>${productLabel(item.productTypeReceived || 'RBC')}</td>
          <td><strong>${item.bagsConsumed}</strong> ${t('common.bags')}</td>
          <td style="font-size:12px; color:var(--text-gray);">${formatBeneficiaryDate(item.createdAt)}</td>
          <td style="display:flex; gap:0.35rem; flex-wrap:wrap;">${actions || '—'}</td>
        </tr>
      `;
    }).join('');
  }

  const pagination = document.getElementById('beneficiaries-pagination');
  if (pagination) {
    pagination.innerHTML = totalPages <= 1 ? '' : Array.from({ length: totalPages }, (_, i) => {
      const page = i + 1;
      const active = page === beneficiariesPage ? 'btn-primary' : 'btn-secondary';
      return `<button class="btn btn-sm ${active}" onclick="goBeneficiariesPage(${page})">${page}</button>`;
    }).join('');
  }
}

function getBeneficiaryBloodStock(bloodType, productType = 'RBC') {
  const inv = bloodInventory[bloodType]?.[productType];
  if (!inv) return { exists: false, available: 0 };
  return { exists: true, available: Number(inv.available) || 0 };
}

function populateBeneficiaryBloodSelect(selectId, selectedType, forNew) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const productType = document.getElementById(selectId.replace('-blood', '-product'))?.value || 'RBC';
  const current = selectedType || select.value || BENEFICIARY_BLOOD_TYPES[0];
  select.innerHTML = BENEFICIARY_BLOOD_TYPES.map((type) => {
    const stock = getBeneficiaryBloodStock(type, productType);
    const label = stock.exists
      ? tf('render.stockAvailable', { type, available: stock.available, product: productLabel(productType) })
      : tf('render.stockUnavailable', { type });
    const disabled = forNew && (!stock.exists || stock.available <= 0);
    const selected = type === current ? 'selected' : '';
    return `<option value="${type}" ${selected} ${disabled ? 'disabled' : ''}>${label}</option>`;
  }).join('');
  if (forNew && !getBeneficiaryBloodStock(select.value, productType).available) {
    const firstAvailable = BENEFICIARY_BLOOD_TYPES.find((type) => {
      const stock = getBeneficiaryBloodStock(type, productType);
      return stock.exists && stock.available > 0;
    });
    if (firstAvailable) select.value = firstAvailable;
  }
}

function validateBeneficiaryInventory(bloodType, bagsNeeded, editingId, productType = 'RBC') {
  const stock = getBeneficiaryBloodStock(bloodType, productType);
  if (!stock.exists) {
    return tf('render.stockNotInInventory', { blood: bloodType, product: productLabel(productType) });
  }
  let available = stock.available;
  if (editingId) {
    const existing = beneficiaries.find((b) => String(b.id) === String(editingId));
    if (existing && existing.bloodTypeReceived === bloodType && (existing.productTypeReceived || 'RBC') === productType) {
      available += Number(existing.bagsConsumed) || 0;
    }
  }
  if (available < bagsNeeded) {
    return tf('msg.inventory.insufficientDetail', { available, bloodType, product: productLabel(productType), bagsNeeded });
  }
  return null;
}

function updateBeneficiaryStockHint(mode) {
  const prefix = mode === 'edit' ? 'edit' : 'new';
  const hintEl = document.getElementById(`${prefix}-beneficiary-stock-hint`);
  const bloodType = document.getElementById(`${prefix}-beneficiary-blood`)?.value;
  const productType = document.getElementById(`${prefix}-beneficiary-product`)?.value || 'RBC';
  const bags = parseInt(document.getElementById(`${prefix}-beneficiary-bags`)?.value, 10) || 1;
  const editingId = prefix === 'edit' ? document.getElementById('edit-beneficiary-id')?.value : null;
  if (!hintEl || !bloodType) return;

  const stock = getBeneficiaryBloodStock(bloodType, productType);
  const error = validateBeneficiaryInventory(bloodType, bags, editingId, productType);
  if (error) {
    hintEl.style.background = 'rgba(220,53,69,0.08)';
    hintEl.style.color = 'var(--red)';
    hintEl.textContent = `⚠️ ${error}`;
    return;
  }
  hintEl.style.background = 'rgba(34,197,94,0.08)';
  hintEl.style.color = 'var(--success)';
  hintEl.textContent = tf('render.stockSufficient', { available: stock.available, blood: bloodType, bags });
}

function formatBeneficiaryDate(isoValue) {
  if (!isoValue) return t('common.empty');
  if (typeof formatLocaleDateTime === 'function') return formatLocaleDateTime(isoValue);
  try {
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return isoValue;
    return date.toLocaleString(getDateLocale ? getDateLocale() : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return isoValue;
  }
}

function renderBeneficiaryInventorySummary() {
  const container = document.getElementById('beneficiary-inventory-summary');
  if (!container) return;
  container.innerHTML = BENEFICIARY_BLOOD_TYPES.map((type) => {
    const parts = BENEFICIARY_PRODUCT_TYPES.map((productType) => {
      const stock = getBeneficiaryBloodStock(type, productType);
      const available = stock.available;
      let badgeClass = 'badge-success';
      if (!stock.exists || available <= 0) badgeClass = 'badge-danger';
      else if (available <= 10) badgeClass = 'badge-warning';
      return `<div style="font-size:11px; margin-top:0.2rem;"><span class="badge ${badgeClass}">${productLabel(productType)}: ${stock.exists ? available : 0}</span></div>`;
    }).join('');
    return `
      <div style="padding:0.65rem 0.75rem; border-radius:12px; border:1px solid rgba(148,163,184,0.18); background:rgba(255,255,255,0.88); text-align:center;">
        <div style="font-weight:800; margin-bottom:0.25rem;">${type}</div>
        ${parts}
      </div>
    `;
  }).join('');
}

async function refreshBeneficiariesPage() {
  try {
    await Drop4LifeAPI.loadBeneficiaries();
    rebindLiveDataRefs();
  } catch (err) {
    console.warn('Failed loading beneficiaries', err);
  }
  renderAllViews();
}

function goBeneficiariesPage(page) {
  beneficiariesPage = page;
  renderBeneficiariesTable();
}

function openEditBeneficiaryModal(id) {
  if (!canManageBeneficiaries()) {
    alertT('msg.beneficiary.editDenied'); // ar: فقط المسؤول الأعلى أو الأدمن يمكنه تعديل المستفيدين.
    return;
  }
  const item = beneficiaries.find((b) => b.id === id);
  if (!item) return;
  document.getElementById('edit-beneficiary-id').value = item.id;
  document.getElementById('edit-beneficiary-name').value = item.name;
  document.getElementById('edit-beneficiary-phone').value = item.phone;
  document.getElementById('edit-beneficiary-national-id').value = item.nationalId;
  document.getElementById('edit-beneficiary-bags').value = item.bagsConsumed;
  document.getElementById('edit-beneficiary-product').value = item.productTypeReceived || 'RBC';
  populateBeneficiaryBloodSelect('edit-beneficiary-blood', item.bloodTypeReceived, false);
  updateBeneficiaryStockHint('edit');
  openModal('modal-edit-beneficiary');
}

async function executeAddBeneficiary() {
  if (!canManageBeneficiaries()) {
    alertT('msg.beneficiary.addDenied'); // ar: فقط المسؤول الأعلى أو الأدمن يمكنه إضافة مستفيدين.
    return;
  }
  const name = document.getElementById('new-beneficiary-name').value.trim();
  const phone = document.getElementById('new-beneficiary-phone').value.trim();
  const nationalId = document.getElementById('new-beneficiary-national-id').value.trim();
  const bloodTypeReceived = document.getElementById('new-beneficiary-blood').value;
  const productTypeReceived = document.getElementById('new-beneficiary-product').value || 'RBC';
  const bagsConsumed = parseInt(document.getElementById('new-beneficiary-bags').value, 10) || 1;

  if (!name || !phone || !nationalId) {
    alertT('msg.form.requiredFields'); // ar: يرجى ملء جميع الحقول المطلوبة.
    return;
  }
  const phoneError = validatePhone11(phone, t('msg.validation.phone'));
  if (phoneError) { alert(phoneError); return; }
  const nationalError = validateNationalId14(nationalId, t('msg.validation.nationalId'));
  if (nationalError) { alert(nationalError); return; }
  if (!bloodTypeReceived) {
    alertT('msg.beneficiary.bloodRequired'); // ar: يرجى اختيار فصيلة الدم.
    return;
  }

  const inventoryError = validateBeneficiaryInventory(bloodTypeReceived, bagsConsumed, null, productTypeReceived);
  if (inventoryError) {
    alert(inventoryError);
    return;
  }

  try {
    await Drop4LifeAPI.createBeneficiary({ name, phone, nationalId, bloodTypeReceived, productTypeReceived, bagsConsumed });
    if (currentUser) {
      const actor = getAuditActor();
      await Drop4LifeAPI.pushAudit(
        actor.user,
        actor.role,
        t('auditAction.addBeneficiary'),
        `${name} — ${bloodTypeReceived} (${productLabel(productTypeReceived)}) × ${bagsConsumed} ${t('common.bags')}`
      );
    }
    document.getElementById('new-beneficiary-name').value = '';
    document.getElementById('new-beneficiary-phone').value = '';
    document.getElementById('new-beneficiary-national-id').value = '';
    document.getElementById('new-beneficiary-bags').value = '1';
    closeModal('modal-add-beneficiary');
    await syncFromServer();
    triggerToast(t('toast.beneficiaryAdded'), `${name} — ${t('toast.beneficiaryDeducted').replace('{bags}', bagsConsumed).replace('{blood}', bloodTypeReceived).replace('{product}', productLabel(productTypeReceived))}`);
  } catch (err) {
    alert(trMsg(err.message));
  }
}

async function executeSaveBeneficiary() {
  if (!canManageBeneficiaries()) {
    alertT('msg.beneficiary.editDenied'); // ar: فقط المسؤول الأعلى أو الأدمن يمكنه تعديل المستفيدين.
    return;
  }
  const id = document.getElementById('edit-beneficiary-id').value;
  const body = {
    name: document.getElementById('edit-beneficiary-name').value.trim(),
    phone: document.getElementById('edit-beneficiary-phone').value.trim(),
    nationalId: document.getElementById('edit-beneficiary-national-id').value.trim(),
    bloodTypeReceived: document.getElementById('edit-beneficiary-blood').value,
    productTypeReceived: document.getElementById('edit-beneficiary-product').value || 'RBC',
    bagsConsumed: parseInt(document.getElementById('edit-beneficiary-bags').value, 10) || 1,
  };

  if (!body.name || !body.phone || !body.nationalId) {
    alertT('msg.form.requiredFields'); // ar: يرجى ملء جميع الحقول المطلوبة.
    return;
  }
  const phoneError = validatePhone11(body.phone, t('msg.validation.phone'));
  if (phoneError) { alert(phoneError); return; }
  const nationalError = validateNationalId14(body.nationalId, t('msg.validation.nationalId'));
  if (nationalError) { alert(nationalError); return; }

  const inventoryError = validateBeneficiaryInventory(body.bloodTypeReceived, body.bagsConsumed, id, body.productTypeReceived);
  if (inventoryError) {
    alert(inventoryError);
    return;
  }

  try {
    await Drop4LifeAPI.updateBeneficiary(id, body);
    if (currentUser) {
      const actor = getAuditActor();
      await Drop4LifeAPI.pushAudit(
        actor.user,
        actor.role,
        t('auditAction.editBeneficiary'),
        `${body.name} — ${body.bloodTypeReceived} × ${body.bagsConsumed} ${t('common.bags')}`
      );
    }
    closeModal('modal-edit-beneficiary');
    await syncFromServer();
    triggerToast(t('toast.beneficiaryUpdated'), body.name);
  } catch (err) {
    alert(trMsg(err.message));
  }
}

function confirmDeleteBeneficiary(id) {
  if (!canManageBeneficiaries()) return;
  const item = beneficiaries.find((b) => b.id === id);
  if (!item) return;
  if (!confirmT('msg.confirm.deleteBeneficiary', { name: item.name, bags: item.bagsConsumed, blood: item.bloodTypeReceived })) return;
  void executeDeleteBeneficiaryById(id);
}

async function executeDeleteBeneficiary() {
  const id = document.getElementById('edit-beneficiary-id').value;
  const item = beneficiaries.find((b) => String(b.id) === String(id));
  if (!confirmT('msg.confirm.deleteBeneficiaryShort', { name: item ? item.name : '' })) return;
  await executeDeleteBeneficiaryById(id);
}

async function executeDeleteBeneficiaryById(id) {
  if (!canManageBeneficiaries()) {
    alertT('msg.beneficiary.deleteDenied'); // ar: فقط المسؤول الأعلى أو الأدمن يمكنه حذف المستفيدين.
    return;
  }
  const item = beneficiaries.find((b) => String(b.id) === String(id));
  try {
    await Drop4LifeAPI.deleteBeneficiary(id);
    if (currentUser && item) {
      const actor = getAuditActor();
      await Drop4LifeAPI.pushAudit(
        actor.user,
        actor.role,
        t('auditAction.deleteBeneficiary'),
        `${item.name} — ${item.bloodTypeReceived} × ${item.bagsConsumed} ${t('common.bags')}`
      );
    }
    closeModal('modal-edit-beneficiary');
    await syncFromServer();
    triggerToast(t('toast.beneficiaryDeleted'), item ? t('toast.beneficiaryRestored').replace('{bags}', item.bagsConsumed) : t('toast.recordDeleted'));
  } catch (err) {
    alert(trMsg(err.message));
  }
}

function renderAuditTable() {
  const tbody = document.getElementById('table-audit-full');
  if(!tbody) return;

  const auditActions = document.getElementById('audit-admin-actions');
  if (auditActions) {
    auditActions.style.display = isSuperUser() ? 'flex' : 'none';
  }

  if (!isSuperUser()) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--red); font-weight:700; padding:2rem;">${t('empty.auditDenied')}</td></tr>`;
    return;
  }

  const query = document.getElementById('audit-search')?.value.toLowerCase().trim() || '';
  const filtered = auditLogs.filter(l => {
    const combined = `${l.time} ${l.user} ${l.role} ${l.action} ${l.details}`.toLowerCase();
    return combined.includes(query);
  });

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-gray); padding:2rem;">${t('empty.audit')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(l => `
    <tr>
      <td style="font-family:monospace; font-size:12px; white-space:nowrap;">${escapeHtml(l.time)}</td>
      <td style="color:var(--info)"><strong>${escapeHtml(l.user)}</strong></td>
      <td><span class="badge badge-info">${escapeHtml(getRoleLabel(l.role))}</span></td>
      <td><strong>${escapeHtml(typeof translateAuditText === 'function' ? translateAuditText(l.action) : l.action)}</strong></td>
      <td style="color:var(--text-gray); font-size:12.5px; white-space:pre-wrap; word-break:break-word; max-width:360px;">${escapeHtml(typeof translateAuditText === 'function' ? translateAuditText(l.details) : l.details)}</td>
    </tr>
  `).join('');
}

function renderDisposalTable() {
  const tbody = document.getElementById('table-disposal-full');
  if(!tbody) return;

  const query = normalizeSearch(document.getElementById('disposal-search')?.value);
  const filtered = disposalLogs.filter(l => {
    const diseases = Array.isArray(l.detectedDiseases) ? l.detectedDiseases.join(' ') : '';
    return [l.id, l.type, l.blood, l.productType, l.date, l.reason, l.worker, l.donorName, diseases]
      .some(field => matchesSearchString(field, query));
  });

  const searchInput = document.getElementById('disposal-search');
  if(searchInput && !searchInput.dataset.bound) {
    searchInput.addEventListener('input', renderDisposalTable);
    searchInput.dataset.bound = '1';
  }

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-gray);">${t('empty.disposalSearch')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(l => {
    const diseases = Array.isArray(l.detectedDiseases) ? l.detectedDiseases : [];
    const diseaseHtml = diseases.length
      ? diseases.map(d => `<span class="badge badge-danger" style="margin:0.1rem;">${escapeHtml(d)}</span>`).join(' ')
      : '<span style="color:var(--text-gray); font-size:12px;">—</span>';
    const donorHtml = l.donorName
      ? escapeHtml(l.donorName)
      : '<span style="color:var(--text-gray); font-size:12px;">—</span>';
    return `
    <tr>
      <td style="font-family:monospace; color:var(--text-gray)">${l.id}</td>
      <td>${l.type}</td>
      <td>${productLabel(l.productType || 'RBC')}</td>
      ${bloodTypeCell(l.blood)}
      <td>${donorHtml}</td>
      <td>${diseaseHtml}</td>
      <td>${l.date}</td>
      <td><span class="badge badge-danger">${escapeHtml(typeof trMsg === 'function' ? trMsg(l.reason) : l.reason)}</span></td>
      <td style="font-size:12px; color:var(--text-gray)">${escapeHtml(displayWorker(l.worker))}</td>
    </tr>
  `;
  }).join('');
}

function renderStoragePage() {
  const container = document.getElementById('storage-grid');
  if(!container) return;

  container.innerHTML = storageUnits.map(room => {
    const fridgeHtml = room.fridges.map(f => {
      const maxCap = getFridgeMaxCapacity(room, f);
      const used = Number(f.used) || 0;
      const pct = maxCap > 0 ? Math.min(Math.round((used / maxCap) * 100), 100) : 0;
      const full = isFridgeFull(f, room);
      const barColor = full || pct >= 100 ? 'var(--red)' : pct > 80 ? 'var(--gold)' : 'var(--success)';
      const fullBadge = full
        ? `<span class="badge badge-danger" style="font-size:10px;">${t('storage.fridgeFull')}</span>`
        : '';
      return `
        <div class="card" style="background:rgba(255,255,255,0.92); padding:1rem; border-radius:18px; ${full ? 'border:1px solid rgba(220,53,69,0.35);' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.75rem; flex-wrap:wrap;">
            <strong>${escapeHtml(f.id)}</strong>
            <div style="display:flex; align-items:center; gap:0.35rem;">${fullBadge}<span>${pct}%</span></div>
          </div>
          <div style="font-size:11px; color:var(--text-gray); margin-bottom:0.5rem;">${used} / ${maxCap} ${t('storage.unitsUsed')}</div>
          <div style="height:8px; background:rgba(226,232,240,0.8); border-radius:999px;"><div style="width:${pct}%; height:100%; border-radius:999px; background:${barColor}"></div></div>
        </div>
      `;
    }).join('');

    const roomPct = room.capacity > 0 ? Math.min(Math.round((room.used / room.capacity) * 100), 100) : 0;
    return `
      <div class="card" style="padding:1rem; background:rgba(255,255,255,0.95); border-radius:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; gap:0.5rem; flex-wrap:wrap;">
          <h3 style="font-size:18px; margin:0;">${escapeHtml(room.room)}</h3>
          <span class="badge ${roomPct > 80 ? 'badge-danger' : roomPct > 60 ? 'badge-warning' : 'badge-success'}">${roomPct}% ${t('storage.occupied')}</span>
        </div>
        <div style="margin-bottom:1rem; color:var(--text-gray); font-size:13px;">${t('storage.fridges')}: ${room.fridges.length} — ${t('storage.roomCapacity')}: ${room.capacity} ${t('common.units')}</div>
        <div style="display:grid; gap:0.9rem;">${fridgeHtml}</div>
      </div>
    `;
  }).join('');
}

function getRequestsNavBadgeCount() {
  if (!currentUser) return 0;
  const role = getAccountRole();
  if (role === 'superadmin') {
    return requests.filter(r => normalizeRequestStatus(r.status) === 'قيد المراجعة').length;
  }
  if (role === 'admin') {
    return requests.filter(r => normalizeRequestStatus(r.status) === 'تم القبول').length;
  }
  return 0;
}

function updateRequestsNavBadge() {
  const badge = document.getElementById('badge-requests-count');
  if (!badge) return;
  const count = getRequestsNavBadgeCount();
  badge.innerText = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function updateTopbarBadges() {
  const topbarMsgBadge = document.getElementById('topbar-messages-badge');
  const topbarNotifBadge = document.getElementById('topbar-notifications-badge');
  const isNotificationsPage = document.getElementById('page-notifications')?.classList.contains('active');
  const isMessagesPage = document.getElementById('page-messages')?.classList.contains('active');

  const unreadNotifications = notifications.filter((note) => !note.read).length;
  const unreadMessages = getUnreadMessagesCount();
  const showMsgBadge = !isMessagesPage && unreadMessages > 0;
  const showNotifBadge = !isNotificationsPage && unreadNotifications > 0;
  const msgCount = formatBadgeCount(unreadMessages);
  const notifCount = formatBadgeCount(unreadNotifications);

  if (topbarMsgBadge) {
    topbarMsgBadge.innerText = msgCount;
    topbarMsgBadge.style.display = showMsgBadge ? 'inline-block' : 'none';
  }
  if (topbarNotifBadge) {
    topbarNotifBadge.innerText = notifCount;
    topbarNotifBadge.style.display = showNotifBadge ? 'inline-block' : 'none';
  }
}

async function markNotificationsRead() {
  const unread = notifications.filter(n => !n.read && n.id);
  if (!unread.length) return;
  for (const note of unread) {
    try {
      await Drop4LifeAPI.updateNotification(note.id, {
        title: note.title,
        type: note.type,
        time: note.time,
        message: note.message,
        read: true
      });
      note.read = true;
    } catch (_) {}
  }
  updateTopbarBadges();
}

function renderNotificationsPage() {
  const list = document.getElementById('notifications-list');
  if(!list) return;

  const notifActions = document.getElementById('notifications-admin-actions');
  if (notifActions) {
    notifActions.style.display = isSuperUser() ? 'flex' : 'none';
  }

  const isActive = document.getElementById('page-notifications')?.classList.contains('active');
  if (isActive && !notificationsPageHandled) {
    notificationsPageHandled = true;
    void markNotificationsRead();
  }
  updateTopbarBadges();

  if(notifications.length === 0) {
    list.innerHTML = `<div style="padding:2rem; color:var(--text-gray);">${t('empty.notifications')}</div>`;
    return;
  }

  list.innerHTML = `
    ${notifications.map(note => `
      <div class="card" style="margin-bottom:1rem; padding:1rem; background:rgba(255,255,255,0.92); border-radius:18px; ${note.read ? 'opacity:0.75;' : 'border-right:3px solid var(--red);'}">
        <div style="display:flex; justify-content:space-between; gap:1rem; margin-bottom:0.5rem;"><strong>${escapeHtml(typeof trMsg === 'function' ? trMsg(note.title) : note.title)}</strong><span style="color:var(--text-gray); font-size:13px;">${escapeHtml(note.time)}</span></div>
        <div style="color:var(--text-gray);">${escapeHtml(typeof trMsg === 'function' ? trMsg(note.message) : note.message)}</div>
      </div>
    `).join('')}
  `;
}

async function markMessagesSeen() {
  if (!currentUser) return;
  const pending = getChatMessages().filter((msg) => msg.id && !isMessageSeenByUser(msg));
  if (!pending.length) return;
  for (const msg of pending) {
    const seenBy = Array.isArray(msg.seenBy) ? [...msg.seenBy] : [];
    if (!seenBy.includes(currentUser.username)) seenBy.push(currentUser.username);
    try {
      await Drop4LifeAPI.updateMessage(msg.id, {
        time: msg.time,
        text: msg.text,
        seenBy
      });
      msg.seenBy = seenBy;
      msg.seenByNames = resolveSeenByNames(seenBy, msg.seenByNames);
    } catch (_) {}
  }
  updateTopbarBadges();
}

function resolveSeenByNames(seenBy, existingNames) {
  if (Array.isArray(existingNames) && existingNames.length) {
    return existingNames;
  }
  const names = [];
  const seen = new Set();
  (seenBy || []).forEach((token) => {
    const account = accounts.find((acc) => acc.username === token || acc.name === token);
    const display = account ? account.name : token;
    if (display && !seen.has(display)) {
      seen.add(display);
      names.push(display);
    }
  });
  return names;
}

function getMessagesChronological() {
  return [...getChatMessages()].reverse();
}

function buildChatMessagesHtml(chronological) {
  const emptyChip = chronological.length === 0
    ? `<div class="wa-date-chip">${t('chat.empty')}</div>`
    : '';
  const bubbles = chronological.map((msg, index) => {
    const senderName = displayChatSender(msg.sender_name || 'Unknown');
    const isSystem = isSystemBroadcastMessage(msg);
    const currentUserName = currentUser ? (currentUser.name || currentUser.username) : '';
    const isCurrentUser = currentUser && senderName === currentUserName;
    const bubbleClass = isSystem ? 'system' : (isCurrentUser ? 'me' : 'other');
    const initials = senderName.split(' ').map((word) => word[0] || '').join('').slice(0, 2).toUpperCase();
    const isSuperAdmin = isSuperUser();
    const seenUsers = Array.isArray(msg.seenByNames) && msg.seenByNames.length
      ? msg.seenByNames
      : resolveSeenByNames(msg.seenBy, msg.seenByNames);
    const othersSeen = seenUsers.some((name) => currentUser && name !== currentUserName);
    const ticksClass = othersSeen ? 'wa-ticks' : 'wa-ticks sent';
    const ticks = isCurrentUser ? `<span class="${ticksClass}">${othersSeen ? '✓✓' : '✓'}</span>` : '';
    const showSender = !isCurrentUser && !isSystem;
    return `
      <div class="chat-message ${bubbleClass}" data-msg-index="${index}">
        ${showSender ? `
          <div class="chat-sender">
            <div class="chat-bubble-header">
              <span class="chat-bubble-avatar">${escapeHtml(initials)}</span>
              <strong>${escapeHtml(senderName)}</strong>
            </div>
          </div>
        ` : ''}
        <div class="chat-text">${escapeHtml(msg.text)}</div>
        <div class="chat-meta">
          <span>${escapeHtml(msg.time)}</span>
          ${ticks}
        </div>
        ${isSuperAdmin ? `
          <div style="margin-top:0.35rem;">
            <button class="btn btn-secondary btn-sm" style="padding:0.35rem 0.7rem; font-size:11px;" onclick="toggleSeenDetailsForMsg(${index})">${t('chat.view')}</button>
            <div id="seen-users-list-${index}" style="display:none; margin-top:0.4rem; color:var(--success); font-size:11px; font-weight:600;">${t('chat.seenBy')} ${seenUsers.length > 0 ? seenUsers.map(escapeHtml).join(', ') : t('chat.notSeenYet')}</div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
  return emptyChip + bubbles;
}

function renderMessagesPage() {
  const area = document.getElementById('messages-area');
  if (!area) return;

  const msgActions = document.getElementById('messages-admin-actions');
  if (msgActions) {
    msgActions.style.display = isSuperUser() ? 'flex' : 'none';
  }

  const isActive = document.getElementById('page-messages')?.classList.contains('active');
  if (isActive && currentUser && !messagesPageHandled) {
    messagesPageHandled = true;
    void markMessagesSeen();
  }

  updateTopbarBadges();

  const chronological = getMessagesChronological();
  const activeAccounts = accounts.filter((acc) => acc.status !== 'inactive').length;
  const onlineLabel = activeAccounts > 0
    ? tf('chat.activeAccounts', { count: activeAccounts })
    : t('chat.allCloud');
  const messagesHtml = buildChatMessagesHtml(chronological);

  const existingScroll = area.querySelector('#wa-chat-scroll');
  if (existingScroll) {
    const headerTitle = area.querySelector('.wa-chat-header-title');
    const headerSub = area.querySelector('.wa-chat-header-sub');
    if (headerTitle) headerTitle.textContent = t('chat.title');
    if (headerSub) headerSub.textContent = `${t('chat.livePrefix')} ${onlineLabel}`;
    const msgInput = area.querySelector('#msg-text');
    if (msgInput) msgInput.placeholder = t('chat.placeholder');
    const sendBtn = area.querySelector('.wa-send-btn');
    if (sendBtn) sendBtn.title = t('chat.sendTitle');
    const liveDot = area.querySelector('.wa-chat-live-dot');
    if (liveDot) liveDot.title = tf('chat.liveUpdate', { seconds: LIVE_SYNC_INTERVAL_MS / 1000 });

    const wasAtBottom = existingScroll.scrollHeight - existingScroll.scrollTop - existingScroll.clientHeight < 80;
    existingScroll.innerHTML = messagesHtml;
    if (wasAtBottom) {
      existingScroll.scrollTop = existingScroll.scrollHeight;
    }
    return;
  }

  area.innerHTML = `
    <div class="wa-chat-shell">
      <div class="wa-chat-header">
        <div>
          <div class="wa-chat-header-title">${t('chat.title')}</div>
          <div class="wa-chat-header-sub">${t('chat.livePrefix')} ${onlineLabel}</div>
        </div>
        <div class="wa-chat-live-dot" title="${tf('chat.liveUpdate', { seconds: LIVE_SYNC_INTERVAL_MS / 1000 })}"></div>
      </div>
      <div class="wa-chat-body" id="wa-chat-scroll">
        ${messagesHtml}
      </div>
      <form class="wa-composer" autocomplete="off" novalidate onsubmit="event.preventDefault(); sendMessage();">
        <input id="msg-text" type="text" class="form-control" name="drop4life-chat-message" placeholder="${t('chat.placeholder')}" autocomplete="off" autocorrect="on" autocapitalize="sentences" spellcheck="true" data-lpignore="true" data-form-type="other" inputmode="text" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage();}" />
        <button type="submit" class="wa-send-btn" title="${t('chat.sendTitle')}">➤</button>
      </form>
    </div>
  `;

  const chatContainer = area.querySelector('#wa-chat-scroll');
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

function toggleSeenDetailsForMsg(msgIndex) {
  const detailsDiv = document.getElementById(`seen-users-list-${msgIndex}`);
  if(detailsDiv) {
    detailsDiv.style.display = detailsDiv.style.display === 'none' ? 'block' : 'none';
  }
}

function renderProfilePage() {
  if(!currentUser) return;
  const nameInput = document.getElementById('profile-name');
  const emailInput = document.getElementById('profile-email');
  const roleInput = document.getElementById('profile-role');
  if(!nameInput || !emailInput || !roleInput) return;

  const profileActive = document.getElementById('page-profile')?.classList.contains('active');
  const preserveInputs = profileActive && window.profileFormDirty;

  if (!preserveInputs) {
    nameInput.value = currentUser?.name || currentUser?.username || '';
    emailInput.value = currentUser?.email || `${currentUser?.username || 'user'}@drop4life.local`;
  }
  roleInput.value = getRoleLabel(getAccountRole());
}


async function sendMessage() {
  const input = document.getElementById('msg-text');
  if (!input || !currentUser) return;
  const text = input.value.trim();
  if (!text) return;
  try {
    await Drop4LifeAPI.createMessage({
      time: typeof formatLocaleTime === 'function' ? formatLocaleTime(new Date()) : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      text,
      seenBy: [currentUser.username]
    });
    input.value = '';
    await syncFromServer();
  } catch (err) {
    alert(trMsg(err.message));
  }
}

async function saveProfile() {
  const nameInput = document.getElementById('profile-name');
  const passwordInput = document.getElementById('profile-password');
  if(!nameInput || !passwordInput || !currentUser) return;
  const body = { name: nameInput.value.trim() || currentUser?.name || currentUser?.username || '', email: currentUser?.email || '' };
  const newPassword = passwordInput.value;
  if (newPassword) {
    if (newPassword.length < 4) {
      alertT('msg.profile.passwordMin'); // ar: كلمة المرور يجب أن تكون 4 أحرف على الأقل.
      return;
    }
    body.password = newPassword;
  }
  try {
    const updated = await Drop4LifeAPI.updateProfile(body);
    window.profileFormDirty = false;
    currentUser.name = updated.name || body.name;
    currentUser.email = updated.email || body.email;
    window.currentUser = currentUser;
    Drop4LifeAPI.saveAuthSession(currentUser);
    passwordInput.value = '';
    await syncFromServer();
    triggerToast(t('toast.profileUpdated'), body.password ? t('toast.profilePasswordUpdated') : t('toast.profileSaved'));
  } catch (err) {
    alert(trMsg(err.message));
  }
}

function toggleProfileMenu() {
  const menu = document.getElementById('profile-menu');
  if (!menu) return;
  menu.classList.toggle('open');
}

document.addEventListener('click', (event) => {
  const wrapper = document.querySelector('.profile-menu-wrapper');
  const menu = document.getElementById('profile-menu');
  if (wrapper && menu && !wrapper.contains(event.target)) {
    menu.classList.remove('open');
  }
  if (!event.target.closest('#req-hospital-input') && !event.target.closest('#hospital-suggestions')) {
    hideHospitalSuggestions();
  }
});

function canDisposeBag() {
  return currentUser && ['superadmin', 'admin'].includes(getAccountRole());
}

function openDisposeBagModal(bagId) {
  if (!canDisposeBag()) {
    alertT('msg.bag.disposeDenied'); // ar: فقط الأدمن أو السوبر أدمن يمكنه إتلاف أكياس من المخزون.
    return;
  }
  const bag = bloodBags.find((b) => b.id === bagId);
  if (!bag) {
    alertT('msg.bag.notFound'); // ar: الكيس غير موجود.
    return;
  }
  if (bag.status === 'Pending') {
    alertT('msg.bag.stillInLab'); // ar: الكيس لا يزال في المعمل. استخدم رفض التحليل لإتلافه.
    return;
  }
  document.getElementById('dispose-bag-id').value = bagId;
  document.getElementById('dispose-bag-code-display').value = bagId;
  document.getElementById('dispose-bag-blood-display').value = bag.bloodType || '—';
  document.getElementById('dispose-bag-product-display').value = productLabel(bag.productType || 'RBC');
  document.getElementById('dispose-bag-reason').value = '';
  openModal('modal-dispose-bag');
}

async function executeDisposeBagModal() {
  const bagId = document.getElementById('dispose-bag-id').value;
  const reason = document.getElementById('dispose-bag-reason').value.trim();
  if (!bagId || !reason) {
    alertT('msg.bag.disposeReasonRequired'); // ar: يرجى كتابة سبب الإتلاف.
    return;
  }
  const bag = bloodBags.find((b) => b.id === bagId);
  if (!bag) {
    alertT('msg.bag.notFound'); // ar: الكيس غير موجود.
    return;
  }
  try {
    const requestorName = currentUser ? (currentUser.name || currentUser.username) : 'Unknown';
    await Drop4LifeAPI.dispose({
      bagId,
      type: productLabel(bag.productType || 'RBC'),
      blood: bag.bloodType,
      reason,
      worker: requestorName,
    });
    closeModal('modal-dispose-bag');
    await syncFromServer();
    triggerToast(t('toast.bagDisposed'), tf('toast.bagDisposedBody', { id: bagId }));
  } catch (err) {
    alert(trMsg(err.message));
  }
}

async function executeDispose() {
  const bagId = document.getElementById('dispose-bag').value.trim();
  const type = document.getElementById('dispose-type').value;
  const reason = document.getElementById('dispose-reason').value.trim();
  if(!bagId || !reason) { alertT('msg.disposal.bagAndReasonRequired'); return; } // ar: يرجى إدخال كود الكيس وسبب التخلص الطبي
  const bag = bloodBags.find(b => b.id === bagId);
  if(!bag) { alertT('msg.bag.notInInventory'); return; } // ar: الكيس غير موجود في المخزون
  try {
    const requestorName = currentUser ? (currentUser.name || currentUser.username) : 'Unknown';
    await Drop4LifeAPI.dispose({
      bagId,
      type,
      blood: bag.bloodType,
      reason,
      worker: requestorName
    });
    await syncFromServer();
    document.getElementById('dispose-bag').value = '';
    document.getElementById('dispose-type').value = '';
    document.getElementById('dispose-reason').value = '';
    triggerToast(t('toast.disposalSaved'), tf('toast.disposalSavedBody', { id: bagId }));
  } catch (err) {
    alert(trMsg(err.message));
  }
}

// ==================== TRANSACTIONAL & CLINICAL CONTROLS ====================
function viewDonorProfileHistory(id) {
  const d = donors.find(x => x.id === id);
  if(!d) return;

  document.getElementById('dp-title').innerText = tf('render.donorProfileTitle', { name: d.name });
  document.getElementById('dp-count').innerText = tf('render.donorProfileCount', { count: d.totalCount });
  document.getElementById('dp-last-date').innerText = d.lastDate || t('render.noPreviousDonation');
  document.getElementById('dp-national').innerText = d.nationalId || t('common.unspecified');
  
  openModal('modal-donor-profile');
}

function openLabTestWindow(bagId) {
  if (!currentUser || !['superadmin', 'lab'].includes(getAccountRole())) {
    triggerToast(t('toast.labAccessDeniedTitle'), t('toast.labAccessDeniedBody'));
    return;
  }
  const bag = bloodBags.find(b => b.id === bagId);
  document.getElementById('lab-bag-id').value = bagId;
  document.getElementById('lab-type').value = '';
  document.getElementById('lab-product-type').value = bag ? (productLabel(bag.productType || 'Whole')) : '';
  const splitHint = document.getElementById('lab-split-hint');
  if (splitHint) {
    const isWhole = !bag || bag.status === 'Pending' || bag.productType === 'Whole';
    splitHint.style.display = isWhole ? 'block' : 'none';
  }
  document.getElementById('lab-reason').value = "";
  renderLabDiseaseButtons();
  openModal('modal-lab-test');
}

function renderLabDiseaseButtons() {
  const container = document.getElementById('lab-disease-list');
  if (!container) return;
  const diseases = [
    'HIV',
    'HBV',
    'HCV',
    'Syphilis',
    'Malaria',
    'Brucellosis',
    'HTLV',
  ];
  container.innerHTML = diseases.map((name) => `
    <button type="button" class="btn btn-secondary btn-sm lab-disease-btn" data-disease="${name}" onclick="toggleLabDisease(this)">${name}</button>
  `).join('');
}

function toggleLabDisease(button) {
  if (!button) return;
  button.classList.toggle('active');
}

function getSelectedLabDiseases() {
  return Array.from(document.querySelectorAll('.lab-disease-btn.active')).map((btn) => btn.dataset.disease).filter(Boolean);
}

async function submitLabResult(decision) {
  const bagId = document.getElementById('lab-bag-id').value;
  const bag = bloodBags.find(b => b.id === bagId);
  if(!bag) return;

  const finalType = document.getElementById('lab-type').value;
  const reason = document.getElementById('lab-reason').value.trim();
  const diseases = getSelectedLabDiseases();

  if (!finalType) {
    alertT('msg.lab.bloodTypeRequired'); // ar: يجب على المعمل اختيار وتأكيد فصيلة الدم.
    return;
  }

  if (decision === 'Rejected' && !reason && diseases.length === 0) {
    alertT('msg.lab.rejectReasonRequired'); // ar: يجب كتابة سبب الرفض أو تحديد الأمراض المكتشفة.
    return;
  }
  if (decision === 'Approved' && diseases.length > 0) {
    alertT('msg.lab.diseaseBlocksApprove'); // ar: لا يمكن اعتماد الكيس إذا تم تحديد أمراض مكتشفة. اختر رفضاً أو أزل الأمراض المحددة.
    return;
  }

  try {
    await Drop4LifeAPI.submitLab({
      bagId,
      decision,
      finalType,
      reason: reason || (decision === 'Rejected' ? tf('render.detectedDiseases', { diseases: diseases.join((typeof I18n !== 'undefined' && I18n.getLocale() === 'ar') ? '، ' : ', ') }) : t('render.cleanApproval')),
      diseases,
    });
    closeModal('modal-lab-test');
    await syncFromServer();
    if (decision === 'Approved') {
      triggerToast(t('toast.labApproved'), tf('toast.labApprovedBody', { type: finalType }));
    } else {
      triggerToast(t('toast.labRejected'), diseases.length ? tf('toast.labRejectedDiseases', { id: bagId, diseases: diseases.join(', ') }) : tf('toast.labRejectedDisposal', { id: bagId }));
    }
  } catch (err) {
    alert(trMsg(err.message));
  }
}

async function executeAddDonation() {
  const mode = document.querySelector('input[name="don-mode"]:checked').value;

  if (isAllStorageFull()) {
    alertT('msg.storage.full'); // ar: ⚠️ المخزون ممتلئ بالكامل — جميع الغرف والثلاجات ممتلئة.\n\nلا يمكن إدخال أي أكياس دم أو تسجيل متبرعين جدد حتى يتم تفريغ مساحة.
    return;
  }

  try {
    if (mode === 'bag') {
      const qty = parseInt(document.getElementById('don-qty').value) || 1;
      const selectedRoom = document.getElementById('don-bag-room-select').value;
      const selectedFridge = document.getElementById('don-bag-fridge-select').value;
      if (!selectedRoom || !selectedFridge) {
        alertT('msg.storage.roomFridgeRequired'); // ar: يرجى اختيار الغرفة والثلاجة.
        return;
      }
      const bagRoom = storageUnits.find(r => r.room === selectedRoom);
      const bagFridge = bagRoom?.fridges.find(f => f.id === selectedFridge);
      const bagValidation = validateStorageSelection(bagRoom, bagFridge, qty);
      if (bagValidation) {
        alert(bagValidation);
        return;
      }
      await Drop4LifeAPI.addDonation({
        mode: 'bag',
        productType: 'Whole',
        qty,
        room: selectedRoom,
        fridge: selectedFridge
      });
      triggerToast(t('toast.unitsAdded'), tf('toast.unitsAddedBody', { qty }));
    } else {
      const name = document.getElementById('donor-fullname').value.trim();
      const national = document.getElementById('donor-national').value.trim();
      const age = parseInt(document.getElementById('donor-age').value) || 0;
      const phone = document.getElementById('donor-phone').value.trim();
      const address = document.getElementById('donor-address').value.trim();
      const selectedRoom = document.getElementById('donor-room-select').value;
      const selectedFridge = document.getElementById('donor-fridge-select').value;
      if (!name || !national) { alertT('msg.donor.nameNationalRequired'); return; } // ar: يرجى إدخال الاسم والرقم القومي.
      const phoneError = phone ? validatePhone11(phone, t('msg.validation.phone')) : null;
      if (phoneError) { alert(phoneError); return; }
      const nationalError = validateNationalId14(national, t('msg.validation.nationalId'));
      if (nationalError) { alert(nationalError); return; }
      if (!selectedRoom || !selectedFridge) { alertT('msg.storage.locationRequired'); return; } // ar: يرجى اختيار موقع التخزين.
      const donorRoom = storageUnits.find(r => r.room === selectedRoom);
      const donorFridge = donorRoom?.fridges.find(f => f.id === selectedFridge);
      const donorValidation = validateStorageSelection(donorRoom, donorFridge, 1);
      if (donorValidation) {
        alert(donorValidation);
        return;
      }
      const result = await Drop4LifeAPI.addDonation({
        mode: 'donor',
        name,
        nationalId: national,
        age,
        phone,
        address,
        productType: 'Whole',
        room: selectedRoom,
        fridge: selectedFridge
      });
      triggerToast(t('toast.donationRegistered'), tf('toast.donationRegisteredBody', { id: result.bagId }));
    }
    closeModal('modal-add-donation');
    await syncFromServer();
  } catch (err) {
    alert(trMsg(err.message));
  }
}

function openDonationModal() {
  if (isAllStorageFull()) {
    alertT('msg.storage.full'); // ar: ⚠️ المخزون ممتلئ بالكامل — جميع الغرف والثلاجات ممتلئة.\n\nلا يمكن إدخال أي أكياس دم أو تسجيل متبرعين جدد حتى يتم تفريغ مساحة.
    return;
  }
  openModal('modal-add-donation');
}

function isAllStorageFull() {
  if (!storageUnits?.length) return false;
  return storageUnits.every(isRoomFull);
}

const WHOLE_BLOOD_STORAGE_UNITS = 3;

function bagStorageUnits(bag) {
  if (!bag || !['Pending', 'Approved', 'Reserved'].includes(bag.status)) return 0;
  const pt = String(bag.productType || bag.product_type || 'Whole');
  if (bag.status === 'Pending' || pt === 'Whole') return WHOLE_BLOOD_STORAGE_UNITS;
  return Math.max(parseInt(bag.qty, 10) || 1, 1);
}

function getStorageUnitsNeeded(qty = 1, productType = 'Whole') {
  const q = Math.max(parseInt(qty, 10) || 1, 1);
  return (productType === 'Whole' || !productType) ? q * WHOLE_BLOOD_STORAGE_UNITS : q;
}

function parseBagLocationParts(location) {
  let loc = normalizeStorageLocation(location);
  const parts = loc.split('/').map(part => part.trim()).filter(Boolean);
  if (parts.length >= 3) return { room: parts[0], fridge: parts[1], shelf: parts[2] };
  if (parts.length >= 2) return { room: parts[0], fridge: parts[1], shelf: null };
  return { room: parts[0] || null, fridge: null, shelf: null };
}

function getShelfUsedUnits(roomName, fridgeId, shelfName) {
  return bloodBags
    .filter(bag => ['Pending', 'Approved', 'Reserved'].includes(bag.status))
    .reduce((sum, bag) => {
      const parts = parseBagLocationParts(bag.location);
      if (parts.room === roomName && parts.fridge === fridgeId && parts.shelf === shelfName) {
        return sum + bagStorageUnits(bag);
      }
      return sum;
    }, 0);
}

function getFridgeConfig(roomName, fridgeId) {
  const defaultShelves = parseInt(storageConfig.totalShelvesPerFridge, 10) || 4;
  const defaultCap = parseInt(storageConfig.capacityPerShelf, 10) || 100;
  const detail = (storageConfig.details || []).find(d => d.room === roomName);
  if (!detail) {
    return { shelves: defaultShelves, capacityPerShelf: defaultCap, maxCapacity: defaultShelves * defaultCap };
  }
  const settings = detail.fridgeSettings?.[fridgeId] || {};
  const shelfList = detail.shelves?.[fridgeId] || [];
  const shelves = parseInt(settings.shelves, 10) || shelfList.length || defaultShelves;
  const capacityPerShelf = parseInt(settings.capacityPerShelf, 10) || defaultCap;
  return { shelves, capacityPerShelf, maxCapacity: shelves * capacityPerShelf };
}

function getFridgeMaxCapacity(room, fridge) {
  if (!room || !fridge) return 0;
  return getFridgeConfig(room.room, fridge.id).maxCapacity;
}

function countAvailableShelfSlots(roomName, fridgeId, unitsNeeded = 1) {
  const detail = (storageConfig.details || []).find(d => d.room === roomName);
  if (!detail) return 0;
  const allFridges = Array.isArray(detail.fridges) ? detail.fridges : [];
  const fridgeOrder = fridgeId && allFridges.includes(fridgeId)
    ? [fridgeId, ...allFridges.filter(name => name !== fridgeId)]
    : (fridgeId ? [fridgeId, ...allFridges] : allFridges);

  let total = 0;
  fridgeOrder.forEach((name) => {
    const cfg = getFridgeConfig(roomName, name);
    const shelfNames = detail.shelves?.[name] || Array.from({ length: cfg.shelves }, (_, i) => `Shelf ${i + 1}`);
    shelfNames.forEach((shelfName) => {
      const used = getShelfUsedUnits(roomName, name, shelfName);
      total += Math.max(cfg.capacityPerShelf - used, 0);
    });
  });
  return total;
}

function isFridgeFull(fridge, room) {
  if (!fridge) return true;
  const roomName = room?.room;
  return fridge.used >= getFridgeMaxCapacity(room, fridge);
}

function isRoomFull(room) {
  if (!room?.fridges?.length) return false;
  return room.fridges.every(fridge => isFridgeFull(fridge, room));
}

function selectFirstEnabledOption(selectEl) {
  if (!selectEl) return;
  let firstSelectable = -1;
  for (let i = 0; i < selectEl.options.length; i++) {
    if (!selectEl.options[i].disabled) { firstSelectable = i; break; }
  }
  selectEl.selectedIndex = firstSelectable >= 0 ? firstSelectable : 0;
}

function getAvailableFridgesInRoom(room, excludeFridgeId) {
  if (!room?.fridges) return [];
  return room.fridges.filter(f => !isFridgeFull(f, room) && f.id !== excludeFridgeId);
}

function formatAvailableFridgesSuggestion(room, excludeFridgeId) {
  const available = getAvailableFridgesInRoom(room, excludeFridgeId);
  if (!available.length) return '';
  return `\n\n${tf('storage.availableFridges', { list: available.map(f => f.id).join((typeof I18n !== 'undefined' && I18n.getLocale() === 'ar') ? '، ' : ', ') })}`;
}

function isRoomCapacityFull(room, unitsNeeded = 1) {
  if (!room) return false;
  const capacity = Number(room.capacity) || 0;
  if (capacity <= 0) return false;
  return room.used + unitsNeeded > capacity;
}

function fridgeHasCapacity(fridge, room, unitsNeeded = 1) {
  if (!fridge || !room) return false;
  return fridge.used + unitsNeeded <= getFridgeMaxCapacity(room, fridge);
}

function validateStorageSelection(room, fridge, qty = 1, productType = 'Whole') {
  const unitsNeeded = getStorageUnitsNeeded(qty, productType);
  if (isAllStorageFull()) {
    return t('storage.validationFull');
  }
  if (!room) return t('storage.selectLocation');
  if (isRoomFull(room)) {
    return t('storage.roomFull');
  }
  if (isRoomCapacityFull(room, unitsNeeded)) {
    const remaining = Math.max((Number(room.capacity) || 0) - (Number(room.used) || 0), 0);
    return tf('storage.roomCapacity', { room: room.room, qty, needed: unitsNeeded, remaining });
  }
  if (!fridge) return t('storage.selectFridge');
  if (isFridgeFull(fridge, room)) {
    return tf('storage.fridgeFull', { fridge: fridge.id, suggestion: formatAvailableFridgesSuggestion(room, fridge.id) });
  }
  const availableSlots = countAvailableShelfSlots(room.room, fridge.id, unitsNeeded);
  if (availableSlots < unitsNeeded) {
    return tf('storage.notEnoughSlots', { qty, needed: unitsNeeded, available: availableSlots, suggestion: formatAvailableFridgesSuggestion(room, fridge.id) });
  }
  if (!fridgeHasCapacity(fridge, room, unitsNeeded)) {
    const available = Math.max(getFridgeMaxCapacity(room, fridge) - fridge.used, 0);
    return tf('storage.fridgeCapacity', { fridge: fridge.id, needed: unitsNeeded, available, suggestion: formatAvailableFridgesSuggestion(room, fridge.id) });
  }
  return '';
}

function getDonorStorageOptions() {
  return storageUnits.map(room => ({ room: room.room, capacity: room.capacity, fridges: room.fridges }));
}

function renderStorageHint(hintEl, room, fridge, qty = 1, productType = 'Whole') {
  if (!hintEl) return;
  const unitsNeeded = getStorageUnitsNeeded(qty, productType);
  const validation = validateStorageSelection(room, fridge, qty, productType);
  if (validation) {
    hintEl.innerHTML = `<span style="color:var(--red);">${validation.replace(/\n\n/g, '<br>')}</span>`;
    return;
  }
  const availableSlots = countAvailableShelfSlots(room.room, fridge.id, unitsNeeded);
  const fillHint = (key, vars) => {
    let text = t(key, '');
    Object.entries(vars).forEach(([name, value]) => {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), value);
    });
    return text;
  };
  if (qty > 1) {
    hintEl.innerHTML = fillHint('storage.hint.multiUnit', {
      wholeUnits: WHOLE_BLOOD_STORAGE_UNITS,
      qty,
      unitsNeeded,
      available: availableSlots,
    });
    return;
  }
  hintEl.innerHTML = fillHint('storage.hint.singleUnit', {
    wholeUnits: WHOLE_BLOOD_STORAGE_UNITS,
    available: availableSlots,
    room: room.room,
    fridge: fridge.id,
  });
}

function populateDonorStorageSelectors() {
  const roomSelect = document.getElementById('donor-room-select');
  const fridgeSelect = document.getElementById('donor-fridge-select');
  if(!roomSelect || !fridgeSelect) return;

  roomSelect.innerHTML = storageUnits.map(room => {
    const full = isRoomFull(room);
    return `<option value="${room.room}" ${full ? 'disabled' : ''}>${room.room}${full ? ' ' + t('common.fullParen') : ''}</option>`;
  }).join('');
  selectFirstEnabledOption(roomSelect);
  updateDonorFridgeOptions();
}

function populateBagStorageSelectors() {
  const roomSelect = document.getElementById('don-bag-room-select');
  const fridgeSelect = document.getElementById('don-bag-fridge-select');
  if(!roomSelect || !fridgeSelect) return;

  roomSelect.innerHTML = storageUnits.map(room => {
    const full = isRoomFull(room);
    return `<option value="${room.room}" ${full ? 'disabled' : ''}>${room.room}${full ? ' ' + t('common.fullParen') : ''}</option>`;
  }).join('');
  selectFirstEnabledOption(roomSelect);
  updateBagFridgeOptions();
}

function updateBagFridgeOptions() {
  const roomSelect = document.getElementById('don-bag-room-select');
  const fridgeSelect = document.getElementById('don-bag-fridge-select');
  if(!roomSelect || !fridgeSelect) return;

  const room = storageUnits.find(r => r.room === roomSelect.value);
  if(!room) {
    fridgeSelect.innerHTML = '';
    updateBagStorageHint();
    return;
  }

  if (isRoomFull(room)) {
    fridgeSelect.innerHTML = `<option value="">${t('common.noFridges')}</option>`;
    updateBagStorageHint();
    return;
  }

  fridgeSelect.innerHTML = room.fridges.map(f => {
    const full = isFridgeFull(f, room);
    return `<option value="${f.id}" ${full ? 'disabled' : ''}>${f.id}${full ? ' ' + t('common.fullParen') : ''}</option>`;
  }).join('');

  selectFirstEnabledOption(fridgeSelect);
  updateBagStorageHint();
}

function updateBagStorageHint() {
  const hint = document.getElementById('don-bag-storage-hint');
  const roomSelect = document.getElementById('don-bag-room-select');
  const fridgeSelect = document.getElementById('don-bag-fridge-select');
  const qtyInput = document.getElementById('don-qty');
  if(!hint || !roomSelect || !fridgeSelect) return;

  const room = storageUnits.find(r => r.room === roomSelect.value);
  const fridge = room?.fridges.find(f => f.id === fridgeSelect.value);
  const qty = parseInt(qtyInput?.value, 10) || 1;
  renderStorageHint(hint, room, fridge, qty);
}

function updateDonorFridgeOptions() {
  const roomSelect = document.getElementById('donor-room-select');
  const fridgeSelect = document.getElementById('donor-fridge-select');
  if(!roomSelect || !fridgeSelect) return;

  const room = storageUnits.find(r => r.room === roomSelect.value);
  if(!room) {
    fridgeSelect.innerHTML = '';
    updateDonorStorageHint();
    return;
  }

  if (isRoomFull(room)) {
    fridgeSelect.innerHTML = `<option value="">${t('common.noFridges')}</option>`;
    updateDonorStorageHint();
    return;
  }

  fridgeSelect.innerHTML = room.fridges.map(f => {
    const full = isFridgeFull(f, room);
    return `<option value="${f.id}" ${full ? 'disabled' : ''}>${f.id}${full ? ' ' + t('common.fullParen') : ''}</option>`;
  }).join('');

  selectFirstEnabledOption(fridgeSelect);
  updateDonorStorageHint();
}

function updateDonorStorageHint() {
  const hint = document.getElementById('donor-storage-hint');
  const roomSelect = document.getElementById('donor-room-select');
  const fridgeSelect = document.getElementById('donor-fridge-select');
  if(!hint || !roomSelect || !fridgeSelect) return;

  const room = storageUnits.find(r => r.room === roomSelect.value);
  const fridge = room?.fridges.find(f => f.id === fridgeSelect.value);
  renderStorageHint(hint, room, fridge, 1);
}

async function executeAddRequest() {
  const hosp = document.getElementById('req-hospital-input').value.trim();
  const bType = document.getElementById('req-blood-select').value;
  const productType = document.getElementById('req-product-type').value || 'RBC';
  const qty = parseInt(document.getElementById('req-qty').value) || 1;
  const priority = document.getElementById('req-priority').value;

  if(!hosp || !isValidHospitalSelection(hosp)) {
    alertT('msg.request.hospitalRequired'); // ar: يرجى اختيار مستشفى صالح من القائمة قبل إرسال الطلب.
    return;
  }

  const reqId = 'REQ-' + Math.floor(100 + Math.random() * 900);
  try {
    await Drop4LifeAPI.createRequest({
      id: reqId,
      hospital: hosp,
      blood: bType,
      productType,
      qty,
      priority,
      status: 'قيد المراجعة'
    });
    const actorName = currentUser ? (currentUser.name || currentUser.username) : t('common.user');
    await postRequestNotification(
      t('render.newBloodRequest'),
      tf('render.requestBroadcast', { id: reqId, hospital: hosp, qty, product: productLabel(productType), blood: bType, priority, actor: actorName })
    );
    closeModal('modal-add-request');
    await syncFromServer();
    triggerToast(t('toast.requestRegistered'), tf('toast.requestRegisteredBody', { id: reqId }));
  } catch (err) {
    alert(trMsg(err.message));
  }
}

function openEditBagModal(bagId) {
  if(!isSuperUser()) {
    alertT('msg.bag.editDenied'); // ar: فقط المسؤول الأعلى (Super Admin) يمكنه تعديل بيانات الكيس.
    return;
  }

  const bag = bloodBags.find(item => item.id === bagId);
  if(!bag) return;

  document.getElementById('edit-bag-id').value = bag.id;
  document.getElementById('edit-bag-donor').value = bag.donor;
  document.getElementById('edit-bag-blood').value = bag.bloodType;
  document.getElementById('edit-bag-date').value = bag.date;
  document.getElementById('edit-bag-expiry').value = bag.expiry;
  document.getElementById('edit-bag-location').value = bag.location;
  document.getElementById('edit-bag-status').value = bag.status;

  openModal('modal-edit-bag');
}

async function executeSaveBagEdit() {
  const bagId = document.getElementById('edit-bag-id').value;
  if(!bloodBags.find(item => item.id === bagId)) return;
  const body = {
    id: bagId,
    donor: document.getElementById('edit-bag-donor').value.trim(),
    bloodType: document.getElementById('edit-bag-blood').value,
    date: document.getElementById('edit-bag-date').value,
    expiry: document.getElementById('edit-bag-expiry').value,
    location: document.getElementById('edit-bag-location').value.trim(),
    status: document.getElementById('edit-bag-status').value,
    qty: 1
  };
  try {
    await Drop4LifeAPI.updateBloodBag(bagId, body);
    const actor = getAuditActor();
    await Drop4LifeAPI.pushAudit(actor.user, actor.role, t('auditAction.editBag'), `${t('table.bagId')} ${bagId}.`);
    closeModal('modal-edit-bag');
    await syncFromServer();
    triggerToast(t('toast.bagUpdated'), tf('toast.bagUpdatedBody', { id: bagId }));
  } catch (err) {
    alert(trMsg(err.message));
  }
}

async function confirmDeleteBloodBag(bagId) {
  if (!isSuperUser()) return;
  if (!confirmT('msg.confirm.deleteBag', { id: bagId })) return;
  try {
    await Drop4LifeAPI.deleteBloodBag(bagId);
    closeModal('modal-edit-bag');
    await syncFromServer();
    triggerToast(t('toast.bagDeleted'), tf('toast.bagDeletedBody', { id: bagId }));
  } catch (err) {
    alert(trMsg(err.message));
  }
}

function openEditDonorModal(donorId) {
  if (!isSuperUser()) return;
  const donor = donors.find((item) => item.id === donorId);
  if (!donor) return;
  document.getElementById('edit-donor-id').value = donor.id;
  document.getElementById('edit-donor-name').value = donor.name;
  document.getElementById('edit-donor-blood').value = donor.blood;
  document.getElementById('edit-donor-age').value = donor.age;
  document.getElementById('edit-donor-phone').value = donor.phone || '';
  document.getElementById('edit-donor-national-id').value = donor.nationalId || '';
  document.getElementById('edit-donor-address').value = donor.address || '';
  openModal('modal-edit-donor');
}

async function executeSaveDonor() {
  if (!isSuperUser()) return;
  const id = document.getElementById('edit-donor-id').value;
  const body = {
    id,
    name: document.getElementById('edit-donor-name').value.trim(),
    blood: document.getElementById('edit-donor-blood').value,
    age: Number(document.getElementById('edit-donor-age').value) || 0,
    phone: document.getElementById('edit-donor-phone').value.trim(),
    nationalId: document.getElementById('edit-donor-national-id').value.trim(),
    address: document.getElementById('edit-donor-address').value.trim(),
  };
  if (body.phone) {
    const phoneError = validatePhone11(body.phone, t('msg.validation.phone'));
    if (phoneError) { alert(phoneError); return; }
  }
  if (body.nationalId) {
    const nationalError = validateNationalId14(body.nationalId, t('msg.validation.nationalId'));
    if (nationalError) { alert(nationalError); return; }
  }
  try {
    await Drop4LifeAPI.updateDonor(id, body);
    closeModal('modal-edit-donor');
    await syncFromServer();
    triggerToast(t('toast.donorSaved'), body.name);
  } catch (err) {
    alert(trMsg(err.message));
  }
}

async function confirmDeleteDonor(donorId) {
  if (!isSuperUser()) return;
  if (!confirmT('msg.confirm.deleteDonor', { id: donorId })) return;
  try {
    await Drop4LifeAPI.deleteDonor(donorId);
    await syncFromServer();
    triggerToast(t('toast.donorDeleted'), donorId);
  } catch (err) {
    alert(trMsg(err.message));
  }
}

function openEditHospitalModal(hospitalName) {
  if (!canManageHospitals()) return;
  const hospital = hospitals.find((item) => item.name === hospitalName);
  if (!hospital) return;
  document.getElementById('edit-hospital-original-name').value = hospital.name;
  document.getElementById('edit-hospital-name').value = hospital.name;
  document.getElementById('edit-hospital-address').value = hospital.address;
  document.getElementById('edit-hospital-manager').value = hospital.manager || '';
  document.getElementById('edit-hospital-phone').value = hospital.phone || '';
  openModal('modal-edit-hospital');
}

async function executeSaveHospital() {
  if (!canManageHospitals()) return;
  const originalName = document.getElementById('edit-hospital-original-name').value;
  const body = {
    name: document.getElementById('edit-hospital-name').value.trim(),
    address: document.getElementById('edit-hospital-address').value.trim(),
    manager: document.getElementById('edit-hospital-manager').value.trim(),
    phone: document.getElementById('edit-hospital-phone').value.trim(),
    status: 'Connected',
  };
  try {
    await Drop4LifeAPI.updateHospital(originalName, body);
    closeModal('modal-edit-hospital');
    await syncFromServer();
    triggerToast(t('toast.hospitalSaved'), body.name);
  } catch (err) {
    alert(trMsg(err.message));
  }
}

async function confirmDeleteHospital(hospitalName) {
  if (!canManageHospitals()) return;
  if (!confirmT('msg.confirm.deleteHospital', { name: hospitalName })) return;
  try {
    await Drop4LifeAPI.deleteHospital(hospitalName);
    await syncFromServer();
    triggerToast(t('toast.hospitalDeleted'), hospitalName);
  } catch (err) {
    alert(trMsg(err.message));
  }
}

function openEditRequestModal(requestId) {
  if (!isSuperUser()) return;
  const requestItem = requests.find((item) => item.id === requestId);
  if (!requestItem) return;
  document.getElementById('edit-request-id').value = requestItem.id;
  document.getElementById('edit-request-hospital').value = requestItem.hospital;
  document.getElementById('edit-request-blood').value = requestItem.blood;
  document.getElementById('edit-request-qty').value = requestItem.qty;
  document.getElementById('edit-request-priority').value = requestItem.priority;
  document.getElementById('edit-request-status').value = normalizeRequestStatus(requestItem.status);
  openModal('modal-edit-request');
}

async function executeSaveRequest() {
  if (!isSuperUser()) return;
  const id = document.getElementById('edit-request-id').value;
  const body = {
    id,
    hospital: document.getElementById('edit-request-hospital').value.trim(),
    blood: document.getElementById('edit-request-blood').value,
    qty: Number(document.getElementById('edit-request-qty').value) || 1,
    priority: document.getElementById('edit-request-priority').value,
    status: document.getElementById('edit-request-status').value,
  };
  try {
    await Drop4LifeAPI.updateRequest(id, body);
    closeModal('modal-edit-request');
    await syncFromServer();
    triggerToast(t('toast.requestSaved'), id);
  } catch (err) {
    alert(trMsg(err.message));
  }
}

async function confirmDeleteRequest(requestId) {
  if (!isSuperUser()) return;
  if (!confirmT('msg.confirm.deleteRequest', { id: requestId })) return;
  try {
    await Drop4LifeAPI.deleteRequest(requestId);
    await syncFromServer();
    triggerToast(t('toast.requestDeleted'), requestId);
  } catch (err) {
    alert(trMsg(err.message));
  }
}

function openEditDisposalModal(dbId) {
  if (!isSuperUser()) return;
  const log = disposalLogs.find((item) => String(item.dbId) === String(dbId));
  if (!log) return;
  document.getElementById('edit-disposal-db-id').value = log.dbId;
  document.getElementById('edit-disposal-bag-code').value = log.id;
  document.getElementById('edit-disposal-type').value = log.type;
  document.getElementById('edit-disposal-blood').value = log.blood;
  document.getElementById('edit-disposal-date').value = log.date;
  document.getElementById('edit-disposal-worker').value = log.worker;
  document.getElementById('edit-disposal-reason').value = log.reason;
  openModal('modal-edit-disposal');
}

async function executeSaveDisposal() {
  if (!isSuperUser()) return;
  const dbId = document.getElementById('edit-disposal-db-id').value;
  const body = {
    id: document.getElementById('edit-disposal-bag-code').value.trim(),
    type: document.getElementById('edit-disposal-type').value.trim(),
    blood: document.getElementById('edit-disposal-blood').value,
    date: document.getElementById('edit-disposal-date').value,
    worker: document.getElementById('edit-disposal-worker').value.trim(),
    reason: document.getElementById('edit-disposal-reason').value.trim(),
  };
  try {
    await Drop4LifeAPI.updateDisposalLog(dbId, body);
    closeModal('modal-edit-disposal');
    await syncFromServer();
    triggerToast(t('toast.disposalRecordSaved'), body.id);
  } catch (err) {
    alert(trMsg(err.message));
  }
}

async function confirmDeleteDisposalLog(dbId) {
  if (!isSuperUser()) return;
  if (!confirmT('msg.confirm.deleteDisposal')) return;
  try {
    await Drop4LifeAPI.deleteDisposalLog(dbId);
    await syncFromServer();
    triggerToast(t('toast.disposalRecordDeleted'), t('toast.disposalRecordDeletedBody'));
  } catch (err) {
    alert(trMsg(err.message));
  }
}

async function confirmDeleteHospitalDelivery(recordId) {
  if (!isSuperUser()) return;
  if (!confirmT('msg.confirm.deleteDelivery', { id: recordId })) return;
  try {
    await Drop4LifeAPI.deleteHospitalDelivery(recordId);
    await syncFromServer();
    triggerToast(t('toast.deliveryDeleted'), recordId);
  } catch (err) {
    alert(trMsg(err.message));
  }
}

function openEditHospitalDeliveryModal(recordId) {
  if (!isSuperUser()) return;
  alertT('msg.delivery.editUnavailable'); // ar: تعديل سجل التسليم متاح عبر الحذف وإعادة الإدخال حالياً.
}

async function confirmClearAllData() {
  if (!isSuperUser()) {
    alertT('msg.admin.clearAllDenied'); // ar: فقط المسؤول الأعلى (Super Admin) يمكنه مسح جميع البيانات.
    return;
  }
  if (!confirmT('msg.confirm.clearAllData')) return;
  try {
    await Drop4LifeAPI.resetOperationalData();
    triggerToast(t('toast.allDataCleared'), t('toast.allDataClearedBody'));
    Drop4LifeAPI.clearAuthSession();
  } catch (err) {
    alert(trMsg(err.message));
  }
}

async function confirmDeleteAccount(username) {
  if (!isSuperUser()) return;
  if (username === 'superadmin') {
    alertT('msg.account.superAdminDeleteBlocked'); // ar: ❌ لا يمكن حذف حساب Super Admin الرئيسي!
    return;
  }
  const account = accounts.find((item) => item.username === username);
  if (!account || !confirmT('msg.confirm.deleteAccount', { name: account.name })) return;
  try {
    await Drop4LifeAPI.deleteAccount(username);
    const actor = getAuditActor();
    await Drop4LifeAPI.pushAudit(actor.user, actor.role, t('auditAction.deleteAccount'), username);
    closeModal('modal-edit-account');
    await syncFromServer();
    triggerToast(t('toast.accountDeleted'), account.name);
  } catch (err) {
    alert(trMsg(err.message));
  }
}

function executeApproveRequest(reqId) {
  openRequestDeliveryModal(reqId);
}

async function approveRequest(reqId) {
  if(!isSuperUser()) {
    alertT('msg.request.approveDenied'); // ar: فقط السوبر أدمن يمكنه الموافقة على الطلبات.
    return;
  }
  try {
    await Drop4LifeAPI.updateRequestStatus(reqId, 'تم القبول');
    const actorName = currentUser ? (currentUser.name || currentUser.username) : t('common.user');
    await postRequestNotification(
      t('render.requestApprovedNotif'),
      tf('render.requestApprovedBody', { id: reqId, actor: actorName })
    );
    await syncFromServer();
    triggerToast(t('toast.requestApproved'), t('toast.requestReady').replace('{id}', reqId));
  } catch (err) {
    alert(trMsg(err.message));
  }
}

async function rejectRequest(reqId) {
  if(!isSuperUser()) {
    alertT('msg.request.rejectDenied'); // ar: فقط السوبر أدمن يمكنه رفض الطلبات.
    return;
  }
  try {
    await Drop4LifeAPI.updateRequestStatus(reqId, 'تم الرفض');
    const actorName = currentUser ? (currentUser.name || currentUser.username) : t('common.user');
    await postRequestNotification(
      t('render.requestRejectedNotif'),
      tf('render.requestRejectedBody', { id: reqId, actor: actorName })
    );
    await syncFromServer();
    triggerToast(t('toast.requestRejected'), t('toast.requestRejectedBody').replace('{id}', reqId));
  } catch (err) {
    alert(trMsg(err.message));
  }
}

function openRequestDeliveryModal(reqId) {
  const role = getAccountRole();
  if(!currentUser || !['superadmin', 'admin'].includes(role)) {
    triggerToast(t('toast.deliveryAccessDeniedTitle'), t('toast.deliveryAccessDeniedBody'));
    return;
  }

  const req = requests.find(r => r.id === reqId);
  if(!req) return;
  const normalizedStatus = normalizeRequestStatus(req.status);
  if(normalizedStatus === 'تم التسليم') {
    alertT('msg.request.alreadyDelivered'); // ar: هذا الطلب تم معالجته وتسليمه مسبقاً.
    return;
  }
  if (role === 'admin' && normalizedStatus !== 'تم القبول') {
    alertT('msg.request.deliverAfterApproveOnly'); // ar: زر التسليم يظهر فقط بعد قبول الطلب.
    return;
  }
  if (role === 'superadmin' && normalizedStatus !== 'تم القبول') {
    alertT('msg.request.deliverApprovedOnly'); // ar: التسليم متاح بعد قبول الطلب فقط.
    return;
  }

  document.getElementById('delivery-request-id').value = req.id;
  document.getElementById('delivery-request-code').value = req.id;
  document.getElementById('delivery-request-hospital').value = req.hospital;
  document.getElementById('delivery-recipient-name').value = '';
  document.getElementById('delivery-recipient-phone').value = '';
  document.getElementById('delivery-notes').value = '';

  openModal('modal-deliver-request');
}

async function executeRequestDelivery() {
  const reqId = document.getElementById('delivery-request-id').value;
  const recipientName = document.getElementById('delivery-recipient-name').value.trim();
  const recipientPhone = document.getElementById('delivery-recipient-phone').value.trim();
  const notes = document.getElementById('delivery-notes').value.trim();

  if(!recipientName || !recipientPhone) {
    alertT('msg.delivery.recipientRequired'); // ar: يرجى إدخال اسم المستلم ورقم الهاتف.
    return;
  }
  const phoneError = validatePhone11(recipientPhone, t('table.recipientPhone'));
  if (phoneError) { alert(phoneError); return; }

  const req = requests.find(r => r.id === reqId);
  if(!req) return;
  if (normalizeRequestStatus(req.status) !== 'تم القبول') {
    alertT('msg.request.deliverMustBeApproved'); // ar: لا يمكن تسليم الطلب إلا بعد قبوله.
    return;
  }
  const stock = bloodInventory[req.blood];
  if (stock && stock.available < req.qty) {
    let alternatives = [];
    Object.keys(compatibilityMatrix).forEach(donorType => {
      if (compatibilityMatrix[req.blood].includes(donorType) && bloodInventory[donorType]?.available >= req.qty) {
        alternatives.push(donorType);
      }
    });
    const altMsg = alternatives.length ? tf('render.alternatives', { list: alternatives.join(', ') }) : t('render.noAlternatives');
    alert(tf('msg.inventory.insufficient', { required: req.qty, available: stock.available, alt: altMsg }));
    return;
  }

  try {
    const actorName = currentUser ? (currentUser.name || currentUser.username) : t('common.user');
    await Drop4LifeAPI.deliverRequest({
      requestId: reqId,
      recipient: recipientName,
      recipientPhone,
      deliveryNotes: notes,
      deliveredBy: actorName
    });
    closeModal('modal-deliver-request');
    await postRequestNotification(
      t('render.requestDeliveredNotif'),
      tf('render.requestDeliveredBody', { id: reqId, recipient: recipientName, actor: actorName })
    );
    await syncFromServer();
    triggerToast(t('toast.deliveryRecorded'), t('toast.deliveryRecordedBody').replace('{id}', reqId).replace('{name}', recipientName));
  } catch (err) {
    alert(trMsg(err.message));
  }
}

async function triggerBackup() {
  try {
    const actor = getAuditActor();
    await Drop4LifeAPI.pushAudit(
      actor.user,
      actor.role,
      t('render.backupTitle'),
      t('render.backupBody')
    );
    triggerToast(t('toast.backupTitle'), t('toast.backupBody'));
  } catch (err) {
    alert(trMsg(err.message));
  }
}

async function pushAudit(user, role, action, details) {
  if (!Drop4LifeAPI.isLoggedIn()) return;
  try {
    const actor = getAuditActor();
    await Drop4LifeAPI.pushAudit(actor.user, actor.role, action, details);
    if (isSuperUser()) {
      const timeStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
      auditLogs.unshift({ time: timeStr, user: actor.user, role: actor.role, action, details });
      window.auditLogs = auditLogs;
    }
    if (document.getElementById('table-audit-full')) renderAuditTable();
  } catch (err) {
    console.error('audit', err);
    if (err && err.status === 403 && typeof triggerToast === 'function') {
      triggerToast(t('toast.forbiddenTitle'), err.message);
    }
  }
}

function triggerToast(title, body) {
  const box = document.getElementById('toast-box');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>🔔</span><div><strong>${title}</strong><br><small style="color:var(--text-gray); font-size:11.5px">${body}</small></div>`;
  box.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 4000);
}

function updateLiveClock() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
  const clockEl = document.getElementById('live-clock');
  if (clockEl) clockEl.innerText = now.toLocaleString(typeof getDateLocale === 'function' ? getDateLocale() : 'en-US', options);
}
setInterval(updateLiveClock, 1000);
updateLiveClock();

// ==================== SUPER ADMIN: ACCOUNTS & STORAGE MANAGEMENT ====================

function renderAdminSettingsPage() {
  const role = getAccountRole();
  if(!currentUser || role !== 'superadmin') return;

  const accountsSection = document.getElementById('admin-accounts-section');
  if (accountsSection) {
    accountsSection.style.display = isSuperUser() ? 'block' : 'none';
  }
  const securitySection = document.getElementById('admin-security-section');
  if (securitySection) {
    securitySection.style.display = isSuperUser() ? 'block' : 'none';
  }

  if (isSuperUser()) renderAccountsTable();
  renderStorageConfigDisplay();
}

function openSensitiveActionModal(action) {
  if (!isSuperUser()) {
    alertT('msg.admin.superOnly'); // ar: فقط السوبر أدمن يمكنه تنفيذ هذه العملية.
    return;
  }

  const modal = document.getElementById('modal-superadmin-secret');
  const title = document.getElementById('superadmin-secret-title');
  const message = document.getElementById('superadmin-secret-message');
  const passwordInput = document.getElementById('superadmin-secret-password');
  if (!modal || !title || !message || !passwordInput) return;

  modal.dataset.action = action;
  const modalKeys = {
    'clear-notifications': { title: 'modal.clearNotifications.title', message: 'modal.clearNotifications.message' },
    'clear-logs': { title: 'modal.clearLogs.title', message: 'modal.clearLogs.message' },
    'clear-messages': { title: 'modal.clearMessages.title', message: 'modal.clearMessages.message' },
  };
  const keys = modalKeys[action] || { title: 'modal.sensitiveAction.title', message: 'modal.sensitiveAction.hint' };
  title.innerText = t(keys.title);
  message.innerText = t(keys.message);
  passwordInput.value = '';
  openModal('modal-superadmin-secret');
  setTimeout(() => passwordInput.focus(), 0);
}

async function executeSensitiveAdminAction() {
  if (!isSuperUser()) return;

  const modal = document.getElementById('modal-superadmin-secret');
  const action = modal?.dataset?.action || '';
  const passwordInput = document.getElementById('superadmin-secret-password');
  const password = passwordInput?.value || '';

  if (!action) {
    alertT('msg.admin.actionUnknown'); // ar: تعذر تحديد العملية المطلوبة.
    return;
  }

  if (!password.trim()) {
    alertT('msg.admin.passwordRequired'); // ar: يرجى إدخال كلمة المرور.
    return;
  }

  const endpoint = action === 'clear-notifications'
    ? '/operations/clear-notifications/'
    : action === 'clear-messages'
      ? '/operations/clear-messages/'
      : '/operations/clear-audit-logs/';

  try {
    const result = await Drop4LifeAPI.request(endpoint, {
      method: 'POST',
      body: { password },
    });
    closeModal('modal-superadmin-secret');
    if (passwordInput) passwordInput.value = '';
    await syncFromServer();
    if (action === 'clear-notifications') {
        triggerToast(t('toast.notificationsCleared'), tf('toast.notificationsClearedBody', { count: result.deleted || 0 }));
    } else if (action === 'clear-messages') {
        triggerToast(t('toast.messagesCleared'), tf('toast.messagesClearedBody', { count: result.deleted || 0 }));
        renderMessagesPage();
    } else {
        triggerToast(t('toast.logsCleared'), tf('toast.logsClearedBody', { count: result.deleted || 0 }));
    }
  } catch (err) {
    alert(trMsg(err.message));
  }
}

function renderAccountsTable() {
  const tbody = document.getElementById('table-accounts-full');
  if(!tbody) return;

  const query = normalizeSearch(document.getElementById('accounts-search')?.value || '');
  const searchInput = document.getElementById('accounts-search');
  if(searchInput && !searchInput.dataset.bound) {
    searchInput.addEventListener('input', renderAccountsTable);
    searchInput.dataset.bound = '1';
  }

  const filtered = accounts.filter(acc => [acc.username, acc.name, acc.role, acc.email]
    .some(field => matchesSearchString(field, query)));

  tbody.innerHTML = filtered.map(acc => {
    const isProtectedSuperAdmin = acc.role === 'superadmin' || acc.role_code === 'DR';
    const statusBadge = isProtectedSuperAdmin ? '' : (typeof I18n !== 'undefined' && I18n.ui && I18n.ui.accountStatusBadge
      ? I18n.ui.accountStatusBadge(acc.status)
      : (acc.status === 'active' ? `<span class="badge badge-success">${t('badge.accountActive')}</span>` : `<span class="badge badge-danger">${t('badge.accountInactive')}</span>`));
    const roleDisplay = getRoleLabel(acc.role);
    const editBtn = isSuperUser() && !isProtectedSuperAdmin
      ? `<button class="btn btn-primary btn-sm" onclick="openEditAccountModal('${acc.username}')">✏️ ${t('btn.edit')}</button>
         <button class="btn btn-danger btn-sm" onclick="confirmDeleteAccount('${acc.username}')">🗑️ ${t('btn.delete')}</button>`
      : '';
    return `
      <tr>
        <td>${acc.username}</td>
        <td>${acc.name}</td>
        <td>${roleDisplay}</td>
        <td>${acc.email}</td>
        <td>${statusBadge}</td>
        <td>${editBtn}</td>
      </tr>
    `;
  }).join('');
}

function markStorageConfigPanelDirty() {
  window.storageConfigPanelDirty = true;
  updateStorageConfigDirtyBanner(true);
}

function clearStorageConfigPanelDirty() {
  window.storageConfigPanelDirty = false;
  updateStorageConfigDirtyBanner(false);
}

function updateStorageConfigDirtyBanner(show) {
  const container = document.getElementById('storage-config-display');
  if (!container) return;
  let banner = container.querySelector('[data-storage-dirty-banner]');
  if (show) {
    if (!banner) {
      banner = document.createElement('div');
      banner.dataset.storageDirtyBanner = '1';
      banner.style.cssText = 'grid-column:1 / -1; padding:0.65rem 0.9rem; border-radius:10px; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.35); color:#92400e; font-size:13px; font-weight:600;';
      banner.textContent = t('storage.dirtyBanner');
      container.prepend(banner);
    }
    banner.style.display = 'block';
  } else if (banner) {
    banner.remove();
  }
}

function formatStorageAverage(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return String(Math.round(num));
}

function getStorageConfigSummaryStats() {
  const details = Array.isArray(storageConfig.details) ? storageConfig.details : [];
  const totalRooms = details.length;

  if (totalRooms === 0) {
    return { totalRooms: 0, avgFridgesPerRoom: 0, avgShelvesPerFridge: 0, avgCapacityPerShelf: 0 };
  }

  let totalFridges = 0;
  let totalShelves = 0;
  let totalCapacity = 0;

  details.forEach((detail) => {
    const fridges = Array.isArray(detail.fridges) && detail.fridges.length ? detail.fridges : ['Fridge 1'];
    totalFridges += fridges.length;
    fridges.forEach((fridge) => {
      const settings = detail.fridgeSettings?.[fridge] || {};
      const shelfList = detail.shelves?.[fridge];
      const shelfCount = parseInt(settings.shelves, 10)
        || (Array.isArray(shelfList) ? shelfList.length : 0)
        || (parseInt(storageConfig.totalShelvesPerFridge, 10) || 1);
      const capPerShelf = parseInt(settings.capacityPerShelf, 10) || (parseInt(storageConfig.capacityPerShelf, 10) || 100);
      totalShelves += shelfCount;
      totalCapacity += shelfCount * capPerShelf;
    });
  });

  return {
    totalRooms,
    avgFridgesPerRoom: totalFridges / totalRooms,
    avgShelvesPerFridge: totalFridges > 0 ? totalShelves / totalFridges : 0,
    avgCapacityPerShelf: totalShelves > 0 ? totalCapacity / totalShelves : (parseInt(storageConfig.capacityPerShelf, 10) || 0),
  };
}

function updateStorageConfigSummaryDisplay() {
  const summary = document.querySelector('[data-storage-config-summary]');
  if (!summary) return;
  const stats = getStorageConfigSummaryStats();
  summary.innerHTML = `
    <div style="font-weight:700; margin-bottom:0.8rem;">${t('storage.roomCount')} <span style="color:var(--red); font-size:16px;">${stats.totalRooms}</span></div>
    <div style="display:grid; gap:0.6rem; font-size:13px;">
      <div>${t('storage.fridgesPerRoom')} <strong>${formatStorageAverage(stats.avgFridgesPerRoom)}</strong></div>
      <div>${t('storage.shelvesPerFridgeShort')} <strong>${formatStorageAverage(stats.avgShelvesPerFridge)}</strong></div>
      <div>${t('storage.capacityPerShelf')} <strong>${formatStorageAverage(stats.avgCapacityPerShelf)}</strong> ${t('dashboard.stat.unit.bag')}</div>
    </div>
  `;
}

function bindStorageConfigPanelListeners() {
  const container = document.getElementById('storage-config-display');
  if (!container || container.dataset.storageBound === '1') return;
  container.dataset.storageBound = '1';
  container.addEventListener('input', (event) => {
    if (event.target.closest('.storage-room-field')) markStorageConfigPanelDirty();
  });
}

function renderStorageConfigDisplay(forceReset = false) {
  const container = document.getElementById('storage-config-display');
  if(!container) return;

  if (!forceReset && window.storageConfigPanelDirty && container.querySelector('#storage-room-rows')) {
    updateStorageConfigSummaryDisplay();
    updateStorageConfigDirtyBanner(true);
    return;
  }

  const storageDetails = Array.isArray(storageConfig.details) ? storageConfig.details : [];
  const stats = getStorageConfigSummaryStats();
  const emptyRoomsMessage = storageDetails.length === 0
    ? `<tr><td colspan="5" style="text-align:center; color:var(--text-gray); padding:1.5rem;">${t('storage.noRooms')}</td></tr>`
    : storageDetails.map((det, index) => renderStorageRoomCard(det, index)).join('');

  container.innerHTML = `
    <div data-storage-config-summary style="background:rgba(255,255,255,0.7); padding:1.2rem; border-radius:12px; border:1px solid rgba(148,163,184,0.18);">
      <div style="font-weight:700; margin-bottom:0.8rem;">${t('storage.roomCount')} <span style="color:var(--red); font-size:16px;">${stats.totalRooms}</span></div>
      <div style="display:grid; gap:0.6rem; font-size:13px;">
        <div>${t('storage.fridgesPerRoom')} <strong>${formatStorageAverage(stats.avgFridgesPerRoom)}</strong></div>
        <div>${t('storage.shelvesPerFridgeShort')} <strong>${formatStorageAverage(stats.avgShelvesPerFridge)}</strong></div>
        <div>${t('storage.capacityPerShelf')} <strong>${formatStorageAverage(stats.avgCapacityPerShelf)}</strong> ${t('dashboard.stat.unit.bag')}</div>
      </div>
    </div>
    <div style="background:rgba(255,255,255,0.7); padding:1.2rem; border-radius:12px; border:1px solid rgba(148,163,184,0.18); grid-column:1 / -1;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; flex-wrap:wrap; margin-bottom:1rem;">
        <div style="font-weight:700;">${t('storage.roomDetails')}</div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" type="button" onclick="addStorageRoomCard('storage-room-rows')">${t('btn.addRoom')}</button>
          <button class="btn btn-primary btn-sm" type="button" onclick="saveStorageConfigFromPanel()">💾 ${t('btn.saveStorage')}</button>
        </div>
      </div>
      <div class="table-responsive">
        <table>
          <thead>
            <tr><th>${t('storage.roomName')}</th><th>${t('storage.totalCapacity')}</th><th>${t('storage.fridgeCount')}</th><th>${t('storage.fridgeDetails')}</th><th>${t('table.actions')}</th></tr>
          </thead>
          <tbody id="storage-room-rows">
            ${emptyRoomsMessage}
          </tbody>
        </table>
      </div>
    </div>
  `;
  bindStorageConfigPanelListeners();
  if (window.storageConfigPanelDirty) updateStorageConfigDirtyBanner(true);
}

async function executeAddAccount() {
  const username = document.getElementById('new-account-username').value.trim().toLowerCase();
  const name = document.getElementById('new-account-name').value.trim();
  const password = document.getElementById('new-account-password').value;
  const email = document.getElementById('new-account-email').value.trim();
  const role = document.getElementById('new-account-role').value;

  if(!username || !name || !password || !email) {
    alertT('msg.form.requiredFieldsBang'); // ar: يرجى ملء جميع الحقول المطلوبة!
    return;
  }
  if (role === 'superadmin') {
    alertT('msg.account.superAdminCreateBlocked'); // ar: ❌ لا يمكن إنشاء حساب سوبر أدمن من هنا.
    return;
  }

  try {
    await Drop4LifeAPI.createAccount({ username, name, role, email, password, status: 'active' });
    const actor = getAuditActor();
    await Drop4LifeAPI.pushAudit(actor.user, actor.role, t('auditAction.addAccount'), `${name} (${username})`);
    document.getElementById('new-account-username').value = '';
    document.getElementById('new-account-name').value = '';
    document.getElementById('new-account-password').value = '';
    document.getElementById('new-account-email').value = '';
    document.getElementById('new-account-role').value = 'admin';
    closeModal('modal-add-account');
    await syncFromServer();
    triggerToast(t('toast.accountAdded'), username);
  } catch (err) {
    alert(trMsg(err.message));
  }
}

function openEditAccountModal(username) {
  if (!isSuperUser()) return;
  const account = accounts.find(a => a.username === username);
  if(!account) return;
  const isProtectedSuperAdmin = account.role === 'superadmin' || account.role_code === 'DR';

  document.getElementById('edit-account-username').value = username;
  document.getElementById('edit-account-name').value = account.name;
  document.getElementById('edit-account-email').value = account.email;
  const roleSelect = document.getElementById('edit-account-role');
  const statusGroup = document.getElementById('edit-account-status-group');
  const deleteButton = document.getElementById('edit-account-delete-btn');
  if (isProtectedSuperAdmin) {
    roleSelect.innerHTML = '<option value="superadmin">🔐 Super Admin</option>';
    roleSelect.value = 'superadmin';
    roleSelect.disabled = true;
    if (statusGroup) statusGroup.style.display = 'none';
    if (deleteButton) deleteButton.style.display = 'none';
  } else {
    roleSelect.innerHTML = `
      <option value="admin">👨‍💼 Admin</option>
      <option value="lab">🔬 Lab</option>
    `;
    roleSelect.value = account.role === 'lab' ? 'lab' : 'admin';
    roleSelect.disabled = false;
    if (statusGroup) statusGroup.style.display = '';
    if (deleteButton) deleteButton.style.display = '';
  }
  document.getElementById('edit-account-status').value = account.status;
  document.getElementById('edit-account-password').value = '';
  document.getElementById('edit-account-title').innerText = tf('render.editAccountTitle', { name: account.name });
  
  openModal('modal-edit-account');
}

async function executeSaveAccount() {
  if (!isSuperUser()) return;
  const username = document.getElementById('edit-account-username').value;
  const name = document.getElementById('edit-account-name').value.trim();
  const email = document.getElementById('edit-account-email').value.trim();
  const role = document.getElementById('edit-account-role').value;
  const status = document.getElementById('edit-account-status').value;
  const newPassword = document.getElementById('edit-account-password').value;

  if(!name || !email) {
    alertT('msg.form.requiredFieldsBang'); // ar: يرجى ملء جميع الحقول المطلوبة!
    return;
  }
  if (role === 'superadmin' && accounts.find(a => a.username === username)?.role !== 'superadmin') {
    alertT('msg.account.superAdminPromoteBlocked'); // ar: ❌ لا يمكن ترقية حساب إلى سوبر أدمن.
    return;
  }

  const body = { name, email, role, status };
  if (newPassword) {
    if (newPassword.length < 4) {
      alertT('msg.profile.passwordMin'); // ar: كلمة المرور يجب أن تكون 4 أحرف على الأقل.
      return;
    }
    body.password = newPassword;
  }

  try {
    await Drop4LifeAPI.updateAccount(username, body);
    const actor = getAuditActor();
    await Drop4LifeAPI.pushAudit(actor.user, actor.role, t('auditAction.updateAccount'), username);
    document.getElementById('edit-account-password').value = '';
    closeModal('modal-edit-account');
    await syncFromServer();
    triggerToast(t('toast.accountSaved'), body.password ? tf('toast.accountSavedPassword', { name }) : name);
  } catch (err) {
    alert(trMsg(err.message));
  }
}

async function executeDeleteAccount() {
  if (!isSuperUser()) return;
  const username = document.getElementById('edit-account-username').value;
  const account = accounts.find(a => a.username === username);
  if(!account) return;
  if(account.username === 'superadmin') {
    alertT('msg.account.superAdminDeleteBlocked'); // ar: ❌ لا يمكن حذف حساب Super Admin الرئيسي!
    return;
  }
  if(!confirmT('msg.confirm.deleteAccount', { name: account.name })) return;
  try {
    await Drop4LifeAPI.deleteAccount(username);
    const actor = getAuditActor();
    await Drop4LifeAPI.pushAudit(actor.user, actor.role, t('auditAction.deleteAccount'), username);
    closeModal('modal-edit-account');
    await syncFromServer();
    triggerToast(t('toast.accountDeleted'), account.name);
  } catch (err) {
    alert(trMsg(err.message));
  }
}

function getDefaultStorageRoomDetails() {
  const totalRooms = parseInt(storageConfig.totalRooms, 10);
  if (!Number.isFinite(totalRooms) || totalRooms <= 0) return [];
  const fridgesPerRoom = Math.max(parseInt(storageConfig.totalFridgesPerRoom, 10) || 1, 1);
  const shelvesPerFridge = Math.max(parseInt(storageConfig.totalShelvesPerFridge, 10) || 1, 1);
  const capPerShelf = parseInt(storageConfig.capacityPerShelf, 10) || 100;

  return Array.from({ length: totalRooms }, (_, roomIndex) => {
    const roomName = `Room ${String.fromCharCode(65 + roomIndex)}`;
    const fridges = Array.from({ length: fridgesPerRoom }, (_, fridgeIndex) => `Fridge ${fridgeIndex + 1}`);
    const shelves = Object.fromEntries(
      fridges.map((fridgeName) => [fridgeName, Array.from({ length: shelvesPerFridge }, (_, shelfIndex) => `Shelf ${shelfIndex + 1}`)])
    );
    const fridgeSettings = Object.fromEntries(
      fridges.map((fridgeName) => [fridgeName, { shelves: shelvesPerFridge, capacityPerShelf: capPerShelf }])
    );
    return {
      room: roomName,
      roomKey: roomName,
      fridges,
      shelves,
      fridgeSettings,
      roomCapacity: fridges.length * shelvesPerFridge * capPerShelf,
    };
  });
}

function buildFridgeConfigHtml(detail, readOnly = true) {
  const fridges = Array.isArray(detail.fridges) && detail.fridges.length ? detail.fridges : ['Fridge 1'];
  const defaultCap = parseInt(storageConfig.capacityPerShelf, 10) || 100;
  const defaultShelves = parseInt(storageConfig.totalShelvesPerFridge, 10) || 4;
  const fridgeSettings = detail.fridgeSettings || {};
  return fridges.map((fridgeName) => {
    const settings = fridgeSettings[fridgeName] || {};
    const shelfList = detail.shelves?.[fridgeName] || [];
    const shelvesCount = parseInt(settings.shelves, 10) || shelfList.length || defaultShelves;
    const capPerShelf = parseInt(settings.capacityPerShelf, 10) || defaultCap;
    return `
      <div class="fridge-config-row storage-room-field" data-fridge-name="${escapeHtml(fridgeName)}" style="display:grid; grid-template-columns:minmax(80px,1fr) repeat(2,minmax(70px,90px)); gap:0.5rem; align-items:center; padding:0.35rem 0; border-bottom:1px dashed rgba(148,163,184,0.25);">
        <span style="font-size:12px; font-weight:600;">${escapeHtml(fridgeName)}</span>
        <label style="font-size:11px; display:grid; gap:0.2rem;">${t('storage.shelvesLabel')}<input type="number" class="form-control storage-fridge-shelves storage-room-field" value="${shelvesCount}" min="1" max="20" ${readOnly ? 'readonly' : ''} oninput="recalcStorageRoomCapacity(this)" /></label>
        <label style="font-size:11px; display:grid; gap:0.2rem;">${t('storage.capPerShelfLabel')}<input type="number" class="form-control storage-fridge-capacity storage-room-field" value="${capPerShelf}" min="1" max="5000" ${readOnly ? 'readonly' : ''} oninput="recalcStorageRoomCapacity(this)" /></label>
      </div>
    `;
  }).join('');
}

function recalcStorageRoomCapacity(inputEl) {
  const row = inputEl?.closest('[data-storage-room-row]');
  if (!row) return;
  let total = 0;
  row.querySelectorAll('.fridge-config-row').forEach((fridgeRow) => {
    const shelves = Math.max(parseInt(fridgeRow.querySelector('.storage-fridge-shelves')?.value, 10) || 1, 1);
    const cap = Math.max(parseInt(fridgeRow.querySelector('.storage-fridge-capacity')?.value, 10) || 1, 1);
    total += shelves * cap;
  });
  const capacityInput = row.querySelector('.storage-room-capacity');
  if (capacityInput) capacityInput.value = total;
  markStorageConfigPanelDirty();
}

function rebuildFridgeConfigList(row) {
  const list = row.querySelector('.fridge-config-list');
  const fridgesCount = Math.max(parseInt(row.querySelector('.storage-room-fridges-count')?.value, 10) || 1, 1);
  if (!list) return;
  const existing = {};
  list.querySelectorAll('.fridge-config-row').forEach((fridgeRow, index) => {
    existing[`Fridge ${index + 1}`] = {
      shelves: parseInt(fridgeRow.querySelector('.storage-fridge-shelves')?.value, 10) || 4,
      capacityPerShelf: parseInt(fridgeRow.querySelector('.storage-fridge-capacity')?.value, 10) || 100,
    };
  });
  const fridges = Array.from({ length: fridgesCount }, (_, i) => `Fridge ${i + 1}`);
  const detail = {
    fridges,
    fridgeSettings: Object.fromEntries(fridges.map((name, i) => {
      const prev = existing[name] || existing[`Fridge ${i + 1}`] || { shelves: 4, capacityPerShelf: 100 };
      return [name, prev];
    })),
    shelves: Object.fromEntries(fridges.map((name, i) => {
      const count = existing[name]?.shelves || existing[`Fridge ${i + 1}`]?.shelves || 4;
      return [name, Array.from({ length: count }, (_, s) => `Shelf ${s + 1}`)];
    })),
  };
  const isEditing = row.dataset.editing === '1';
  list.innerHTML = buildFridgeConfigHtml(detail, !isEditing);
  recalcStorageRoomCapacity(list);
  markStorageConfigPanelDirty();
}

function countStorageBagsForRoom(roomName) {
  const normalizedRoom = String(roomName || '').trim();
  if (!normalizedRoom) return 0;
  return getActiveBloodBags().reduce((sum, bag) => {
    const parts = parseBagLocationParts(bag.location);
    if (parts.room === normalizedRoom) {
      return sum + bagStorageUnits(bag);
    }
    return sum;
  }, 0);
}

function normalizeStorageLocation(location) {
  return String(location || '').replace(/^[^\w]*(?:تخزين رئيسي:\s*)?/, '').trim();
}

function renderStorageRoomCard(detail, index) {
  const roomName = escapeHtml(detail.room || `Room ${index + 1}`);
  const roomKey = escapeHtml(detail.roomKey || detail.room || `Room ${index + 1}`);
  const fridges = Array.isArray(detail.fridges) && detail.fridges.length ? detail.fridges : ['Fridge 1'];
  const roomCapacity = Number(detail.roomCapacity ?? detail.capacity ?? fridges.reduce((sum, fridgeName) => {
    const cfg = detail.fridgeSettings?.[fridgeName] || {};
    const shelfList = detail.shelves?.[fridgeName] || [];
    const shelves = parseInt(cfg.shelves, 10) || shelfList.length || 4;
    const cap = parseInt(cfg.capacityPerShelf, 10) || (parseInt(storageConfig.capacityPerShelf, 10) || 100);
    return sum + shelves * cap;
  }, 0));
  const usedCount = countStorageBagsForRoom(detail.room || `Room ${index + 1}`);

  return `
    <tr data-storage-room-row data-storage-room-card data-room-key="${roomKey}" data-editing="0">
      <td>
        <input type="hidden" class="storage-room-key storage-room-field" value="${roomKey}" />
        <input type="text" class="form-control storage-room-name storage-room-field" value="${roomName}" readonly />
        <div style="margin-top:0.35rem; font-size:12px; color:var(--text-gray);">${tf('storage.bagsLinked', { count: usedCount })}</div>
      </td>
      <td><input type="number" class="form-control storage-room-capacity storage-room-field" value="${roomCapacity}" min="1" max="50000" readonly /></td>
      <td><input type="number" class="form-control storage-room-fridges-count storage-room-field" value="${fridges.length}" min="1" max="10" readonly oninput="rebuildFridgeConfigList(this.closest('[data-storage-room-row]'))" /></td>
      <td>
        <div class="fridge-config-list">${buildFridgeConfigHtml(detail, true)}</div>
      </td>
      <td>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" type="button" onclick="toggleStorageRoomEdit(this)">${t('btn.editRoom')}</button>
          <button class="btn btn-danger btn-sm" type="button" onclick="removeStorageRoomCard(this)">🗑️ ${t('btn.delete')}</button>
        </div>
      </td>
    </tr>
  `;
}

function addStorageRoomCard(containerId) {
  const container = document.getElementById(containerId || 'storage-room-rows');
  if(!container) return;
  const index = container.querySelectorAll('[data-storage-room-row]').length + 1;
  const wrapper = document.createElement('tbody');
  wrapper.innerHTML = renderStorageRoomCard({
    room: `Room ${index}`,
    roomKey: `Room ${index}`,
    fridges: ['Fridge 1'],
    shelves: { 'Fridge 1': ['Shelf 1', 'Shelf 2', 'Shelf 3', 'Shelf 4'] },
    fridgeSettings: { 'Fridge 1': { shelves: 4, capacityPerShelf: parseInt(storageConfig.capacityPerShelf, 10) || 100 } },
    roomCapacity: 400,
  }, index - 1);
  const row = wrapper.querySelector('tr');
  if (row) container.appendChild(row);
  markStorageConfigPanelDirty();
}

function removeStorageRoomCard(button) {
  const row = button.closest('[data-storage-room-row]');
  if(!row) return;
  const roomName = row.querySelector('.storage-room-name')?.value || '';
  if(countStorageBagsForRoom(roomName) > 0) {
    alertT('msg.storage.roomHasBags'); // ar: لا يمكن حذف غرفة تحتوي على أكياس مخزنة.
    return;
  }
  row.remove();
  markStorageConfigPanelDirty();
}

function toggleStorageRoomEdit(button) {
  const row = button.closest('[data-storage-room-row]');
  if(!row) return;
  const fields = Array.from(row.querySelectorAll('.storage-room-field'));
  const isEditing = row.dataset.editing === '1';
  row.dataset.editing = isEditing ? '0' : '1';
  fields.forEach((field) => {
    if (field.classList.contains('storage-room-capacity')) return;
    field.readOnly = isEditing;
  });
  button.textContent = isEditing ? t('btn.editRoom') : t('btn.lockRoom');
  if(!isEditing) {
    row.classList.add('editing-storage-room');
    fields[0]?.focus();
    markStorageConfigPanelDirty();
  } else {
    row.classList.remove('editing-storage-room');
    recalcStorageRoomCapacity(row);
  }
}

function collectStorageConfigDetails() {
  const panelRows = document.getElementById('storage-room-rows');
  const root = panelRows || document.getElementById('storage-config-display') || document;
  const rows = Array.from(root.querySelectorAll('[data-storage-room-row]'));
  return rows.map((row) => {
    const room = row.querySelector('.storage-room-name')?.value?.trim() || 'Room';
    const roomKey = row.querySelector('.storage-room-key')?.value?.trim() || room;
    const fridgesCount = Math.max(parseInt(row.querySelector('.storage-room-fridges-count')?.value, 10) || 1, 1);
    const roomCapacity = Math.max(parseInt(row.querySelector('.storage-room-capacity')?.value, 10) || 1, 1);
    const fridges = Array.from({ length: fridgesCount }, (_, fridgeIndex) => `Fridge ${fridgeIndex + 1}`);
    const fridgeSettings = {};
    const shelves = {};
    row.querySelectorAll('.fridge-config-row').forEach((fridgeRow, fridgeIndex) => {
      const fridgeName = fridgeRow.dataset.fridgeName || `Fridge ${fridgeIndex + 1}`;
      const shelvesCount = Math.max(parseInt(fridgeRow.querySelector('.storage-fridge-shelves')?.value, 10) || 1, 1);
      const capacityPerShelf = Math.max(parseInt(fridgeRow.querySelector('.storage-fridge-capacity')?.value, 10) || 1, 1);
      fridgeSettings[fridgeName] = { shelves: shelvesCount, capacityPerShelf };
      shelves[fridgeName] = Array.from({ length: shelvesCount }, (_, shelfIndex) => `Shelf ${shelfIndex + 1}`);
    });
    if (!Object.keys(fridgeSettings).length) {
      const defaultShelves = parseInt(storageConfig.totalShelvesPerFridge, 10) || 4;
      const defaultCap = parseInt(storageConfig.capacityPerShelf, 10) || 100;
      fridges.forEach((fridgeName) => {
        fridgeSettings[fridgeName] = { shelves: defaultShelves, capacityPerShelf: defaultCap };
        shelves[fridgeName] = Array.from({ length: defaultShelves }, (_, shelfIndex) => `Shelf ${shelfIndex + 1}`);
      });
    }
    return { roomKey, room, roomCapacity, fridges, shelves, fridgeSettings };
  });
}

async function persistStorageConfig() {
  const details = collectStorageConfigDetails();
  const capacityValues = details.flatMap((detail) => Object.values(detail.fridgeSettings || {}).map(fs => fs.capacityPerShelf));
  const capacityPerShelf = capacityValues.length
    ? Math.min(...capacityValues)
    : (parseInt(storageConfig.capacityPerShelf, 10) || 100);

  if(details.length < 1) {
    alertT('msg.storage.roomRequired'); // ar: يرجى إضافة غرفة واحدة على الأقل قبل الحفظ.
    return false;
  }
  if (capacityValues.some(v => v < 1)) {
    alertT('msg.storage.shelfCapacityRequired'); // ar: يرجى إدخال سعة صحيحة لكل رف.
    return false;
  }

  try {
    const saved = await Drop4LifeAPI.saveStorageConfig({
      totalRooms: details.length,
      totalFridgesPerRoom: Math.max(...details.map((detail) => detail.fridges.length)),
      totalShelvesPerFridge: Math.max(...details.map((detail) => Math.max(...Object.values(detail.shelves).map((items) => items.length)))),
      capacityPerShelf,
      roomNames: details.map((detail) => detail.room),
      details
    });
    if (saved && typeof saved === 'object') {
      Object.assign(storageConfig, saved);
      window.storageConfig = storageConfig;
    }
    clearStorageConfigPanelDirty();
    renderStorageConfigDisplay(true);
    await syncFromServer();
    triggerToast(t('toast.storageUpdated'), tf('toast.storageUpdatedBody', { count: details.length }));
    return true;
  } catch (err) {
    alert(trMsg(err.message));
    return false;
  }
}

async function saveStorageConfigFromPanel() {
  await persistStorageConfig();
}

async function showAppForUser() {
  if (!Drop4LifeAPI.isLoggedIn()) {
    showLoginScreen();
    return;
  }

  try {
    await syncFromServer();
  } catch (err) {
    const isAuthError =
      err &&
      (err.status === 401 || err.status === 403);
    if (isAuthError) {
      Drop4LifeAPI.clearAuthSession();
      currentUser = null;
      showLoginScreen();
      return;
    }
    if (typeof triggerToast === 'function') {
      triggerToast(t('toast.loadErrorTitle'), trMsg(err && err.message) || t('toast.loadFailed'));
    }
    return;
  }

  if (!window.currentUser) {
    showLoginScreen();
    return;
  }

  rebindLiveDataRefs();
  setupNumericFields();
  document.getElementById('auth-wrapper').style.display = 'none';
  document.getElementById('app-wrapper').style.display = 'flex';
  buildApplicationAccess();
  if (typeof initLocale === 'function') initLocale();
  startLiveSync();
}

async function checkAutoLogin() {
  if (!Drop4LifeAPI.isLoggedIn()) {
    currentUser = null;
    return;
  }

  currentUser = window.currentUser;
  try {
    await showAppForUser();
  } catch (err) {
    Drop4LifeAPI.clearAuthSession();
    currentUser = null;
    if (err && err.message && typeof triggerToast === 'function') {
      triggerToast(t('toast.sessionExpiredTitle'), trMsg(err.message));
    }
  }
}

function stripCredentialsFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('username') || params.has('password')) {
      window.history.replaceState(null, '', window.location.pathname || '/');
    }
  } catch (_) {}
}

function bindLoginForm() {
  const form = document.getElementById('login-form');
  if (!form || form.dataset.loginBound === '1') return;
  form.dataset.loginBound = '1';
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    handleLogin(event);
  });
}

function bootApp() {
  stripCredentialsFromUrl();
  bindLoginForm();
  if (typeof initLocale === 'function') initLocale();
  if (typeof window.Drop4LifeAPI === 'undefined' || typeof window.emptyBloodInventoryTemplate !== 'function') {
    const err = document.getElementById('login-error');
    if (err) {
      err.innerText = t('msg.api.serverRequired');
      err.style.display = 'block';
    }
    console.error('Drop4LifeAPI is not defined — check that /static/js/api-client.js loaded without a 404');
    notifyParentReady();
    return;
  }

  window.bloodInventory = window.emptyBloodInventoryTemplate();
  bloodInventory = window.bloodInventory;
  void bootAppAsync();
}

async function bootAppAsync() {
  if (typeof Drop4LifeAPI !== 'undefined' && typeof Drop4LifeAPI.restoreSessionUser === 'function') {
    Drop4LifeAPI.restoreSessionUser();
    currentUser = window.currentUser;
  }
  if (typeof Drop4LifeAPI !== 'undefined' && Drop4LifeAPI.isLoggedIn()) {
    try {
      await showAppForUser();
      resolveInitialRoute();
      notifyParentReady();
      return;
    } catch (_) {
      Drop4LifeAPI.clearAuthSession();
      currentUser = null;
    }
  }
  showLoginScreen();
  notifyParentReady();
}

function notifyParentReady() {
  try {
    window.parent.postMessage({ type: 'drop4life:ready', loggedIn: Drop4LifeAPI.isLoggedIn() }, '*');
  } catch (_) {}
}

window.handleLogin = handleLogin;
bootApp();
