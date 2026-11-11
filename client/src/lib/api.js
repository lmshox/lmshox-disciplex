import { KEYS, read, write } from './storage.js';

export class ApiError extends Error {
  constructor(status, code, message, field) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
  get isNetwork() {
    return this.status === 0;
  }
}

let token = read(KEYS.token);
const unauthorizedListeners = new Set();

export const auth = {
  get token() {
    return token;
  },
  set(next) {
    token = next;
    write(KEYS.token, next);
  },
  onUnauthorized(fn) {
    unauthorizedListeners.add(fn);
    return () => unauthorizedListeners.delete(fn);
  },
};

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'You are offline.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error ?? {};
    if (res.status === 401 && token) unauthorizedListeners.forEach((fn) => fn());
    throw new ApiError(res.status, err.code ?? 'HTTP_ERROR', err.message ?? `Request failed (${res.status})`, err.field);
  }
  return data;
}

export const api = {
  register: (username, password, timezone) => request('POST', '/auth/register', { username, password, timezone }),
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  logout: () => request('POST', '/auth/logout'),
  state: () => request('GET', '/state'),
  history: () => request('GET', '/history'),
  createTask: (task) => request('POST', '/tasks', task),
  updateTask: (id, task) => request('PUT', `/tasks/${id}`, task),
  archiveTask: (id) => request('DELETE', `/tasks/${id}`),
  complete: (instanceId) => request('POST', `/instances/${instanceId}/complete`),
  accountability: (log) => request('POST', '/accountability', log),
};
