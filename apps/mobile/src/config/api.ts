import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL as DEFAULT_API_URL } from '../constants/theme';

const API_URL_STORAGE_KEY = '@fuvex/api-url';

const shouldUseHttpByDefault = (value: string) => {
  const host = value
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .split(/[/?#]/)[0]
    .split('@')
    .pop()
    ?.split(':')[0] || '';

  return host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '10.0.2.2' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
};

export const normalizeMobileApiUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `${shouldUseHttpByDefault(trimmed) ? 'http' : 'https'}://${trimmed}`;

  let normalized = withProtocol.replace(/\/$/, '');
  normalized = normalized.replace(/\/api\/health$/i, '/api');

  if (!/\/api$/i.test(normalized)) {
    normalized = `${normalized}/api`;
  }

  return normalized;
};

let runtimeApiUrl = normalizeMobileApiUrl(DEFAULT_API_URL);

export const getDefaultApiUrl = () => normalizeMobileApiUrl(DEFAULT_API_URL);

export const getRuntimeApiUrl = () => runtimeApiUrl;

export const setRuntimeApiUrl = (url: string) => {
  runtimeApiUrl = normalizeMobileApiUrl(url);
  return runtimeApiUrl;
};

export const loadSavedApiUrl = async () => {
  const saved = await AsyncStorage.getItem(API_URL_STORAGE_KEY);
  const resolved = normalizeMobileApiUrl(saved || DEFAULT_API_URL);
  runtimeApiUrl = resolved;
  return resolved;
};

export const saveApiUrl = async (url: string) => {
  const normalized = normalizeMobileApiUrl(url);
  if (!normalized) {
    throw new Error('URL de API vacia');
  }
  await AsyncStorage.setItem(API_URL_STORAGE_KEY, normalized);
  runtimeApiUrl = normalized;
  return normalized;
};

export const clearSavedApiUrl = async () => {
  await AsyncStorage.removeItem(API_URL_STORAGE_KEY);
  const resolved = normalizeMobileApiUrl(DEFAULT_API_URL);
  runtimeApiUrl = resolved;
  return resolved;
};
