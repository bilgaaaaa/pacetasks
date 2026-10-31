import { Linking } from "react-native";

// The public pages the app links to. They are the files in docs/, served by
// GitHub Pages; the same addresses go into the App Store listing.
export const SITE_URL = "https://bilgaaaaa.github.io/pacetasks";

export const PRIVACY_POLICY_URL = `${SITE_URL}/privacy.html`;
export const SUPPORT_URL = `${SITE_URL}/support.html`;

// Apple's standard licence agreement (EULA), which App Store subscriptions must link to.
export const TERMS_OF_USE_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
// Where iPhone users see, change or cancel their App Store subscriptions.
export const MANAGE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

// Opens PaceTasks' page in the phone's Settings, where notifications are allowed or blocked.
export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (e) {
    console.warn("[links] could not open the app's settings", e);
  }
}

// Opens a web page in the phone's browser. A failure is logged, not thrown: a
// link that won't open must never break the screen it sits on.
export async function openExternalLink(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch (e) {
    console.warn(`[links] could not open ${url}`, e);
  }
}
