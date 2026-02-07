/**
 * Silent Lease — Auth & Shared Logic
 * Uses localStorage for registration and login
 */

// Storage keys (base names; user-scoped keys add suffix per login)
const STORAGE_USERS = 'silentlease_users';
const STORAGE_CURRENT = 'silentlease_current';
const STORAGE_QUIZ = 'silentlease_exitPlanData';
const STORAGE_TASKS = 'silentlease_tasks';
const STORAGE_APP_STATE = 'silentlease_appState';

// Default task IDs for dashboard Task Tracker (order matters for display)
const DASHBOARD_TASK_IDS = ['send-notice', 'prepare-documents', 'final-inspection', 'key-handover'];

// Per-user storage suffix so each login has its own quiz/tasks (fresh like first time for another user)
function getStorageSuffix() {
  try {
    const data = localStorage.getItem(STORAGE_CURRENT);
    const user = data ? JSON.parse(data) : null;
    if (user && user.isLoggedIn && user.email) {
      return '_' + String(user.email).replace(/[^a-zA-Z0-9@._-]/g, '_');
    }
  } catch (_) {}
  return '';
}

// --------------------------------------------
// Centralized app state (syncs with quiz + tasks for a single source of truth)
// --------------------------------------------
function getAppState() {
  try {
    const suffix = getStorageSuffix();
    const key = STORAGE_APP_STATE + suffix;
    const raw = localStorage.getItem(key);
    const state = raw ? JSON.parse(raw) : {};
    const exitPlan = getExitPlanData();
    const tasks = getTasks();
    return {
      isPlanGenerated: !!state.isPlanGenerated || !!exitPlan,
      exitPlanData: state.exitPlanData || exitPlan || null,
      completedTasks: state.completedTasks || tasks || {},
      ...state
    };
  } catch {
    return { isPlanGenerated: false, exitPlanData: null, completedTasks: {} };
  }
}

function saveAppState(updates) {
  try {
    const suffix = getStorageSuffix();
    const current = getAppState();
    const next = { ...current, ...updates };
    if (next.exitPlanData != null) {
      localStorage.setItem(STORAGE_QUIZ + suffix, JSON.stringify(next.exitPlanData));
    }
    if (next.completedTasks != null && typeof next.completedTasks === 'object') {
      localStorage.setItem(STORAGE_TASKS + suffix, JSON.stringify(next.completedTasks));
    }
    localStorage.setItem(STORAGE_APP_STATE + suffix, JSON.stringify({
      isPlanGenerated: next.isPlanGenerated,
      exitPlanData: next.exitPlanData,
      completedTasks: next.completedTasks
    }));
    return true;
  } catch {
    return false;
  }
}

// Email validation
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Password validation (min 8 chars)
function isValidPassword(password) {
  return password && password.length >= 8;
}

// Password strength: 'weak' | 'medium' | 'strong'
function getPasswordStrength(password) {
  if (!password) return 'weak';
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
}

