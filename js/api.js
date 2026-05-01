const API_URL = 'https://ironlogapp.duckdns.org/api';

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('gymapp_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
  const data = await response.json();
  if (!response.ok) {
    console.error('[API]', options.method || 'GET', `${API_URL}${endpoint}`, '→', response.status, data);
    throw { status: response.status, ...data };
  }
  return data;
}

export const authAPI = {
  login: (email, password) => apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
  register: (nombre, apellido, email, password) => apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ nombre, apellido, email, password }),
  }),
  verify: () => apiRequest('/auth/verify'),
};

export const plansAPI = {
  getAll:    () => apiRequest('/plans'),
  getActive: () => apiRequest('/plans/active'),
  create: (name, goal, days, data, weekDays) => apiRequest('/plans', {
    method: 'POST',
    body: JSON.stringify({ name, goal, days, data, week_days: weekDays || null }),
  }),
  update: (id, name, goal, days, data, weekDays) => apiRequest(`/plans/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, goal, days, data, week_days: weekDays || null }),
  }),
  activate: (id) => apiRequest(`/plans/${id}/activate`, { method: 'PUT' }),
  remove:   (id) => apiRequest(`/plans/${id}`, { method: 'DELETE' }),
};

export const sessionsAPI = {
  getAll: () => apiRequest('/sessions'),
  create: (data) => apiRequest('/sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

export const weightsAPI = {
  getAll: () => apiRequest('/weights'),
  update: (exerciseId, data) => apiRequest(`/weights/${exerciseId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

export const progressAPI = {
  getAll: () => apiRequest('/progress'),
  create: (data) => apiRequest('/progress', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  remove: (id) => apiRequest(`/progress/${id}`, { method: 'DELETE' }),
};

export const exercisesAPI = {
  getCustom: () => apiRequest('/exercises/custom'),
  create: (data) => apiRequest('/exercises/custom', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiRequest(`/exercises/custom/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  remove: (id) => apiRequest(`/exercises/custom/${id}`, { method: 'DELETE' }),
};

export const favoritesAPI = {
  getAll: () => apiRequest('/favorites'),
  add: (exerciseId) => apiRequest(`/favorites/${exerciseId}`, { method: 'POST' }),
  remove: (exerciseId) => apiRequest(`/favorites/${exerciseId}`, { method: 'DELETE' }),
};

export const achievementsAPI = {
  getAll: () => apiRequest('/achievements'),
  unlock: (achievementId) => apiRequest(`/achievements/${achievementId}`, { method: 'POST' }),
};
