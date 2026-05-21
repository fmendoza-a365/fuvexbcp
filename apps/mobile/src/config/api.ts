const PRODUCTION_API_URL = 'https://bcp.fuvexa365.com/api';

export const normalizeMobileApiUrl = (_value: string) => PRODUCTION_API_URL;

let runtimeApiUrl = PRODUCTION_API_URL;

export const getDefaultApiUrl = () => PRODUCTION_API_URL;

export const getRuntimeApiUrl = () => runtimeApiUrl;

export const setRuntimeApiUrl = (_url: string) => {
  runtimeApiUrl = PRODUCTION_API_URL;
  return runtimeApiUrl;
};

export const loadSavedApiUrl = async () => {
  runtimeApiUrl = PRODUCTION_API_URL;
  return runtimeApiUrl;
};

export const saveApiUrl = async (_url: string) => {
  runtimeApiUrl = PRODUCTION_API_URL;
  return runtimeApiUrl;
};

export const clearSavedApiUrl = async () => {
  runtimeApiUrl = PRODUCTION_API_URL;
  return runtimeApiUrl;
};
