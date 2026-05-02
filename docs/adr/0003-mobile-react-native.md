# ADR-0003: React Native + TypeScript for iOS and Android

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Brodie (founder/CTO)

## Context

Consumers are the system of record. We need both iOS and Android apps with feature parity, deep biometrics, secure-enclave key storage, KYC document capture, push, and App Attest / Play Integrity for fraud signal — all on a small team budget.

## Decision

- React Native (RN CLI or Expo bare) with TypeScript.
- Native bridges where required: Keychain / KeyStore, biometrics, secure refresh-token storage, App Attest / Play Integrity, ML Kit / Vision for document capture, push (APNs/FCM), Apple Pay / Google Pay (V2).
- Shared logic with web via TypeScript libs (`@eazepay/shared-types`, `@eazepay/api-client`).

## Alternatives considered

- **Native Swift + Kotlin:** highest fidelity but ~2× build cost and ~2× hiring at our scale.
- **Flutter:** rejected — Dart ecosystem has thinner US-fintech library coverage (Plaid, Persona, Stripe SDKs are all JS/Swift/Kotlin first).

## Consequences

- We must budget native engineering capacity from day one (biometrics + secure enclave + attestation are where RN's "single codebase" claim breaks).
- App Store / Play Store release cadence is weekly with phased rollout (1% → 10% → 100%).
- Force-upgrade path required for security fixes via remote config.

## Compliance / risk notes

PII never lives in JS-side storage — all sensitive material persists via native Keychain/KeyStore with biometric gates. No JS-side crypto for auth or money.
