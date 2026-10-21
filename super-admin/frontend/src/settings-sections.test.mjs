import test from "node:test";
import assert from "node:assert/strict";
import {
  SETTINGS_SECTION_FIELDS,
  createSettingsPatch,
  settingsSectionChangedOnServer,
  validateMapSettings,
  validateSecuritySettings,
  validateTrackingSettings
} from "./settings-sections.mjs";

test("createSettingsPatch sends only the selected section allowlist", () => {
  const draft = { serverName: "MASAR", offlineMinutes: 30, untrackedMinutes: 10, notes: "do not send", portalTitle: "do not send" };
  const patch = createSettingsPatch("tracking", draft);
  assert.deepEqual(Object.keys(patch), SETTINGS_SECTION_FIELDS.tracking);
  assert.equal(patch.serverName, "MASAR");
  assert.equal("notes" in patch, false);
  assert.equal("portalTitle" in patch, false);
});

test("tracking validation checks only duration relationship", () => {
  assert.equal(validateTrackingSettings({ untrackedMinutes: 15, offlineMinutes: 300 }), "");
  assert.match(validateTrackingSettings({ untrackedMinutes: 15, offlineMinutes: 15 }), /longer/);
});

test("conflict check retries unrelated changes but stops same-section overwrites", () => {
  const loaded = { portalTitle: "Fleet", supportEmail: "old@example.com" };
  assert.equal(settingsSectionChangedOnServer({ portalTitle: "MASAR" }, loaded, { portalTitle: "Fleet", supportEmail: "new@example.com" }), false);
  assert.equal(settingsSectionChangedOnServer({ portalTitle: "MASAR" }, loaded, { portalTitle: "Another Admin" }), true);
});

test("map validation checks map availability, geocoder and tile placeholders", () => {
  const good = { enabledMaps: { openStreetMap: true, openMapTiles: true }, mapZoom: 11, mapCenterLatitude: 25, mapCenterLongitude: 51, geocoderPrimary: "nominatim", geocoderFallback: "none", openMapTilesUrl: "https://tiles/{z}/{x}/{y}.png" };
  assert.equal(validateMapSettings(good, ["openStreetMap", "openMapTiles"]), "");
  assert.match(validateMapSettings({ ...good, openMapTilesUrl: "https://tiles/static.png" }, ["openStreetMap", "openMapTiles"]), /placeholders/);
  assert.match(validateMapSettings({ ...good, geocoderFallback: "nominatim" }, ["openStreetMap"]), /different fallback/);
});

test("CAPTCHA secret is required when enabling, but may stay blank for an existing provider", () => {
  const settings = { expiryNotifyBeforeDays: 10, expiryNotifyAfterDays: 10, cameraImageRetentionDays: 30, backupRetention: 8, captchaProvider: "Cloudflare Turnstile", captchaSiteKey: "site", captchaSecretKey: "" };
  assert.match(validateSecuritySettings(settings, { captchaProvider: "None" }, new Set(["captchaSiteKey", "captchaSecretKey"])), /secret key/);
  assert.match(validateSecuritySettings({ ...settings, captchaProvider: "Google reCAPTCHA", captchaSecretKey: "old-provider-secret" }, { captchaProvider: "Cloudflare Turnstile" }, new Set(["captchaProvider"])), /new CAPTCHA/);
  assert.equal(validateSecuritySettings(settings, { captchaProvider: "Cloudflare Turnstile" }), "");
});

test("security validation rejects invalid backup retention", () => {
  assert.match(validateSecuritySettings({ expiryNotifyBeforeDays: 10, expiryNotifyAfterDays: 10, cameraImageRetentionDays: 30, backupRetention: 0, captchaProvider: "None" }), /at least one/);
});
