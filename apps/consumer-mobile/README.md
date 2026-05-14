# @eazepay/consumer-mobile

EazePay consumer mobile app (React Native + Expo).

## What it does

The native iOS + Android app a consumer uses to apply for financing,
view active loans, manage repayments, link bank accounts, and receive
push notifications about offers and reminders. Mirrors the
`consumer-web` flow but is the long-term home for the consumer
relationship after the first transaction.

## Stack

- Expo 51 SDK / React Native 0.74
- React Navigation 6 (native stack + bottom tabs)
- Zustand for client state
- `expo-secure-store` for token storage
- TypeScript, ESM
- Calls `@eazepay/api` via `@eazepay/api-client`

## Run locally

```bash
pnpm --filter @eazepay/consumer-mobile start
# then `i` for iOS simulator, `a` for Android emulator
```

Or boot directly into the simulator:

```bash
pnpm --filter @eazepay/consumer-mobile ios
pnpm --filter @eazepay/consumer-mobile android
```

## Routes / surface

Stack + bottom-tab navigation under `src/`:

- `screens/` — Home, Apply, Offers, Loans, Profile, Settings
- `navigation/` — root stack + tab definitions
- `state/` — Zustand stores (session, application draft)
- `hooks/` — API hooks wrapping `@eazepay/api-client`
- `native/` — secure-store + push token plumbing

## Environment

No `.env.example` shipped — Expo reads from `app.json`'s `extra` block
and from `EXPO_PUBLIC_*` variables at build time. The only required
value today is the API base URL, set via `EXPO_PUBLIC_API_URL`. Add
new public values prefixed `EXPO_PUBLIC_` and document them in
`app.json` rather than dotenv.

## Testing

```bash
pnpm --filter @eazepay/consumer-mobile typecheck
```

## Deploy

EAS Build → App Store + Google Play. Submission gating depends on
the production AWS account + bank-partner contract; until then,
TestFlight + Internal Testing is the distribution path.

## Related

- `@eazepay/api` — backend over HTTPS via `@eazepay/api-client`
- `@eazepay/ui` — shared design tokens (web + native palettes)
- `apps/consumer-web` — feature parity reference for early flows
