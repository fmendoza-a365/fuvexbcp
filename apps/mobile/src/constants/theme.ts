import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const COLORS = {
  blue: '#002A8D',
  blueDark: '#001A57',
  orange: '#FF7800',
  gold: '#F59E0B',
  navy: '#001A57',
  navySoft: '#E6EAF4',
  bcpOrange: '#FF7800',
  slate: '#F8FAFC',
  white: '#FFFFFF',
  whiteText: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  input: '#F8FAFC',
  track: '#E2E8F0',
  divider: '#E2E8F0',
  blueSoft: '#E6EAF4',
  orangeSoft: '#FFF2E6',
  emeraldSoft: '#ECFDF5',
  amberSoft: '#FFFBEB',
  roseSoft: '#FFF1F2',
  emerald: '#10B981',
  amber: '#F59E0B',
  rose: '#DC2626',
  text: '#0F172A',
  subtext: '#64748B',
  muted: '#94A3B8',
  border: '#E2E8F0',
  glassBorder: 'rgba(15, 23, 42, 0.08)'
};

export const DARK_COLORS = {
  blue: '#60A5FA',
  blueDark: '#081226',
  orange: '#FB923C',
  gold: '#FBBF24',
  navy: '#050B18',
  navySoft: '#111B31',
  bcpOrange: '#FF8A1F',
  slate: '#070D1A',
  white: '#101827',
  whiteText: '#FFFFFF',
  surface: '#101827',
  surfaceAlt: '#162033',
  input: '#172033',
  track: '#253149',
  divider: '#22304A',
  blueSoft: 'rgba(59,130,246,0.14)',
  orangeSoft: 'rgba(249,115,22,0.16)',
  emeraldSoft: 'rgba(16,185,129,0.14)',
  amberSoft: 'rgba(245,158,11,0.14)',
  roseSoft: 'rgba(244,63,94,0.14)',
  emerald: '#34D399',
  amber: '#FBBF24',
  rose: '#F43F5E',
  text: '#F8FAFC',
  subtext: '#B6C3D4',
  muted: '#7D8EA3',
  border: '#26344A',
  glassBorder: 'rgba(255, 255, 255, 0.08)'
};

export const DESIGN = {
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  }
};

const normalizeApiUrl = (url: string) => url.trim().replace(/\/$/, '');

const isLocalhostUrl = (url: string) => (
  url.includes('localhost') || url.includes('127.0.0.1') || url.includes('10.0.2.2')
);

const safeDecodeUri = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const unwrapNestedBundlerUrl = (value: string) => {
  let current = value;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const decoded = safeDecodeUri(current);
    const match = decoded.match(/[?&]url=([^&]+)/);
    if (!match) {
      return decoded;
    }
    current = match[1];
  }

  return safeDecodeUri(current);
};

const extractHostFromUri = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  const unwrapped = unwrapNestedBundlerUrl(raw);
  const withoutScheme = unwrapped.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const hostPort = (withoutScheme.split(/[/?#]/)[0].split('@').pop() || '').trim();
  const host = hostPort.startsWith('[')
    ? hostPort.slice(1).split(']')[0]
    : hostPort.split(':')[0];

  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return null;
  }

  return host;
};

const getBundlerHostApiUrl = () => {
  const constants = Constants as any;
  const hostSources = [
    constants.expoConfig?.hostUri,
    constants.expoConfig?.debuggerHost,
    constants.expoGoConfig?.hostUri,
    constants.expoGoConfig?.debuggerHost,
    constants.manifest2?.extra?.expoClient?.hostUri,
    constants.manifest2?.extra?.expoClient?.debuggerHost,
    constants.manifest?.hostUri,
    constants.manifest?.debuggerHost,
    constants.linkingUri
  ];

  for (const source of hostSources) {
    const host = extractHostFromUri(source);
    if (host) {
      return `http://${host}:3001/api`;
    }
  }

  return null;
};

const getConfiguredApiUrls = () => {
  const constants = Constants as any;
  return [
    process.env.EXPO_PUBLIC_API_URL,
    constants.expoConfig?.extra?.apiUrl,
    constants.expoGoConfig?.extra?.apiUrl,
    constants.manifest2?.extra?.expoClient?.extra?.apiUrl,
    constants.manifest?.extra?.apiUrl
  ]
    .map((url) => String(url || '').trim())
    .filter(Boolean);
};

const getApiUrl = () => {
  const configuredApiUrls = getConfiguredApiUrls().map(normalizeApiUrl);
  const publicApiUrl = configuredApiUrls.find((url) => !isLocalhostUrl(url));
  if (publicApiUrl) {
    return publicApiUrl;
  }

  const bundlerHostApiUrl = getBundlerHostApiUrl();
  if (bundlerHostApiUrl) {
    return bundlerHostApiUrl;
  }

  const localConfiguredApiUrl = configuredApiUrls[0];
  const isDevelopmentRuntime = typeof __DEV__ !== 'undefined' && __DEV__;
  if (!isDevelopmentRuntime) {
    return localConfiguredApiUrl || '';
  }

  if (localConfiguredApiUrl) {
    return localConfiguredApiUrl;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001/api';
  }

  return 'http://localhost:3001/api';
};

export const API_URL = getApiUrl();

export const CONVENIOS = [
  { label: 'Seleccionar Convenio...', value: '' },
  { label: 'Policia Nacional del Peru', value: 'PNP' },
  { label: 'Ejercito del Peru', value: 'EJERCITO' },
  { label: 'Marina de Guerra', value: 'MARINA' },
  { label: 'Fuerza Aerea', value: 'FAP' },
];
