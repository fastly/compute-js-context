# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build              # tsc -p tsconfig.build.json -> build/
npm test                   # typecheck (src + tests) and unit tests
npm run test:unit          # unit tests only (vitest)
npx vitest run test/unit/proxy.test.ts        # single file
npx vitest run -t 'falls back to the target'  # single test by name
npm run test:coverage      # unit tests with coverage
npm run test:integration   # build lib, compile Wasm per SDK major, run under Viceroy
```

There is no linter. Integration tests require the Fastly CLI (`fastly`) on `PATH`, or `FASTLY_CLI` set.

## Architecture

`@fastly/compute-js-context` is a small ESM library for Fastly Compute JS apps. It turns the runtime's named resources into lazy, memoized lookup objects. Source files import each other with `.js` extensions (`nodenext` resolution).

- `src/util.ts`: `loadOptionalStringMap(getter)` is the core primitive. It returns a `Proxy` with only `get` and `has` traps. The first access to a string key calls `getter`, and the result is cached per key, including `undefined`. `in` is true only when the value is not `undefined`. Symbol keys are ignored. The proxy is deliberately not enumerable.
- `src/{acls,backends,config-stores,kv-stores,loggers,secret-stores}.ts`: each wraps one `fastly:*` API (`Acl.open`, `Backend.fromName`, `new ConfigStore(name)`, …) in `loadOptionalStringMap`. These APIs throw for unprovisioned names, so a throw maps to `undefined`. `env.ts` passes `env(name)` through unchanged.
- `src/context.ts`: `createContext()` returns a module-level frozen singleton with `ACLS`, `BACKENDS`, `CONFIG_STORES`, `ENV`, `KV_STORES`, `LOGGERS`, `SECRET_STORES`.
- `src/proxy.ts`: `buildContextProxy` and `buildContextProxyOn` map user-defined binding keys to context entries using strings like `'Backend'` or `'Backend:actual-name'` (the resource type before the colon, and an optional name that otherwise defaults to the key). The mapping table `BindingStringToContextKeyMapping` and the type-level `BindingStringToResourceInstanceTypeMapping` must stay in sync when a resource type is added. `buildContextProxyOn` falls back to the target object when a binding is undefined, or when the key is not a binding.

Adding a resource type means touching: a new `src/<type>.ts`, `context.ts`, both mapping tables in `proxy.ts`, a fake in `test/unit/fakes/`, the `resourceMaps` table in `test/unit/resources.test.ts`, and the integration app, its `fastly.toml` and its expected report.

## SDK compatibility

The peer dependency is `@fastly/js-compute` `^3.32.0 || ^4.0.0`. The devDependency `@fastly/js-compute` is the current major (v4). Older majors are installed under npm aliases (`js-compute-v3`) and listed in `test/integration/sdk-versions.mjs`, so the integration tests build and run the same app against each supported major.

## Testing

- **TypeScript configs:** `tsconfig.json` covers `src/` only, with `types: ["@fastly/js-compute"]` and no Node types, because the library runs in Compute and not Node. `test/tsconfig.json` adds Node types for test code. `tsconfig.build.json` emits `build/`.
- **Unit tests** (`test/unit/`): `vitest.config.ts` aliases `fastly:<name>` to `test/unit/fakes/<name>.ts`. Fakes read from a shared registry. Use `provision(kind, ...names)` and `registry.env` to declare what exists, and `registry.calls` / `callsFor()` to assert laziness and caching. Opening an unprovisioned name throws, like the real runtime does.
- **Fresh module state:** because `createContext()` is a module singleton, context and proxy tests use `loadFresh()` from `test/unit/helpers/load.ts`. It calls `vi.resetModules()` and re-imports both the registry and the library, so they share one registry instance. Don't combine a statically imported registry with `loadFresh()`: they'll be different instances.
- **Integration tests** (`test/integration/`): `app/index.js` imports the built `build/index.js` (not `src/`). It exercises real resources declared in `app/fastly.toml` and responds with a JSON report. `context.test.ts` serves each `app/bin/app-<major>.wasm` with `fastly compute serve` on a free port, in its own process group so Viceroy is killed on teardown, and compares each report section to `expectedReport`. Every SDK major must produce the same report.
