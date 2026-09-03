# CelebrityPass — Google Play / Production Release Kit

Generated: 2026-09-02. Final status: signed Android build produced; web build green.

---

## 1. IMPORTANT — Hosting requirement (read first)

The `app-release.aab`/`app-release.apk` are **signed and installable NOW**, but the app loads the **hosted web application** in a WebView (it is a server-rendered Next.js app with a database — it cannot run fully inside an APK). The APK is a secure shell that opens `NEXT_PUBLIC_APP_URL`.

- Until the web app is deployed over HTTPS at a real domain, the APK will show an error page.
- **To make the app functional:** deploy this Next.js app to a host (VPS = Node + Prisma + SQLite; or Vercel/Railway etc.), set the required env vars, and set `NEXT_PUBLIC_APP_URL` to that HTTPS domain, then rebuild the AAB (`npm run build:android` below).
- `capacitor.config.ts` currently uses the placeholder `https://celebritypass.app`. Change it via the `NEXT_PUBLIC_APP_URL` env var before the final Play build.

---

## 2. What was built & verified

| Item | Result |
|------|--------|
| App identity | `com.celebritypass.app` (applicationId + namespace), label "CelebrityPass" |
| Version | versionCode 1, versionName "1.0.0" |
| Android SDK | compileSdk 36, targetSdk 36 (meets current Play requirement), minSdk 24 |
| Permissions | INTERNET only — no camera/location/contacts. Reviewed & minimal |
| Signing | Signed with `C:\keystore\CelebrityPass-keystore.jks` (verified cert SHA-256 `6b4e9853...17`) |
| Artifacts | `android/app/build/outputs/bundle/release/app-release.aab` (2.99 MB) — upload to Play; `.../apk/release/app-release.apk` (3.14 MB) — sideload/test |
| Icons | Custom "CP" gradient icon: legacy mipmaps + adaptive (dark violet bg + white monogram) + monochrome, all densities |
| Splash | Branded dark-violet "CP" splash, all densities/orientations |
| Web manifest | `public/manifest.webmanifest` + meta tags/theme-color installed |
| Web build | `tsc` 0, `eslint` 0, `next build` exit 0 (BUILD_ID generated) |

## 3. Security & payment fixes applied (this pass)

- **COOKIE_SECRET is now fail-closed** — production rejects login if unset (no more `fancard-dev-secret` forge path). Rotated `.env` to a real random 96-char hex.
- **ADMIN_PASSWORD fail-closed** — admin login disabled if unset in production (no committed default). Rotated `.env` to a strong random password.
- **Session cookies now `secure` in production** (HTTPS-only).
- **Rate limiting** on admin login (10/min/IP) and fan login (20/min/IP).
- **Payment provider fail-closed** — an unknown/real `PAYMENT_PROVIDER` throws instead of silently mocking (prevents free cards).
- **Bank-transfer proof validation** server-side: positive amount, image-only MIME, ≤2.5 MB data URI.
- **`/api/events/sources` GET now admin-gated** (was leaking credential env-var names publicly).
- **Login form hint removed** (no longer points attackers to `.env`).

+5 (from prior): no admin self-escalation (role-less admin cookie), bank-transfer stays `PENDING_VERIFICATION` until admin approval only, ATM Card honestly returns 409 (no fake gateway).

## 4. npm audit (6 vulns) — accepted, DEV-ONLY, do not auto-fix

All 6 are in **build/CLI tooling** that never ships in the runtime:
- `deepmerge-ts -> @prisma/config -> prisma` (3 high) — Prisma CLI only.
- `xcode -> @capacitor/cli` + `uuid` (3 moderate) — Capacitor iOS build tooling only.

The `npm audit fix --force` would **downgrade prisma 6.19.3->6.12.0 and capacitor 8.5.1->8.4.3** (breaking). Not worth risking a working build for dev-only tooling. Revisit when upstream patched versions release.

## 5. Google Play console — data to enter

**Store listing**
- Title: **CelebrityPass**
- Short description: "Multi-celebrity fan cards, event tickets, concerts, shows, VIP & meet-and-greet experiences — all on one platform."
- Full description: two paragraphs (feature/engagement), include fan cards, events, tickets, VIP experiences; "CelebrityPass is an independent platform; events are ticketed by official providers when available."

**Categorization:** Category Entertainment, Tags: Fan / Events. Target audience: 13+.

**Data Safety (honest, accurate)** — Complete the form:
- **Data collected & shared:** Account info (name, email, country, password hash) — collected, NOT sold. Financial data CAVEAT — see note below. User IDs. App diagnostics not collected.
- **Core functionality and payment:** `data:image` bank-transfer proof is collected and stored locally for admin manual verification (not shared with third parties).
- Cookies/sign-in required.
- No third-party ad SDKs. No location. No device IDs.

> Note: The app currently has **no real card gateway**; bank-transfer is manual-verified. If/when you add a real processor, declare its data handling in Data Safety.

**App content:** No ads → set "Contains ads: No". Unrated content OK. Policies: no user-generated content beyond fan profiles / payment-proof receipts.

**Marketing:** Screenshots (phone, 7.5–16:9): create from localhost in a 1080×1920 viewport — home, celebrity profile, event/tickets, checkout, legal. Icon 512×512 (use `public/icons/icon-512.png`). Feature graphic 1024×500 (brand gradient + "CelebrityPass"). 4 screenshots minimum for release.

## 6. Manual steps you must do (cannot be automated)

1. **Deploy the web app** over HTTPS and set `NEXT_PUBLIC_APP_URL` to the real domain (see section 1).
2. **Upload `app-release.aab`** to Play Console → your test track first (internal testing), then production.
3. **Keep `C:\keystore\CelebrityPass-keystore.jks` safe forever** — losing it means you can never update the app under the same identity. Back it up offline.
4. **Play signing:** enable Google Play App Signing (deterministic) and upload the provided keystore cert so both your Gradle keys and Play key-doc sign. (Play signs the AAB; your keystore is the upload key.)
5. Re-verify the new admin password is stored in your password manager (it is appended to the private `C:\keystore\CelebrityPass-credentials.txt`).
6. Privacy/Terms/Payments/Contact legal pages already exist and are linked in the footer.

## 7. Rebuild commands (after changing the app URL / code)

```
# set the live domain, then sign-and-build
# uses NEXT_PUBLIC_APP_URL from the environment / capacitor.config.ts
npx cap sync android
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"; $env:ANDROID_HOME="C:\Users\HP\AppData\Local\Android\Sdk"
./gradlew bundleRelease        # -> android/app/build/outputs/bundle/release/app-release.aab
```

Keystore props are read from `android/keystore.properties` (gitignored, points to `C:\keystore\...`). Real secrets never committed.