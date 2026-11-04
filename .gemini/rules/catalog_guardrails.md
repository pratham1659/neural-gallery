# Catalog & Security Guardrails

## Zero Demo / Mock Data
- Every number and list item across `Sidebar.tsx`, `Header.tsx`, `TimelineView.tsx`, `ExplorerView.tsx`, `PlacesMapView.tsx`, and `PeopleView.tsx` must be derived from real-time database queries via `/api/stats` and other endpoints.
- Never use hardcoded counts, fake trips, or placeholder badges.

## Vault Lockdown & macOS Touch ID
- Locking the vault via `🔒` or `⌘L` must persist in `sessionStorage` and completely block gallery access.
- Access requires either macOS Touch ID biometric verification (`PublicKeyCredential` platform authenticator) or the valid master passcode.
- Under no circumstance should clicking an unlock button without verification unlock the vault.
