/**
 * Native macOS WebAuthn / Touch ID and Passcode Authentication Helper.
 */

export const getStoredPasscode = (): string => {
  return localStorage.getItem("neural_vault_passcode") || "1234";
};

export const setStoredPasscode = (code: string): void => {
  localStorage.setItem("neural_vault_passcode", code.trim());
};

export const verifyPasscode = (input: string): boolean => {
  return input.trim() === getStoredPasscode();
};

export const isTouchIDAvailable = async (): Promise<boolean> => {
  if (
    typeof window !== "undefined" &&
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function"
  ) {
    try {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }
  return false;
};

export const authenticateWithTouchID = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      return { success: false, error: "Touch ID / WebAuthn is not supported in this browser." };
    }

    const available = await isTouchIDAvailable();
    if (!available) {
      return { success: false, error: "macOS Touch ID sensor is not available. Please use passcode." };
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const savedCredId = localStorage.getItem("neural_vault_touch_id_cred");
    const rpId = window.location.hostname || "localhost";

    // 1. Try asserting existing Touch ID credential
    if (savedCredId) {
      try {
        const rawCredId = Uint8Array.from(atob(savedCredId), (c) => c.charCodeAt(0));
        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge,
            rpId,
            allowCredentials: [
              {
                id: rawCredId,
                type: "public-key",
                transports: ["internal"],
              },
            ],
            userVerification: "required", // macOS prompts Touch ID or Mac password
            timeout: 60000,
          },
        });

        if (assertion) {
          return { success: true };
        }
      } catch (err: any) {
        if (err.name === "NotAllowedError") {
          return { success: false, error: "Touch ID was canceled or timed out." };
        }
      }
    }

    // 2. Register/Create platform Touch ID credential if not yet stored
    const userId = new Uint8Array([78, 101, 117, 114, 97, 108, 86, 97]);
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: "Neural Gallery Vault",
          id: rpId,
        },
        user: {
          id: userId,
          name: "owner@neuralgallery.mac",
          displayName: "Neural Gallery Owner",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },  // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Directs to macOS Touch ID sensor!
          userVerification: "required",
          requireResidentKey: false,
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (credential && credential.rawId) {
      const base64Id = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      localStorage.setItem("neural_vault_touch_id_cred", base64Id);
      return { success: true };
    }

    return { success: false, error: "Touch ID could not verify your identity." };
  } catch (err: any) {
    if (err.name === "NotAllowedError") {
      return { success: false, error: "Touch ID was canceled or not recognized." };
    }
    return { success: false, error: err.message || "Touch ID authentication failed." };
  }
};
