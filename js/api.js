const API_URL = 'https://ironlogapp.duckmydns.org/api';

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
