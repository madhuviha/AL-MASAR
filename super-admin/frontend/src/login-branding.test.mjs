import test from "node:test";
import assert from "node:assert/strict";
import { mergeLoginBranding, validatePublicLoginBranding } from "./login-branding.mjs";

test("mergeLoginBranding saves login fields without overwriting unrelated drafts", () => {
  const saved = { trackerHost: "gps.example.com", loginLogoData: "old", notes: "keep" };
  const draft = { trackerHost: "draft.example.com", loginLogoData: "new", loginBackgroundData: "data:image/webp;base64,abc", templateColor: "#123456", whatsappNumber: "+97455555555" };
  const result = mergeLoginBranding(saved, draft);
  assert.equal(result.trackerHost, "gps.example.com");
  assert.equal(result.notes, "keep");
  assert.equal(result.loginLogoData, "new");
  assert.equal(result.loginBackgroundData, "data:image/webp;base64,abc");
  assert.equal(result.templateColor, "#123456");
  assert.equal(result.whatsappNumber, "+97455555555");
});

test("validatePublicLoginBranding accepts the saved logo and background URL", () => {
  assert.equal(validatePublicLoginBranding(
    { loginLogoData: "data:image/webp;base64,logo", loginBackgroundData: "data:image/webp;base64,bg", templateColor: "#0aa65f", loginTextColor: "#0b2748", loginBackgroundColor: "#f4f8fb", loginPanelColor: "#ffffff", welcomeText: "Welcome to MASAR TRACK", bottomText: "2026 © INVIHA Technologies", loginPanelTransparency: 18, googlePlayUrl: "", appStoreUrl: "" },
    { logoData: "data:image/webp;base64,logo", loginBackgroundUrl: "/inviha-api/api/public/login-background", templateColor: "#0aa65f", loginTextColor: "#0b2748", loginBackgroundColor: "#f4f8fb", loginPanelColor: "#ffffff", welcomeText: "Welcome to MASAR TRACK", bottomText: "2026 © INVIHA Technologies", loginPanelTransparency: 18, googlePlayUrl: "", appStoreUrl: "" }
  ), true);
});

test("validatePublicLoginBranding accepts the default logo fallback", () => {
  assert.equal(validatePublicLoginBranding(
    { loginLogoData: "", brandLogoData: "data:image/png;base64,default" },
    { logoData: "data:image/png;base64,default", loginBackgroundUrl: "" }
  ), true);
});

test("validatePublicLoginBranding rejects missing public assets", () => {
  assert.throws(() => validatePublicLoginBranding(
    { loginLogoData: "data:image/png;base64,logo", loginBackgroundData: "data:image/webp;base64,bg" },
    { logoData: "", loginBackgroundUrl: "" }
  ), /did not return the saved logo/);
});

test("validatePublicLoginBranding verifies asset removal", () => {
  assert.throws(() => validatePublicLoginBranding(
    { loginLogoData: "", brandLogoData: "", loginBackgroundData: "" },
    { logoData: "stale", loginBackgroundUrl: "" }
  ), /still returns a logo/);
});

test("validatePublicLoginBranding rejects stale public colours and links", () => {
  assert.throws(() => validatePublicLoginBranding(
    { templateColor: "#0aa65f", googlePlayUrl: "https://play.example/new" },
    { logoData: "", loginBackgroundUrl: "", templateColor: "#111111", googlePlayUrl: "https://play.example/old" }
  ), /different templateColor/);
});
