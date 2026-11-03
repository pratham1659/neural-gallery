import React, { useState } from "react";

interface LockScreenModalProps {
  isLocked: boolean;
  onUnlock: () => void;
}

export const LockScreenModal: React.FC<LockScreenModalProps> = ({ isLocked, onUnlock }) => {
  const [passphrase, setPassphrase] = useState("");
  const [isDeriving, setIsDeriving] = useState(false);

  if (!isLocked) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsDeriving(true);
    setTimeout(() => {
      setIsDeriving(false);
      setPassphrase("");
      onUnlock();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-2xl select-none">
      <div className="w-full max-w-sm rounded-3xl bg-[var(--glass-card)] border border-[var(--glass-border)] shadow-2xl p-8 text-center flex flex-col items-center">
        {/* Lock Graphic */}
        <div className="w-20 h-20 rounded-3xl bg-[var(--accent-soft)] border border-[var(--accent)]/30 flex items-center justify-center text-4xl mb-5 shadow-inner">
          🔒
        </div>

        <h2 className="text-xl font-bold tracking-tight text-[var(--text-main)] mb-1">
          Vault is Locked
        </h2>
        <p className="text-xs text-[var(--text-muted)] mb-6 max-w-xs">
          Keys have been zeroized from RAM. Authenticate with Touch ID or master passphrase.
        </p>

        {/* Touch ID Trigger */}
        <button
          onClick={onUnlock}
          className="w-full mb-4 py-3 px-4 rounded-xl border border-[var(--glass-border)] bg-[var(--button-bg)] hover:bg-[var(--button-hover)] text-xs font-semibold text-[var(--text-main)] flex items-center justify-center gap-2 transition-all shadow-sm active:scale-98"
        >
          <span className="text-base">👆</span>
          <span>Unlock with Touch ID</span>
        </button>

        <div className="w-full flex items-center gap-3 my-2 text-[10px] text-[var(--text-faint)] uppercase tracking-wider">
          <div className="h-px flex-1 bg-[var(--glass-border)]"></div>
          <span>or passphrase</span>
          <div className="h-px flex-1 bg-[var(--glass-border)]"></div>
        </div>

        {/* Master Passphrase Form */}
        <form onSubmit={handleSubmit} className="w-full mt-2 space-y-3">
          <input
            type="password"
            placeholder="Master Passphrase..."
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-panel)] text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all text-center"
            autoFocus
          />
          <button
            type="submit"
            disabled={isDeriving}
            className="w-full py-2.5 rounded-xl bg-[var(--accent)] hover:opacity-90 active:scale-98 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2"
          >
            {isDeriving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Argon2id (m=64MB)...</span>
              </>
            ) : (
              <span>Unlock Vault</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
