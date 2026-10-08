# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build              # tsc -p tsconfig.build.json -> build/
npm test                   # typecheck (src + tests) and unit tests
npm run test:unit          # unit tests only (node:test)
npm run test:coverage      # unit tests with coverage (--experimental-test-coverage)

# single file / single test by name (flags must come before the file args, so
# `npm run test:unit -- --test-name-pattern=…` does NOT filter)
node --import ./test/unit/hooks.ts --test test/unit/proxy.test.ts
node --import ./test/unit/hooks.ts --test --test-name-pattern='falls back to the target' 'test/unit/**/*.test.ts'
npm run test:integration   # clean, build + pack lib, build app per SDK version, run under Viceroy
SDK_VERSIONS="^3,^4" npm run test:integration   # other SDK versions or ranges
node --test test/integration/context.test.ts    # re-run against existing builds (same SDK_VERSIONS)
```

There is no linter, and no test framework dependency: tests use `node:test` + `node:assert/strict` and run `.ts` directly via Node's type stripping (Node ≥ 22.18; `.nvmrc` is 24). Integration tests require the Fastly CLI (`fastly`) on `PATH`, or `FASTLY_CLI` set, and network access (each SDK version is installed from npm).

## Architecture

`@fastly/compute-js-context` is a small ESM library for Fastly Compute JS apps. It turns the runtime's named resources into lazy, memoized lookup objects. Source files import each other with `.js` extensions (`nodenext` resolution).

- `src/util.ts`: `loadOptionalStringMap(getter)` is the core primitive. It returns a `Proxy` with only `get` and `has` traps. The first access to a string key calls `getter`, and the result is cached per key, including `undefined`. `in` is true only when the value is not `undefined`. Symbol keys are ignored. The proxy is deliberately not enumerable.
- `src/{acls,backends,config-stores,kv-stores,loggers,secret-stores}.ts`: each wraps one `fastly:*` API (`Acl.open`, `Backend.fromName`, `new ConfigStore(name)`, …) in `loadOptionalStringMap`. These APIs throw for unprovisioned names, so a throw maps to `undefined`. `env.ts` passes `env(name)` through unchanged.
- `src/context.ts`: `createContext()` returns a module-level frozen singleton with `ACLS`, `BACKENDS`, `CONFIG_STORES`, `ENV`, `KV_STORES`, `LOGGERS`, `SECRET_STORES`.
- `src/proxy.ts`: `buildContextProxy` and `buildContextProxyOn` map user-defined binding keys to context entries using strings like `'Backend'` or `'Backend:actual-name'` (the resource type before the colon, and an optional name that otherwise defaults to the key). The mapping table `BindingStringToContextKeyMapping` and the type-level `BindingStringToResourceInstanceTypeMapping` must stay in sync when a resource type is added. `buildContextProxyOn` falls back to the target object when a binding is undefined, or when the key is not a binding.

Adding a resource type means touching: a new `src/<type>.ts`, `context.ts`, both mapping tables in `proxy.ts`, a fake in `test/unit/fakes/`, the `resourceMaps` table in `test/unit/resources.test.ts`, and the integration app (`app/index.js`, `app/fastly.toml`, `app/type-assertions.ts`) and its expected report.

## SDK compatibility

The peer dependency is `@fastly/js-compute` `^3.33.0 || ^4.0.0`. 3.32.x is excluded because its `types/index.d.ts` doesn't load `fastly:acl`, which the published `.d.ts` imports. The devDependency `@fastly/js-compute` is the current major (v4) and is only used for building and unit tests. The integration tests install each SDK version listed in `test/integration/sdk-versions.mjs` separately (exact versions: minimum 3.x, latest 3.x, latest 4.x; override with `SDK_VERSIONS`).

## Testing

- **TypeScript configs:** `tsconfig.json` covers `src/` only, with `types: ["@fastly/js-compute"]` and no Node types, because the library runs in Compute and not Node. `test/tsconfig.json` adds Node types for test code. `tsconfig.build.json` emits `build/`. `verbatimModuleSyntax` and `erasableSyntaxOnly` are on because Node runs the sources by stripping types: type-only imports must use `import type` / `{ type X }`, and enums, namespaces and parameter properties are not allowed.
- **Unit tests** (`test/unit/`): `test/unit/hooks.ts`, loaded with `node --import`, registers module resolve hooks that map `fastly:<name>` to `test/unit/fakes/<name>.ts`, and map `./foo.js` imports to `./foo.ts`. Fakes read from a shared registry. Use `provision(kind, ...names)` and `registry.env` to declare what exists, and `registry.calls` / `callsFor()` to assert laziness and caching. Opening an unprovisioned name throws, like the real runtime does.
- **Singleton state:** `createContext()` is a module singleton, and `node:test` runs each test file in its own process, so all tests in a file share one context. `beforeEach` calls `resetRegistry()`, which clears provisioned resources and recorded calls but not the context's per-name cache. Each test therefore uses resource names that no other test in the same file uses. The first test in `context.test.ts` must stay first, because it checks that creating the context opens nothing. Don't try to reload modules with cache-busting query strings: Node's coverage counts each URL separately, which makes coverage wrong.
- **Integration tests** (`test/integration/`): `build-apps.mjs` packs the library and, for each SDK version, copies `app/` to `.work/sdk-<version>/` (gitignored), installs the tarball and that SDK there, type-checks `app/type-assertions.ts` against that SDK (it catches the published types breaking or degrading to `any`; `@ts-expect-error` lines assert that something must *not* compile), and compiles `app/index.js`, which imports `@fastly/compute-js-context` as a user would, to `bin/main.wasm`. `context.test.ts` serves each build with `fastly compute serve` from its work dir on a free port, in its own process group so Viceroy is killed on teardown, and compares each report section to `expectedReport`. Every SDK version must produce the same report. Viceroy output is saved to `.work/sdk-<version>/serve.log`. In `build-apps.mjs`, only `npm pack` has its stdout captured (for `--json`); npm install, tsc and js-compute print directly, and a failing command ends the script with a `Failed: <command> (in <dir>)` line and that command's exit status. Bump the pinned versions in `sdk-versions.mjs` when new SDK versions ship.
- **CI:** `.github/workflows/ci.yaml` runs `npm test` and `npm run test:integration` (pinned SDK versions) on pull requests and on pushes to `main`. `.github/workflows/sdk-latest.yaml` runs the integration tests weekly (and on demand) against the latest `^3`/`^4`; when a new SDK release passes there, bump the pinned list.
