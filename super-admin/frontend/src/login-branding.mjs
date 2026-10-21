export const LOGIN_BRANDING_KEYS = [
  "brandLogoData",
  "loginLogoData",
  "loginBackgroundData",
  "templateColor",
  "loginTextColor",
  "loginBackgroundColor",
  "loginPanelColor",
  "welcomeText",
  "bottomText",
  "loginPanelTransparency",
  "googlePlayUrl",
  "appStoreUrl",
  "whatsappNumber"
];

export function mergeLoginBranding(savedSettings = {}, draftSettings = {}) {
  const next = { ...savedSettings };
  for (const key of LOGIN_BRANDING_KEYS) next[key] = draftSettings[key];
  return next;
}

export function validatePublicLoginBranding(settings = {}, publicBranding = {}) {
  const expectedLogo = String(settings.loginLogoData || settings.brandLogoData || "").trim();
  const publicLogo = String(publicBranding.logoData || "").trim();
  const expectsBackground = String(settings.loginBackgroundData || "").startsWith("data:image/");
  const publicBackground = String(publicBranding.loginBackgroundUrl || publicBranding.loginBackgroundData || "").trim();

  if (expectedLogo && !publicLogo) {
    throw new Error("The public login page did not return the saved logo.");
  }
  if (expectedLogo && publicLogo !== expectedLogo) {
    throw new Error("The public login page returned a different logo.");
  }
  if (!expectedLogo && publicLogo) {
    throw new Error("The public login page still returns a logo that was removed.");
  }
  if (expectsBackground && !publicBackground) {
    throw new Error("The public login page did not return the saved background.");
  }
  if (!expectsBackground && publicBackground) {
    throw new Error("The public login page still returns a background that was removed.");
  }
  const checks = [
    ["collapsedLogoData", settings.collapsedLogoData || "", publicBranding.collapsedLogoData || ""],
    ["faviconData", settings.faviconData || "", publicBranding.faviconData || ""],
    ["templateColor", settings.templateColor || "#0aa65f", publicBranding.templateColor],
    ["loginTextColor", settings.loginTextColor || "#0b2748", publicBranding.loginTextColor],
    ["loginBackgroundColor", settings.loginBackgroundColor || "#f4f8fb", publicBranding.loginBackgroundColor],
    ["loginPanelColor", settings.loginPanelColor || "#ffffff", publicBranding.loginPanelColor],
    ["welcomeText", settings.welcomeText || "Welcome to MASAR TRACK", publicBranding.welcomeText],
    ["bottomText", settings.bottomText || "2026 © INVIHA Technologies", publicBranding.bottomText],
    ["loginPanelTransparency", Math.max(0, Math.min(70, Number(settings.loginPanelTransparency ?? 18))), Number(publicBranding.loginPanelTransparency)],
    ["portalTitle", settings.portalTitle || "Fleet Management", publicBranding.portalTitle],
    ["companyBrowserTitle", settings.companyBrowserTitle || "Fleet Management", publicBranding.companyBrowserTitle],
    ["googlePlayUrl", settings.googlePlayUrl || "", publicBranding.googlePlayUrl || ""],
    ["appStoreUrl", settings.appStoreUrl || "", publicBranding.appStoreUrl || ""],
    ["whatsappNumber", settings.whatsappNumber || "", publicBranding.whatsappNumber || ""]
  ];
  for (const [key, expected, actual] of checks) {
    if (Object.hasOwn(settings, key) && expected !== actual) throw new Error(`The public login page returned a different ${key}.`);
  }
  return true;
}
