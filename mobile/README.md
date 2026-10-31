# Suru Collection — Android and iOS app

A native React Native / Expo customer shopping app for Suru Collection. The mobile app connects to the same Supabase project used by https://suru.com.np. It does not create a second catalogue, customer database, order system or payment database.

## Current implementation

- Live catalogue from `public.products`, `public.product_images` and `public.product_sizes`.
- Category browsing, featured products, product search and product details.
- Size / colour selection, stock display and a persistent local shopping bag.
- Existing Supabase customer authentication and email OTP registration.
- Existing customer profile RPC and saved-address registration flow.
- NCM branch lookup and delivery-rate Edge Function.
- Existing `place_order` RPC, server-side coupon validation and Fonepay QR checkout for full Fonepay / COD advance.
- Fonepay payment status verification through the existing Edge Function.
- Customer order list and order status refresh.

## Run locally

Use Node.js 22.13 or newer for Expo SDK 58.

```bash
cd mobile
cp .env.example .env
npm install
npx expo install --fix
npx expo-doctor@latest
npx expo start
```

Open the Expo Go / development build QR code, or press `a` for Android emulator / `i` for iOS simulator where available.

The environment variables are the Supabase project URL and the public publishable key only. Never place a Supabase service-role key, Fonepay private key, NCM token, or any other server secret in the mobile app.

## Build Android and iOS

Install and configure EAS CLI, sign into the Expo account, then run:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
eas build --platform ios --profile ios-simulator
```

The Android `preview` profile produces an installable APK for device testing. The `ios-simulator` profile produces a simulator build, not an installable iPhone IPA. To install on a physical iPhone before App Store release, use an ad hoc iOS build with the iPhone registered on your Apple Developer account; TestFlight/App Store distribution also requires Apple Developer Program membership. For store builds, use `--profile production`. Google Play Console and Apple Developer / App Store Connect credentials are required for publishing. The Android package and iOS bundle identifier in `app.json` are proposed identifiers and must be checked for availability before store registration.

## Synchronisation model

- The database remains the single source of truth.
- Product, price, active/featured status, images, sizes, colours and stock are read from the existing Supabase tables.
- The app listens for Supabase Realtime changes to product, image, variant and coupon tables, and refreshes the catalogue whenever it returns to the foreground.
- Orders are read from the same customer-owned order records.
- Website changes to database records can appear in the app without publishing a new app version.
- Website code / layout / business-logic changes do not automatically rewrite the installed native app. Those changes need a matching mobile code change and a new app release.
- Supabase Realtime publication must include the catalogue tables; see `supabase-realtime.sql`.

## Not included in this first mobile foundation

The website remains fully operational and unchanged. The first native pass intentionally does not claim full parity for:
- Native CyberSource card checkout (the existing website card flow uses a browser SDK).
- Native preorder lifecycle, advance/balance actions and preorder-specific screens.
- Google OAuth / passkey login deep-link configuration.
- Full invoice PDF, cancellation / return / exchange, product review submission and push notifications.

These need dedicated native implementations and end-to-end testing before production release. The current checkout must be tested with Fonepay's live merchant configuration and NCM branch/rate responses on a real device before release.
