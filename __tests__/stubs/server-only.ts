/**
 * No-op stand-in for the `server-only` package under vitest.
 *
 * The real package throws on import outside a React Server Component, which is
 * exactly what makes it useful in the app - it turns a server module leaking
 * into a client bundle into a build error. Under vitest there is no server/
 * client graph, so it throws on any import and takes the whole suite file with
 * it: adding the guard to lib/apps.server.ts silently stopped 16 tests from
 * running until this alias was added.
 */
export {}
