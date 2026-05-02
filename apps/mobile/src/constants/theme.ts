import { Platform } from 'react-native';

export const COLORS = {
  blue: '#002A8D',
  orange: '#FF7800',
  slate: '#F8FAFF',
  white: '#FFFFFF',
  emerald: '#10B981',
  amber: '#F59E0B',
  rose: '#EF4444',
  text: '#1E293B',
  subtext: '#64748B',
  border: '#E2E8F0'
};

export const DARK_COLORS = {
  blue: '#3b82f6',
  orange: '#FF7800',
  slate: '#0a0a0a', // Pure black
  white: '#171717', // Carbon card
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  text: '#f5f5f5', // White smoke text
  subtext: '#a3a3a3', // Neutral gray
  border: '#262626' // Steel border
};



// Para BlueStacks/Android emulator usa 10.0.2.2 (alias del host)
// Para dispositivo físico en misma red, usar IP local de la PC
const getApiUrl = () => {
  // Si hay variable de entorno, usarla
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // BlueStacks y Android emulators: 10.0.2.2 apunta al host
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001/api';
  }
  return 'http://localhost:3001/api';
};

export const API_URL = getApiUrl();

export const CONVENIOS = [
  { label: 'Seleccionar Convenio...', value: '' },
  { label: 'Policia Nacional del Perú', value: 'PNP' },
  { label: 'Ejercito del Perú', value: 'EJERCITO' },
  { label: 'Marina de Guerra', value: 'MARINA' },
  { label: 'Fuerza Aérea', value: 'FAP' },
];
