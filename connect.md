# Neural Gallery — Mobile P2P Sync & Ingest Connection Guide

Neural Gallery provides peer-to-peer encrypted mobile photo ingestion directly into your Mac's secure vault without third-party cloud photo storage.

This guide lists **all available connection methods**, their requirements, and step-by-step instructions.

---

## Quick Reference: Active Server Details

| Property | Value |
| :--- | :--- |
| **Web UI (Mac Browser)** | [http://127.0.0.1:8765/](http://127.0.0.1:8765/) |
| **Universal Tunnel URL** | `https://flower-teaches-cast-drive.trycloudflare.com/sync?pin=849201` |
| **Local Wi-Fi IP** | `http://192.168.29.186:8765/sync?pin=849201` |
| **mDNS Mac Hostname** | `http://Prathams-MacBook-Air.local:8765/sync?pin=849201` |
| **Active SAS PIN** | `849 201` |
| **Backend Status** | Bound to `0.0.0.0:8765` (HTTP/1.1 with Keep-Alive & CORS) |

---

## Comparison of Connection Methods

| Method | Best For | Internet Required? | Speed | Ease of Setup |
| :--- | :--- | :--- | :--- | :--- |
| **[Method 1: Universal Tunnel](#method-1-universal-tunnel-recommended)** | **Any Wi-Fi, 4G/5G, Hotspot** | Yes | ⚡ Fast (Cloudflare Edge) | ⭐⭐⭐⭐⭐ (Scan & Go) |
| **[Method 2: Direct Local IP](#method-2-direct-local-ip-wi-fi)** | Home Wi-Fi without AP isolation | No | ⚡⚡ Very Fast | ⭐⭐⭐ (Needs same Wi-Fi) |
| **[Method 3: Mac Name (mDNS)](#method-3-mac-name-mdns--bonjour)** | Apple iPhones / iPads | No | ⚡⚡ Very Fast | ⭐⭐⭐⭐ (Zero IP config) |
| **[Method 4: Mac-Hosted Hotspot](#method-4-mac-hosted-wi-fi-hotspot-zero-ap-isolation)** | Travel, outdoors, strict routers | No | ⚡⚡⚡ High Speed | ⭐⭐⭐ (Turn on in Mac Settings) |
| **[Method 5: USB Cable Tethering](#method-5-usb-cable-tethering-maximum-speed)** | Huge imports (thousands of 4K photos) | No | ⚡⚡⚡⚡ Cable Speed (Gigabit) | ⭐⭐⭐⭐ (Plug & Tap) |
| **[Method 6: Manual PIN Pairing](#method-6-manual-pin-pairing)** | Browser typing without QR camera | Depends on method | Same as above | ⭐⭐⭐ (Type 6 digits) |

---

## Method 1: Universal Tunnel (Recommended)

> **Why this is recommended:** Bypasses router AP isolation, cellular carrier firewalls, and guest network restrictions. Works on any Wi-Fi or mobile data network (4G/5G).
>
> 🔒 **Privacy & Air-Gap Control:** Includes an instant **ON/OFF switch** right in the modal. When switched OFF, the background Cloudflare tunnel is completely terminated, ensuring 0% internet egress.
>
> 🛡️ **Anti-Hack Dynamic OTP:** While waiting for a device to connect, the 6-digit security OTP automatically expires and rotates every 60 seconds with a countdown timer, preventing old links or brute-force attempts from gaining access.

### Steps:
1. Open Neural Gallery on your Mac: [http://127.0.0.1:8765](http://127.0.0.1:8765).
2. Click the **P2P Mobile Sync** button (top right header icon 📡).
3. Select the **🌐 Universal** tab.
4. If the tunnel is currently OFF, toggle the switch to **ON**.
5. Open your phone camera or QR code scanner and scan the QR code.
6. The phone automatically validates the dynamic SAS PIN and opens the mobile photo upload interface.
7. Tap **"Select Photos to Ingest"**, choose your photos, and watch them stream directly into your Mac's `~/Pictures/Neural Gallery Imports` folder.
8. Once finished, toggle the switch to **OFF** anytime for complete air-gapped isolation!

---

## Method 2: Direct Local IP (Wi-Fi)

> **When to use:** When you are connected to a trusted private home Wi-Fi and want 100% offline local network transmission without internet routing.

### Steps:
1. In Neural Gallery on your Mac, click the **📡 Sync** button.
2. Select the **📶 Local IP** tab.
3. Verify both your Mac and your phone are on the **exact same Wi-Fi SSID**.
4. Scan the QR code or type this address into Chrome or Safari on your phone:
   ```text
   http://192.168.29.186:8765/sync?pin=849201
   ```
5. If the site loads immediately, your Wi-Fi router allows local peer-to-peer traffic.
6. Select photos and start uploading.

### Why Method 2 might fail on your Wi-Fi:
- **JioFiber / Airtel AP Isolation:** Home fiber routers enable "Access Point Isolation" by default to prevent devices from communicating with one another. If you get `ERR_CONNECTION_TIMED_OUT` or `ERR_TOO_MANY_RETRIES`, your router is actively dropping inter-device packets.
- **Band Mismatch:** Your Mac is on 5 GHz and your phone is on 2.4 GHz (or a Guest network). Ensure both devices connect to the same band.
- **Fix:** Either switch to **Method 1**, disable AP Isolation in your router settings (`http://192.168.29.1`), or use **Method 4 / 5**.

---

## Method 3: Mac Name (mDNS / Bonjour)

> **When to use:** Primarily for Apple ecosystem devices (iPhone and iPad) that automatically resolve `.local` addresses across the local network without needing static IP addresses.

### Steps:
1. In the Sync modal, click the **🏷️ Mac Name** tab.
2. Ensure your iPhone is on the same Wi-Fi network as the Mac.
3. Scan the QR code or open Safari on your iPhone and go to:
   ```text
   http://Prathams-MacBook-Air.local:8765/sync?pin=849201
   ```
4. Safari resolves the Bonjour mDNS hostname directly to your Mac.

---

## Method 4: Mac-Hosted Wi-Fi Hotspot (Zero AP Isolation)

> **When to use:** When your home router blocks local traffic (AP isolation) or when you are traveling and have no Wi-Fi, but want a 100% private offline network.

### Steps:
1. On your Mac, open **System Settings → General → Sharing**.
2. Click the `(i)` info button next to **Internet Sharing**.
3. Under **To devices using:**, check **Wi-Fi**.
4. Click **Wi-Fi Options…** and set:
   - Network Name: e.g. `Mac-Gallery-Hotspot`
   - Security: `WPA2/WPA3 Personal`
   - Password: your choice
5. Turn the **Internet Sharing** toggle **ON** and click **Start**.
6. On your phone, connect to `Mac-Gallery-Hotspot`.
7. Because your Mac is the root Wi-Fi gateway (typically `192.168.2.1`), **AP isolation is completely bypassed**.
8. Open your phone browser and go to:
   ```text
   http://192.168.2.1:8765/sync?pin=849201
   ```

---

## Method 5: USB Cable Tethering (Maximum Speed)

> **When to use:** When importing hundreds or thousands of photos, RAW files, or 4K videos at maximum physical hardware speed without wireless interference.

### Steps for iPhone / iPad:
1. Connect your iPhone to your Mac using a USB-C or Lightning cable.
2. Tap **"Trust This Computer"** on your iPhone screen and enter your passcode.
3. On your iPhone, go to **Settings → Personal Hotspot**.
4. Turn on **Allow Others to Join**, and select **USB Only** when prompted.
5. In macOS System Settings → Network, verify the **iPhone USB** connection is green.
6. Open your iPhone's Safari and connect to the sync page.

### Steps for Android:
1. Connect your Android phone to your Mac with a USB-C cable.
2. On your phone, go to **Settings → Network & Internet (or Connections) → Hotspot & Tethering**.
3. Toggle on **USB Tethering**.
4. On your phone browser, open the Mac's gateway address (usually `http://192.168.42.x:8765/sync` or the local IP shown in the modal).

---

## Method 6: Manual PIN Pairing

> **When to use:** If your phone camera cannot read the QR code or you prefer typing the URL manually.

### Steps:
1. Open the URL in your mobile browser without the query parameter:
   - Universal: `https://flower-teaches-cast-drive.trycloudflare.com/sync`
   - Local: `http://192.168.29.186:8765/sync`
2. The mobile page will display a security prompt: **"Enter 6-Digit PIN"**.
3. Look at your Mac screen inside the **P2P Mobile Sync** modal for the **Security SAS PIN** (e.g. `849 201`).
4. Type `849201` on your phone and tap **Authorize Device**.
5. Once authenticated, your phone is permanently paired with the Mac until rotated or unpaired.

---

## Troubleshooting Guide

| Issue / Error | Likely Cause | Solution |
| :--- | :--- | :--- |
| `ERR_TOO_MANY_RETRIES` | Router AP isolation or mobile hotspot loopback firewall blocking direct requests | Switch to **Method 1 (Universal Tunnel)** or **Method 4 (Mac Hotspot)**. |
| `This site can't be reached` / `ERR_CONNECTION_TIMED_OUT` | Mac IP changed or phone is on mobile data instead of Wi-Fi | If using Local IP, check current IP with `ifconfig` or use **Method 1**. |
| `ERR_NAME_NOT_RESOLVED` | Android device does not support `.local` mDNS domains | On Android, use **Method 1 (Universal)** or **Method 2 (Local IP)** instead of `.local`. |
| "PIN Expired / Invalid" | PIN was rotated on Mac | Look at the modal on your Mac and type the newly generated PIN, or rescan the QR code. |
| Phone uploaded photos but they don't appear in gallery | Background indexing in progress | Click **Index Folder** in the Mac UI and select `~/Pictures/Neural Gallery Imports`. |
