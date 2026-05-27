/**
 * ESLint configuration for the EazePay monorepo.
 *
 * Why classic .eslintrc.cjs and not the new flat config:
 *   • Next.js 14 (apps/partner-portal) still pulls in ESLint 8 — we
 *     pinned `eslint: ^8.57.0` to stay compatible, and ESLint 9's flat
 *     config requires bumping. Jumping the major also breaks several
 *     plugin pins. Revisit when Next.js officially supports ESLint 9.
 *
 * Rule philosophy (day-1 install): lenient first, strict later.
 *   • Errors only for things that will crash or cause subtle React bugs
 *     (react-hooks/rules-of-hooks).
 *   • Warnings for everything else so the engineer sees the lint surface
 *     without the build going red. Bump categories to 'error' once the
 *     warning backlog is cleared.
 *
 * Things deliberately NOT enabled:
 *   • @typescript-eslint/no-floating-promises — requires `parserOptions.project`
 *     (type-aware linting). That doubles lint time and pulls every tsconfig
 *     into ESLint's project graph. Flag as a follow-up; tracked in
 *     HANDOFF.md → Engineer day-1 follow-ups.
 *   • eslint-config-next — partner-portal-specific; better added as a
 *     directory-scoped override later than dragged across every package.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  settings: {
    react: { version: '18.3' },
  },
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    // Type-aware rule; needs parserOptions.project to function. Off by
    // default — see file header for the follow-up.
    '@typescript-eslint/no-floating-promises': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    /*
     * Branded-money guard.
     *
     * The `Cents` and `BasisPoints` types in `@eazepay/shared-types`
     * carry runtime invariants (non-negative integer cents; bps in
     * 0..10_000) that are enforced ONLY by the `toCents(n)` /
     * `toBps(n)` constructors. A bare `as Cents` / `as BasisPoints`
     * cast bypasses those checks and re-introduces exactly the class
     * of bug branding exists to close (cents/bps confusion, fractional
     * cents leaking into ledger writes, negative cents in a column the
     * schema treats as a magnitude).
     *
     * The rule below catches the literal text. It is intentionally a
     * syntactic check — TypeScript will allow a structural `number`
     * to be passed into a branded slot once and only once when it
     * flows through a `toX()` call. Every other coercion site must
     * stop at code review.
     */
    'no-restricted-syntax': [
      'error',
      {
        selector: "TSAsExpression[typeAnnotation.typeName.name='Cents']",
        message:
          "Don't cast to `Cents` directly. Use `toCents(n)` from @eazepay/shared-types — it enforces the non-negative integer invariant. If you genuinely need to bypass (e.g. a schema default), prefix the line with `// eslint-disable-next-line no-restricted-syntax` and explain why.",
      },
      {
        selector: "TSAsExpression[typeAnnotation.typeName.name='BasisPoints']",
        message:
          "Don't cast to `BasisPoints` directly. Use `toBps(n)` from @eazepay/shared-types — it enforces the 0..10_000 range invariant.",
      },
      {
        selector: "TSTypeAssertion[typeAnnotation.typeName.name='Cents']",
        message: "Don't use `<Cents>x` casts. Use `toCents(n)` from @eazepay/shared-types.",
      },
      {
        selector: "TSTypeAssertion[typeAnnotation.typeName.name='BasisPoints']",
        message: "Don't use `<BasisPoints>x` casts. Use `toBps(n)` from @eazepay/shared-types.",
      },
    ],
  },
  overrides: [
    {
      // Test files get a wider net — Vitest specs frequently use `any`
      // for partial mocks and `console.log` for ad-hoc instrumentation.
      files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
    {
      /*
       * The money module itself is the ONE place `as Cents` / `as BasisPoints`
       * is legitimate — the `toCents` / `toBps` constructors and the zod
       * boundary schemas brand their checked output here, and nowhere
       * else gets to mint a branded value.
       */
      files: ['libs/shared-types/src/money.ts'],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },
    {
      /*
       * Drizzle column defaults need a literal-shaped value that matches
       * the column's `$type<...>` brand. The `0 as Cents` /
       * `0 as BasisPoints` casts here are the only sanctioned uses of
       * the unbranded constant `0` flowing into a money column — the
       * runtime value is always 0, so the invariant (cents ≥ 0, bps in
       * 0..10_000) holds trivially and a `toCents(0)` constructor call
       * would still produce the same result.
       */
      files: ['apps/partner-portal/lib/db/schema.ts'],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },
  ],
};
