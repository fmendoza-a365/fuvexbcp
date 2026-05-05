const appJson = require('./app.json');

const normalizeApiUrl = (url) => String(url || '').trim().replace(/\/$/, '');

const isLocalApiUrl = (url) => (
  url.includes('localhost') || url.includes('127.0.0.1') || url.includes('10.0.2.2')
);

const getNgrokApiUrl = () => {
  const domain = String(process.env.FUVEX_NGROK_DOMAIN || '').trim();
  if (!domain) {
    return '';
  }

  const cleanDomain = domain
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');

  return cleanDomain ? `https://${cleanDomain}/api` : '';
};

const getConfiguredApiUrl = () => {
  const explicitApiUrl = normalizeApiUrl(
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.FUVEX_MOBILE_API_URL ||
    getNgrokApiUrl()
  );

  if (explicitApiUrl) {
    return explicitApiUrl;
  }

  const appJsonApiUrl = normalizeApiUrl(appJson.expo.extra?.apiUrl);
  return appJsonApiUrl && !isLocalApiUrl(appJsonApiUrl) ? appJsonApiUrl : '';
};

module.exports = ({ config }) => ({
  ...config,
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    apiUrl: getConfiguredApiUrl()
  }
});
