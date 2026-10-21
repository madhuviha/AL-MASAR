const companyPages = new Set([
  'dashboard', 'map', 'playback', 'vehicles', 'drivers', 'reports', 'alerts',
  'geofences', 'poi', 'parking', 'profile', 'maintenance', 'language',
  'sensors', 'users', 'settings'
]);

const adminPages = new Set([
  'dashboard', 'news', 'map', 'companies', 'vehicles', 'events', 'emailTemplates',
  'smsTemplates', 'mapIcons', 'vehicleIcons', 'expenseTypes', 'privacyPolicy',
  'gpsActivation', 'apnConfig', 'diemRates', 'commandTemplates',
  'emailSettings', 'settings', 'billingGateway', 'trackingPorts', 'language',
  'blockedIps', 'tools', 'plugins', 'sensorGroups', 'smsGateway', 'billing',
  'logs', 'unregisteredVehicles', 'reportLogs', 'diagnostics', 'backups',
  'database', 'profile', 'support', 'master'
]);

export function readClientPage(kind, pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const prefix = kind === 'admin' ? '/admin' : '';
  if (kind === 'admin' && path !== prefix && !path.startsWith(prefix + '/')) return 'dashboard';
  let segment = path.slice(prefix.length).replace(/^\//, '');
  if (!segment) return 'dashboard';
  if (kind === 'admin' && segment === 'users') segment = 'companies';
  const pages = kind === 'admin' ? adminPages : companyPages;
  return pages.has(segment) ? segment : 'dashboard';
}

export function clientPagePath(kind, page) {
  const pages = kind === 'admin' ? adminPages : companyPages;
  const valid = pages.has(page) ? page : 'dashboard';
  const segment = kind === 'admin' && valid === 'companies' ? 'users' : valid;
  const prefix = kind === 'admin' ? '/admin' : '';
  return segment === 'dashboard' ? (prefix || '/') + (prefix ? '/' : '') : `${prefix}/${segment}`;
}

export function pushClientPage(kind, page) {
  const path = clientPagePath(kind, page);
  if (window.location.pathname !== path) window.history.pushState({page}, '', path);
}
