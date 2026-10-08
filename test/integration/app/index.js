/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

/// <reference types="@fastly/js-compute" />

// Integration test app. Runs inside the Compute runtime (Viceroy), exercises the
// built library against real resources declared in fastly.toml, and responds with
// a JSON report that the test runner asserts against.

import { createContext, buildContextProxy, buildContextProxyOn } from '../../../build/index.js';

addEventListener('fetch', (event) => event.respondWith(handler(event)));

function kind(value) {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'object' || typeof value === 'function') {
    return value.constructor?.name ?? typeof value;
  }
  return typeof value;
}

async function attempt(fn) {
  try {
    return { value: await fn() };
  } catch (err) {
    return { error: String(err?.message ?? err) };
  }
}

function lookup(map, present, missing) {
  return {
    present: kind(map[present]),
    missing: kind(map[missing]),
    presentIsCached: map[present] === map[present],
    hasPresent: present in map,
    hasMissing: missing in map,
  };
}

async function handler() {
  const ctx = createContext();

  const report = {
    context: {
      isSingleton: createContext() === ctx,
      isFrozen: Object.isFrozen(ctx),
      keys: Object.keys(ctx).sort(),
    },

    env: {
      FASTLY_HOSTNAME: ctx.ENV.FASTLY_HOSTNAME,
      FASTLY_SERVICE_VERSION: ctx.ENV.FASTLY_SERVICE_VERSION,
      missing: ctx.ENV.THIS_ENV_VAR_DOES_NOT_EXIST,
      missingKind: kind(ctx.ENV.THIS_ENV_VAR_DOES_NOT_EXIST),
      hasHostname: 'FASTLY_HOSTNAME' in ctx.ENV,
    },

    acls: {
      ...lookup(ctx.ACLS, 'my_acl', 'missing_acl'),
      lookupBlocked: await attempt(async () => (await ctx.ACLS.my_acl.lookup('192.0.2.1'))?.action ?? null),
      lookupUnlisted: await attempt(async () => (await ctx.ACLS.my_acl.lookup('198.51.100.1'))?.action ?? null),
    },

    backends: {
      ...lookup(ctx.BACKENDS, 'origin', 'missing_backend'),
      name: await attempt(() => ctx.BACKENDS.origin.name),
      target: await attempt(() => ctx.BACKENDS.origin.target),
    },

    configStores: {
      ...lookup(ctx.CONFIG_STORES, 'my_config', 'missing_config'),
      get: await attempt(() => ctx.CONFIG_STORES.my_config.get('greeting')),
      getMissingKey: await attempt(() => ctx.CONFIG_STORES.my_config.get('nope')),
    },

    kvStores: {
      ...lookup(ctx.KV_STORES, 'my_kv', 'missing_kv'),
      get: await attempt(async () => (await ctx.KV_STORES.my_kv.get('item'))?.text() ?? null),
      getMissingKey: await attempt(async () => (await ctx.KV_STORES.my_kv.get('nope')) ?? null),
    },

    loggers: {
      present: kind(ctx.LOGGERS.my_logger),
      presentIsCached: ctx.LOGGERS.my_logger === ctx.LOGGERS.my_logger,
      log: await attempt(() => {
        ctx.LOGGERS.my_logger.log('integration test log line');
        return true;
      }),
    },

    secretStores: {
      ...lookup(ctx.SECRET_STORES, 'my_secrets', 'missing_secrets'),
      // Only report whether the secret matched, never the secret value itself.
      matches: await attempt(async () => (await ctx.SECRET_STORES.my_secrets.get('token'))?.plaintext() === 'not-a-real-secret'),
      getMissingKey: await attempt(async () => (await ctx.SECRET_STORES.my_secrets.get('nope')) ?? null),
    },
  };

  const bindings = buildContextProxy({
    acl: 'Acl:my_acl',
    origin: 'Backend',
    renamedOrigin: 'Backend:origin-renamed',
    config: 'ConfigStore:my_config',
    hostname: 'env:FASTLY_HOSTNAME',
    kv: 'KVStore:my_kv',
    log: 'Logger:my_logger',
    secrets: 'SecretStore:my_secrets',
    missingBackend: 'Backend:missing_backend',
  });

  report.proxy = {
    aclIsSame: bindings.acl === ctx.ACLS.my_acl,
    originIsSame: bindings.origin === ctx.BACKENDS.origin,
    renamedOriginName: await attempt(() => bindings.renamedOrigin.name),
    configIsSame: bindings.config === ctx.CONFIG_STORES.my_config,
    hostname: bindings.hostname,
    kvIsSame: bindings.kv === ctx.KV_STORES.my_kv,
    logIsSame: bindings.log === ctx.LOGGERS.my_logger,
    secretsIsSame: bindings.secrets === ctx.SECRET_STORES.my_secrets,
    missingBackend: kind(bindings.missingBackend),
    hasOrigin: 'origin' in bindings,
    hasMissingBackend: 'missingBackend' in bindings,
  };

  const extended = buildContextProxyOn(
    { origin: 'target-origin', missingBackend: 'target-fallback', extra: 'target-extra' },
    { origin: 'Backend', missingBackend: 'Backend:missing_backend' },
  );

  report.proxyOn = {
    origin: kind(extended.origin),
    missingBackend: extended.missingBackend,
    extra: extended.extra,
  };

  return new Response(JSON.stringify(report, null, 2), {
    headers: { 'content-type': 'application/json' },
  });
}
