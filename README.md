# Fastly Compute Context Utility

> NOTE: `@fastly/compute-js-context` is provided as a Fastly Labs product. Visit the [Fastly Labs](https://www.fastlylabs.com/) site for terms of use.

`@fastly/compute-js-context` exposes Fastly Compute resources to your Compute JavaScript application. It provides it as one typed, immutable context object, or as a custom, strongly-typed object mapping your service's specific resource names to their handles.

## The `Context` Object

The core export is `createContext`, which returns a single, immutable `Context` object.

```ts
type Context = Readonly<{
  ACLS: Acls;
  BACKENDS: Backends;
  CONFIG_STORES: ConfigStores;
  ENV: Env;
  KV_STORES: KVStores;
  LOGGERS: Loggers;
  SECRET_STORES: SecretStores;
}>;
```

Each top-level field is a [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy). Accessing a property lazily looks up and caches the corresponding runtime object. Unknown names return `undefined`.

## Features

- **A single source of truth**: grab everything off `ctx.*`
- **Typed and safe**: TypeScript-first, with `undefined` for optional resources
- **Lazy + memoized**: nothing is created until accessed
- **Readonly**: the `Context` is immutable
- **Customizable**: use `buildContextProxy` to create a bespoke, typed binding object for your app

## Installation

> Requires a [Fastly Compute JavaScript project (`@fastly/js-compute`)](https://www.fastly.com/documentation/guides/compute/developer-guides/javascript/).

```bash
npm install @fastly/compute-js-context
```

## Quick start

This example shows basic usage of the main `Context` object.

```javascript
/// <reference types="@fastly/js-compute" />
import { createContext } from '@fastly/compute-js-context';

addEventListener('fetch', (event) => event.respondWith(handler(event)));
async function handler(event) {
  const ctx = createContext();

  // Environment - simple strings (or empty string if not present)
  console.log('FASTLY_SERVICE_VERSION', ctx.ENV.FASTLY_SERVICE_VERSION);

  // Secret Store - property is the SecretStore object, or undefined if not configured
  const awsSecrets = ctx.SECRET_STORES.AWS_CREDENTIALS;
  const keyId = await awsSecrets?.get('AWS_ACCESS_KEY_ID');
  console.log('key id', keyId?.plaintext());

  // Backend - pass to fetch() options, or learn about the backend
  const origin = ctx.BACKENDS.origin;
  const res = await fetch("/", { backend: origin });

  // Logger - send output to a named Fastly logging endpoint.
  const myLogEndpoint = ctx.LOGGERS.my_log_endpoint;
  myLogEndpoint?.log(`${event.request.url} ${event.client.address}`);

  return new Response("ok");
}
```

## Typed Bindings with `buildContextProxy`

For an even better developer experience, `buildContextProxy` creates a typed object that maps your application's specific binding names to the underlying Fastly resources. This gives you shorter names and better autocompletion.

First, define your bindings. The key is the name you want to use, and the value is a string identifying the resource type and (optionally) the resource name if it differs from the key.

Then, pass these definitions to `buildContextProxy()`.

```typescript
/// <reference types="@fastly/js-compute" />
import { buildContextProxy, type BindingsDefs } from '@fastly/compute-js-context';

// Define your application's bindings
const bindingsDefs = {
  // Simple mapping: key 'assets' maps to KVStore named 'assets'
  assets: 'KVStore',
  
  // Remapping: key 'origin' maps to Backend named 'origin-s3'
  origin: 'Backend:origin-s3',

  // Explicit mapping for a logger
  auditLog: 'Logger:audit_log',
} satisfies BindingsDefs; // <-- for full type safety

// This is the generated type for your bindings object
type Bindings = ContextProxy<typeof bindingsDefs>;

addEventListener('fetch', (event) => event.respondWith(handler(event)));
async function handler(event: FetchEvent): Promise<Response> {
  // Create the typed environment
  const bindings: Bindings = buildContextProxy(bindingsDefs);

  // Now use your custom bindings!
  const asset = await bindings.assets?.get('/index.html');
  
  const res = await fetch("/", { backend: bindings.origin });

  bindings.auditLog?.log('Request received');

  return new Response(asset);
}
```

## API

### `createContext(): Context`

Creates the main immutable `Context`. Each sub-object is a `Proxy` that:

- **Resolves lazily** on first property access
- **Caches** the resolved handle for subsequent accesses
- **Returns `undefined`** for names that don’t exist (except for `ENV`, which returns `''`)
- **Is not enumerable** by design (don’t rely on `Object.keys`)

### `buildContextProxy<T>(bindingsDefs: T): ContextProxy<T>`

Creates a custom, strongly-typed proxy object based on your definitions.

- `bindingsDefs`: A `const` object defining your desired bindings
  - **Key**: The property name you want on your final `contextProxy` object
  - **Value**: A string in the format `'ResourceType'` or `'ResourceType:actual-name'`
- **Returns**: A proxy object `contextProxy` with your custom bindings. Accessing a property on this object looks up the resource from the main `Context`

### Type `ContentProxy<T>`

Defines a type that represents the content proxy, inferred from your bindings definitions.

### (Advanced) `buildContextProxyOn<C, T>(target: C, bindingsDefs: T): C & ContextProxy<T>`

Extends the passed-in object with a custom, strongly-typed proxy object based on your definitions.

- `target`: An object to extend
- `bindingsDefs`: A `const` object defining your desired bindings
  - **Key**: The property name you want on your final `contextProxy` object
  - **Value**: A string in the format `'ResourceType'` or `'ResourceType:actual-name'`
- **Returns**: A proxy object `contextProxy` that extends `target` with your custom bindings. Accessing a property on this object looks up the resource from the main `Context` before falling back to `target`.

### Context Categories & Shapes

> These are the raw shapes available on the main `Context` object.

- **`ENV`**: `Readonly<Record<string, string>>`
- **`SECRET_STORES`**: `Readonly<Record<string, SecretStore | undefined>>`
- **`CONFIG_STORES`**: `Readonly<Record<string, ConfigStore | undefined>>`
- **`KV_STORES`**: `Readonly<Record<string, KVStore | undefined>>`
- **`BACKENDS`**: `Readonly<Record<string, Backend | undefined>>`
- **`LOGGERS`**: `Readonly<Record<string, Logger | undefined>>`
- **`ACLS`**: `Readonly<Record<string, Acl | undefined>>`

## Caveats

- **Don’t enumerate** category proxies; treat them as name-indexed lookups
- **Don’t mutate** the context or its sub-objects; it’s intentionally `Readonly`
- **Expect `undefined`** for missing resources and code accordingly (`?.`/guard)

## Issues

If you encounter any non-security-related bug or unexpected behavior, please [file an issue][bug] using the bug report template.

[bug]: https://github.com/fastly/compute-js-context/issues/new?labels=bug

### Security issues

Please see our [SECURITY.md](SECURITY.md) for guidance on reporting security-related issues.

## License

[MIT](./LICENSE).
