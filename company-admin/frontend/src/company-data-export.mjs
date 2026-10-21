const sameCompany=(row,companyId)=>String(row?.companyId)===String(companyId);

/**
 * Builds the Company Admin download without account credentials or records
 * belonging to another tenant. The timestamp is injectable for deterministic
 * tests.
 */
export function buildCompanyExport(store,company,createdAt=new Date().toISOString()){
  const companyId=company?.id;
  const rows=key=>(Array.isArray(store?.[key])?store[key]:[]).filter(row=>sameCompany(row,companyId));
  return {
    format:'inviha-company-backup',
    version:1,
    createdAt,
    company,
    vehicles:rows('vehicles'),
    drivers:rows('drivers'),
    geofences:rows('localGeofences'),
    maintenance:rows('maintenance'),
    sensorConfigs:rows('sensorConfigs'),
    alertRules:rows('alertRules')
  };
}
