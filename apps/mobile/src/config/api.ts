import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL as DEFAULT_API_URL } from '../constants/theme';

const API_URL_STORAGE_KEY = '@fuvex/api-url';

export const normalizeMobileApiUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

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
