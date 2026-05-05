/**
 * ═══════════════════════════════════════════════════
 * API Client — Fuvex Manager Mobile
 * Axios instance con interceptor de autenticación
 * ═══════════════════════════════════════════════════
 */
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getRuntimeApiUrl, setRuntimeApiUrl } from '../config/api';

// Token storage (usamos módulo simple, se puede migrar a SecureStore)
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

// Crear instancia de Axios
const api: AxiosInstance = axios.create({
  baseURL: getRuntimeApiUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setApiBaseUrl = (url: string) => {
  const normalized = setRuntimeApiUrl(url);
  api.defaults.baseURL = normalized;
  return normalized;
};

export const getApiBaseUrl = () => getRuntimeApiUrl();

// Request interceptor — inyectar token automáticamente
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.baseURL = getRuntimeApiUrl();
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — manejar errores globales
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      authToken = null;
      // El componente LoginView detectará que no hay token
    }
    return Promise.reject(error);
  }
);

export default api;
