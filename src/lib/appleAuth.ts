import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { isDemoMode } from "./supabase";

// The only file that talks to Sign in with Apple. It asks iOS for a credential
// and hands back what Supabase needs to trust it; accountApi does the rest.

export interface AppleCredential {
  identityToken: string; // signed by Apple; Supabase verifies it
  rawNonce: string; // Apple signs its hash into the token, Supabase checks the original
  givenName: string | null; // Apple shares the name only the first time an Apple ID is used with the app
  familyName: string | null;
}

const CANCELED_CODE = "ERR_REQUEST_CANCELED";

// Sign in with Apple exists on iPhone only (iOS 13+); the demo has no real accounts.
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios" || isDemoMode) return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch (e) {
    console.warn("[appleAuth] availability check failed", e);
    return false;
  }
}

// Shows Apple's sheet. Resolves null when the user closes it; throws on a real failure.
export async function requestAppleCredential(): Promise<AppleCredential | null> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) throw new Error("Apple returned no identity token");
    console.log("[appleAuth] credential received");
    return {
      identityToken: credential.identityToken,
      rawNonce,
      givenName: credential.fullName?.givenName ?? null,
      familyName: credential.fullName?.familyName ?? null,
    };
  } catch (e) {
    if ((e as { code?: string }).code === CANCELED_CODE) {
      console.log("[appleAuth] canceled by the user");
      return null;
    }
    throw e;
  }
}
