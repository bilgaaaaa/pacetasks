import { Linking } from "react-native";

// The public pages the app links to. They live in the bilgaaaaa/PaceTasksWebsite
// repository, served by GitHub Pages; the same addresses go into the App Store listing.
const SITE_URL = "https://bilgaaaaa.github.io/PaceTasksWebsite";

export const PRIVACY_POLICY_URL = `${SITE_URL}/privacy.html`;
export const SUPPORT_URL = `${SITE_URL}/support.html`;

// Opens a web page in the phone's browser. A failure is logged, not thrown: a
// link that won't open must never break the screen it sits on.
export async function openExternalLink(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch (e) {
    console.warn(`[links] could not open ${url}`, e);
  }
}
