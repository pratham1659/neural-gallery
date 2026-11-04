import React, { useState, useEffect, useRef } from "react";

interface LockScreenModalProps {
  isLocked: boolean;
  onUnlock: () => void;
}

export const LockScreenModal: React.FC<LockScreenModalProps> = ({ isLocked, onUnlock }) => {
  const [passcode, setPasscode] = useState("");
  const [isVerifyingTouchID, setIsVerifyingTouchID] = useState(false);
  const [isVerifyingPasscode, setIsVerifyingPasscode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isShake, setIsShake] = useState(false);
  const [isChangingPasscode, setIsChangingPasscode] = useState(false);
  const [currentPasscodeForChange, setCurrentPasscodeForChange] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmNewPasscode, setConfirmNewPasscode] = useState("");
  const [passcodeChangeSuccess, setPasscodeChangeSuccess] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const hasAutoPromptedRef = useRef(false);

  const getStoredPasscode = () => {
    return localStorage.getItem("neural_vault_passcode") || "1234";
  };

  const triggerShake = () => {
    setIsShake(true);
    setTimeout(() => setIsShake(false), 500);
  };

  // Perform macOS Touch ID authentication via WebAuthn platform authenticator
  const handleTouchIDAuth = async () => {
    setErrorMsg(null);
    setIsVerifyingTouchID(true);

    try {
      if (typeof window === "undefined" || !window.PublicKeyCredential) {
        setErrorMsg("Touch ID / WebAuthn is not supported in this browser.");
        setIsVerifyingTouchID(false);
        return;
      }

      // Check if platform authenticator (Touch ID) is supported
      const hasPlatformAuth =
        await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!hasPlatformAuth) {
        setErrorMsg("macOS Touch ID sensor is not available. Please use passcode.");
        setIsVerifyingTouchID(false);
        return;
      }

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const savedCredId = localStorage.getItem("neural_vault_touch_id_cred");
      const rpId = window.location.hostname || "localhost";

      let authenticated = false;

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
              userVerification: "required", // Requests Touch ID or macOS system passcode
              timeout: 60000,
            },
          });

          if (assertion) {
            authenticated = true;
          }
        } catch (err: any) {
          if (err.name === "NotAllowedError") {
            setErrorMsg("Touch ID verification was canceled or timed out.");
            triggerShake();
            setIsVerifyingTouchID(false);
            return;
          }
          // If stored credential was invalidated or expired, continue to create/register
        }
      }

      // 2. If no valid credential yet or assertion failed due to missing registration, register via platform Touch ID
      if (!authenticated) {
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
          authenticated = true;
        }
      }

      setIsVerifyingTouchID(false);

      if (authenticated) {
        setPasscode("");
        setErrorMsg(null);
        onUnlock();
      } else {
        setErrorMsg("Touch ID could not verify your identity.");
        triggerShake();
      }
    } catch (err: any) {
      setIsVerifyingTouchID(false);
      if (err.name === "NotAllowedError") {
        setErrorMsg("Touch ID was canceled or not recognized.");
      } else {
        setErrorMsg(err.message || "Touch ID authentication failed.");
      }
      triggerShake();
    }
  };

  // Passcode Verification
  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const stored = getStoredPasscode();

    if (!passcode.trim()) {
      setErrorMsg("Please enter your passcode or authenticate with Touch ID.");
      triggerShake();
      return;
    }

    setIsVerifyingPasscode(true);
    setTimeout(() => {
      setIsVerifyingPasscode(false);
      if (passcode.trim() === stored) {
        setPasscode("");
        setErrorMsg(null);
        onUnlock();
      } else {
        setErrorMsg("Incorrect passcode. Access denied.");
        triggerShake();
      }
    }, 250);
  };

  // Handle Changing Passcode
  const handleChangePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const stored = getStoredPasscode();

    if (currentPasscodeForChange.trim() !== stored) {
      setErrorMsg("Current passcode does not match.");
      triggerShake();
      return;
    }

    if (!newPasscode || newPasscode.length < 4) {
      setErrorMsg("New passcode must be at least 4 characters.");
      triggerShake();
      return;
    }

    if (newPasscode !== confirmNewPasscode) {
      setErrorMsg("New passcodes do not match.");
      triggerShake();
      return;
    }

    localStorage.setItem("neural_vault_passcode", newPasscode);
    setPasscodeChangeSuccess(true);
    setErrorMsg(null);
    setCurrentPasscodeForChange("");
    setNewPasscode("");
    setConfirmNewPasscode("");
    setTimeout(() => {
      setPasscodeChangeSuccess(false);
      setIsChangingPasscode(false);
    }, 1500);
  };

  // Intercept keyboard when locked (prevent Esc or background hotkeys)
  useEffect(() => {
    if (!isLocked) {
      hasAutoPromptedRef.current = false;
      return;
    }

    const preventEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", preventEsc, { capture: true });

    // Focus passcode input
    inputRef.current?.focus();

    // Auto-prompt Touch ID on first lock presentation
    if (!hasAutoPromptedRef.current) {
      hasAutoPromptedRef.current = true;
      const timer = setTimeout(() => {
        handleTouchIDAuth();
      }, 300);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("keydown", preventEsc, { capture: true });
      };
    }

    return () => window.removeEventListener("keydown", preventEsc, { capture: true });
  }, [isLocked]);

  if (!isLocked) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/92 backdrop-blur-3xl select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`w-full max-w-sm rounded-3xl bg-[var(--glass-card)] border border-[var(--glass-border)] shadow-2xl p-7 text-center flex flex-col items-center transition-transform ${
          isShake ? "animate-shake border-rose-500/60 ring-2 ring-rose-500/20" : ""
        }`}
      >
        {/* Animated Lock Badge */}
        <div className="w-18 h-18 rounded-3xl bg-gradient-to-b from-blue-500/20 to-indigo-600/10 border border-blue-500/30 flex items-center justify-center text-4xl mb-4 shadow-inner ring-4 ring-blue-500/10">
          🔒
        </div>

        <h2 className="text-xl font-bold tracking-tight text-[var(--text-main)] mb-1">
          Vault is Locked
        </h2>
        <p className="text-xs text-[var(--text-muted)] mb-5 max-w-xs leading-relaxed">
          Access to this gallery is protected. Use macOS Touch ID or enter your passcode to unlock.
        </p>

        {/* Error / Alert Banner */}
        {errorMsg && (
          <div className="w-full mb-4 px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-medium text-center animate-fadeIn">
            ⚠️ {errorMsg}
          </div>
        )}

        {passcodeChangeSuccess && (
          <div className="w-full mb-4 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold text-center animate-fadeIn">
            ✓ Passcode successfully updated!
          </div>
        )}

        {!isChangingPasscode ? (
          <>
            {/* Native macOS Touch ID Button */}
            <button
              type="button"
              onClick={handleTouchIDAuth}
              disabled={isVerifyingTouchID}
              className="w-full mb-4 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white text-xs font-semibold flex items-center justify-center gap-2.5 shadow-lg shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-70"
            >
              {isVerifyingTouchID ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Authenticating with Touch ID...</span>
                </>
              ) : (
                <>
                  <span className="text-base">👆</span>
                  <span>Unlock with macOS Touch ID</span>
                </>
              )}
            </button>

            {/* Divider */}
            <div className="w-full flex items-center gap-3 my-2 text-[10px] text-[var(--text-faint)] uppercase tracking-wider font-semibold">
              <div className="h-px flex-1 bg-[var(--glass-border)]"></div>
              <span>or enter passcode</span>
              <div className="h-px flex-1 bg-[var(--glass-border)]"></div>
            </div>

            {/* Passcode Form */}
            <form onSubmit={handlePasscodeSubmit} className="w-full mt-2 space-y-3">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="password"
                  placeholder="Enter passcode (Default: 1234)"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--button-bg)] text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all text-center tracking-widest font-mono"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isVerifyingPasscode}
                className="w-full py-2.5 rounded-xl border border-[var(--button-border)] bg-[var(--button-bg)] hover:bg-[var(--button-hover)] active:scale-[0.98] text-[var(--text-main)] text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isVerifyingPasscode ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-[var(--text-main)]/30 border-t-[var(--text-main)] rounded-full animate-spin"></span>
                    <span>Verifying Passcode...</span>
                  </>
                ) : (
                  <span>Unlock with Passcode</span>
                )}
              </button>
            </form>

            {/* Footer options: Passcode info & Change Passcode toggle */}
            <div className="w-full mt-5 pt-3 border-t border-[var(--glass-border)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>Default passcode: <span className="font-mono font-semibold text-[var(--text-secondary)]">1234</span></span>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setIsChangingPasscode(true);
                }}
                className="text-[var(--accent)] hover:underline font-medium"
              >
                Change Passcode
              </button>
            </div>
          </>
        ) : (
          /* Change Passcode View */
          <form onSubmit={handleChangePasscodeSubmit} className="w-full space-y-3 mt-1">
            <div className="text-left">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Current Passcode
              </label>
              <input
                type="password"
                placeholder="Current Passcode"
                value={currentPasscodeForChange}
                onChange={(e) => setCurrentPasscodeForChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--glass-border)] bg-[var(--button-bg)] text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)] font-mono"
                autoFocus
              />
            </div>

            <div className="text-left">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                New Passcode (min 4 characters)
              </label>
              <input
                type="password"
                placeholder="New Passcode"
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--glass-border)] bg-[var(--button-bg)] text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)] font-mono"
              />
            </div>

            <div className="text-left">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Confirm New Passcode
              </label>
              <input
                type="password"
                placeholder="Confirm New Passcode"
                value={confirmNewPasscode}
                onChange={(e) => setConfirmNewPasscode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--glass-border)] bg-[var(--button-bg)] text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)] font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsChangingPasscode(false);
                  setErrorMsg(null);
                }}
                className="flex-1 py-2 rounded-xl border border-[var(--button-border)] bg-[var(--button-bg)] hover:bg-[var(--button-hover)] text-xs font-semibold text-[var(--text-main)]"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-[var(--accent)] hover:opacity-90 text-white text-xs font-semibold shadow-md"
              >
                Save New Passcode
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
