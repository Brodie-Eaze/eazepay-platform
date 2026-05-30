/**
 * Test-only stub for the `server-only` marker package.
 *
 * `server-only` is a build-time guard: importing it from a module that
 * ends up in a client bundle is a hard error. It has no runtime behaviour
 * and is not installed as a dependency in this workspace. Under the
 * vitest (node) runner there is no client/server boundary, so route
 * handlers + server libs (e.g. lib/consumer-consent-server.ts) that do
 * `import 'server-only'` would otherwise fail to resolve.
 *
 * The vitest config aliases the `server-only` specifier to this empty
 * module so those specs load. Production builds still resolve the real
 * package via Next.js and keep the guard intact.
 */
export {};