// Phone validation (North American: XXX-XXX-XXXX or (XXX) XXX-XXXX or +1 XXX XXX XXXX, etc.)
function isValidPhone(phone) {
  if (!phone || !phone.trim()) return true; // optional field
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

// Toast notification with progress timer bar (premium SaaS feel)
const TOAST_DURATION_MS = 4000;
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast--${type} toast--glass`;
  const text = document.createElement('span');
  text.className = 'toast__message';
  text.textContent = message;
  toast.appendChild(text);
  const barWrap = document.createElement('div');
  barWrap.className = 'toast__progress-wrap';
  const bar = document.createElement('div');
  bar.className = 'toast__progress-bar';
  barWrap.appendChild(bar);
  toast.appendChild(barWrap);
  document.body.appendChild(toast);

  bar.style.animation = `toastProgress ${TOAST_DURATION_MS}ms linear forwards`;
  setTimeout(() => toast.remove(), TOAST_DURATION_MS);
}

// Professional notification (alias; use for quiz complete, task complete, profile update)
function showNotification(message, type = 'success') {
  showToast(message, type);
}

// Get all users from localStorage
function getUsers() {
  try {
    const data = localStorage.getItem(STORAGE_USERS);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

// Save users to localStorage
function saveUsers(users) {
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
}

// Register new user (extended fields: phone, address, occupation)
function register(email, password, name, phone, address, occupation) {
  const users = getUsers();
  const key = email.toLowerCase().trim();

  if (users[key]) {
    return { success: false, error: 'An account with this email already exists.' };
  }
  if (!isValidEmail(email)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  if (!isValidPassword(password)) {
    return { success: false, error: 'Password must be at least 8 characters.' };
  }
  if (!isValidPhone(phone)) {
    return { success: false, error: 'Please enter a valid phone number (10–15 digits).' };
  }

  users[key] = {
    email: key,
    password: password,
    name: (name || 'User').trim() || 'User',
    phone: (phone || '').trim(),
    address: (address || '').trim(),
    occupation: (occupation || '').trim(),
    registeredAt: new Date().toISOString(),
  };
  saveUsers(users);

  // Auto-login
  const userData = users[key];
  localStorage.setItem(STORAGE_CURRENT, JSON.stringify({
    email: key,
    name: userData.name,
    phone: userData.phone,
    address: userData.address,
    occupation: userData.occupation,
    isLoggedIn: true,
  }));

  return { success: true };
}

// Login user
function login(email, password) {
  const users = getUsers();
  const key = email.toLowerCase().trim();

  if (!users[key]) {
    return { success: false, error: 'No account found with this email address.' };
  }
  if (users[key].password !== password) {
    return { success: false, error: 'The password you entered is incorrect.' };
  }

  const u = users[key];
  localStorage.setItem(STORAGE_CURRENT, JSON.stringify({
    email: key,
    name: u.name,
    phone: u.phone || '',
    address: u.address || '',
    occupation: u.occupation || '',
    isLoggedIn: true,
  }));

  return { success: true };
}

// Update user profile (checks email uniqueness)
function updateUserProfile(updates) {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Not logged in.' };

  const users = getUsers();
  const currentKey = current.email.toLowerCase().trim();
  const newEmail = (updates.email || current.email).toLowerCase().trim();

  if (newEmail !== currentKey) {
    if (!isValidEmail(newEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (users[newEmail]) {
      return { success: false, error: 'This email is already taken by another account.' };
    }
    // Migrate user to new email key
    users[newEmail] = { ...users[currentKey] };
    delete users[currentKey];
  }

  const user = users[newEmail];
  if (updates.name !== undefined) user.name = (updates.name || '').trim() || 'User';
  if (updates.phone !== undefined) {
    if (!isValidPhone(updates.phone)) {
      return { success: false, error: 'Please enter a valid phone number.' };
    }
    user.phone = (updates.phone || '').trim();
  }
  if (updates.address !== undefined) user.address = (updates.address || '').trim();
  if (updates.occupation !== undefined) user.occupation = (updates.occupation || '').trim();
  if (updates.password && updates.password.length >= 8) {
    user.password = updates.password;
  }

  user.email = newEmail;
  saveUsers(users);

  localStorage.setItem(STORAGE_CURRENT, JSON.stringify({
    email: newEmail,
    name: user.name,
    phone: user.phone || '',
    address: user.address || '',
    occupation: user.occupation || '',
    isLoggedIn: true,
  }));

  return { success: true };
}

// Logout
function logout() {
  localStorage.removeItem(STORAGE_CURRENT);
}

// Get current user
function getCurrentUser() {
  try {
    const data = localStorage.getItem(STORAGE_CURRENT);
    const user = data ? JSON.parse(data) : null;
    return user && user.isLoggedIn ? user : null;
  } catch {
    return null;
  }
}

// Load exit plan data from localStorage (for dashboard) — per user
function getExitPlanData() {
  try {
    const suffix = getStorageSuffix();
    const raw = localStorage.getItem(STORAGE_QUIZ + suffix);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Task Tracker: load completed task IDs from localStorage — per user
function getTasks() {
  try {
    const suffix = getStorageSuffix();
    const raw = localStorage.getItem(STORAGE_TASKS + suffix);
    const obj = raw ? JSON.parse(raw) : {};
    return typeof obj === 'object' && obj !== null ? obj : {};
  } catch {
    return {};
  }
}

// Task Tracker: save completed task IDs to localStorage — per user
function saveTasks(tasksObj) {
  try {
    const suffix = getStorageSuffix();
    localStorage.setItem(STORAGE_TASKS + suffix, JSON.stringify(tasksObj));
    return true;
  } catch {
    return false;
  }
}

// Days until move-out (from exit plan); returns null if no date or invalid
function getDaysUntilMoveOut() {
  const data = getExitPlanData();
  if (!data || !data.moveOutDate) return null;
  const moveOut = new Date(data.moveOutDate);
  const now = new Date();
  const days = Math.ceil((moveOut - now) / (1000 * 60 * 60 * 24));
  return days;
}

// Formspree: submit housing-related fields only (email, location, move_out_date, landlord_status)
const FORMSPREE_URL = 'https://formspree.io/f/mlgwrazj';
function submitHousingToFormspree(housingData) {
  var body = {
    email: housingData.email || '',
    location: housingData.location || '',
    move_out_date: housingData.move_out_date || '',
    landlord_status: housingData.landlord_status || ''
  };
  return fetch(FORMSPREE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function(res) { return res.ok; });
}

// Require auth — redirect to login if not logged in
function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname || 'dashboard.html');
    return null;
  }
  return user;
}

// Local Tenant Tip: personalized by occupation + cityProvince (for dashboard)
function getLocalTenantTip(occupation, cityProvince) {
  const city = (cityProvince || '').toLowerCase();
  const occ = (occupation || '').toLowerCase();
  const tips = [];
  if (occ === 'student') {
    if (city.includes('ottawa')) {
      tips.push({ title: 'Tip for students in Ottawa', body: 'In Ontario, students can assign their lease (sublet) with landlord consent. uOttawa and Carleton offer off-campus housing resources — check your student union for free legal clinics before sending notice.' });
    } else if (city.includes('toronto') || city.includes('ontario')) {
      tips.push({ title: 'Tip for students in Ontario', body: 'Ontario allows lease assignment. If your landlord unreasonably refuses an assignee, you can give 30 days\' notice to end the tenancy. Keep all refusals in writing.' });
    } else if (city.includes('montreal') || city.includes('quebec')) {
      tips.push({ title: 'Tip for students in Quebec', body: 'In Quebec, fixed-term leases often end automatically — check your lease. For month-to-month, you must give 1–2 months\' notice. The Régie du logement has guides in English.' });
    } else {
      tips.push({ title: 'Tip for students', body: 'Many provinces have special rules for students (e.g. sublets, lease assignment). Check your provincial tenancy board and your school\'s off-campus housing office for local guidance.' });
    }
  } else if (city.includes('ottawa')) {
    tips.push({ title: 'Tip for tenants in Ottawa', body: 'Ontario requires 60 days\' notice for most terminations. Use our notice letter template and keep proof of delivery (email read receipt or registered mail).' });
  } else if (city.includes('ontario')) {
    tips.push({ title: 'Tip for Ontario tenants', body: 'Landlords cannot charge fees for sublets or assignments. If they refuse a reasonable assignee, you may be able to end your tenancy with 30 days\' notice.' });
  }
  return tips.length ? tips[0] : null;
}
