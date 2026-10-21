/**
 * Keeps the normalized company row and the two persisted company-state maps in
 * sync. Several older screens still read companies[0], while state saves use
 * companyProfile and companyPreferences.
 */
export function withCompanySettingsSnapshot(previous,companyId,profile={},preferences={},companyOverrides={}){
  const nextProfile={
    ...(previous?.companyProfile||{}),
    ...profile,
    settings:{...(previous?.companyProfile?.settings||{}),...(profile?.settings||{}),...preferences}
  };
  const nextPreferences={...(previous?.companyPreferences||{}),...preferences};
  const companies=(previous?.companies||[]).map(row=>String(row.id)===String(companyId)?{
    ...row,
    ...nextProfile,
    ...companyOverrides,
    id:row.id,
    settings:{...(row.settings||{}),...(nextProfile.settings||{}),...nextPreferences}
  }:row);
  return {...previous,companyProfile:nextProfile,companyPreferences:nextPreferences,companies};
}
