/**
 * API Service
 * Fetch wrapper for backend API with auth support
 */
const API_BASE = '/api';
const api = {
  defaults: { headers: { common: {} } },
};

async function request(method, path, data = null) {
  const token = api.defaults.headers.common['Authorization']?.replace('Bearer ', '') || localStorage.getItem('token');
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  };
  if (data && method !== 'GET') opts.body = JSON.stringify(data);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || 'Request failed');
  return json;
}

api.get = (path) => request('GET', path);
api.post = (path, data) => request('POST', path, data);
api.put = (path, data) => request('PUT', path, data);
api.delete = (path) => request('DELETE', path);

export default api;
