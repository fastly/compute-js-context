/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

// The proxies read from the createContext() singleton, which every test in this file
// shares (node:test runs each file in its own process). Tests use distinct resource
// names so that lookups cached by one test don't affect another.

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { buildContextProxy, buildContextProxyOn, createContext } from '../../src/index.js';
import { callsFor, provision, registry, resetRegistry } from './fakes/registry.js';

beforeEach(() => {
  resetRegistry();
});

describe('buildContextProxy', () => {
  it('maps each resource type to the corresponding context entry', () => {
    provision('Acl', 'acl');
    provision('Backend', 'backend');
    provision('ConfigStore', 'config');
    provision('KVStore', 'kv');
    provision('Logger', 'logger');
    provision('SecretStore', 'secrets');
    registry.env.set('env', 'env-value');

    const ctx = createContext();
    const bindings = buildContextProxy({
      acl: 'Acl',
      backend: 'Backend',
      config: 'ConfigStore',
      env: 'env',
      kv: 'KVStore',
      logger: 'Logger',
      secrets: 'SecretStore',
    });

    assert.notEqual(bindings.acl, undefined);
    assert.equal(bindings.acl, ctx.ACLS.acl);
    assert.equal(bindings.backend, ctx.BACKENDS.backend);
    assert.equal(bindings.config, ctx.CONFIG_STORES.config);
    assert.equal(bindings.env, 'env-value');
    assert.equal(bindings.kv, ctx.KV_STORES.kv);
    assert.equal(bindings.logger, ctx.LOGGERS.logger);
    assert.equal(bindings.secrets, ctx.SECRET_STORES.secrets);
  });

  it('uses the name after the colon as the resource name', () => {
    provision('Backend', 'origin-s3');
    registry.env.set('FASTLY_HOSTNAME', 'localhost');

    const bindings = buildContextProxy({
      origin: 'Backend:origin-s3',
      host: 'env:FASTLY_HOSTNAME',
    });

    assert.notEqual(bindings.origin, undefined);
    assert.equal(bindings.origin, createContext().BACKENDS['origin-s3']);
    assert.equal(bindings.host, 'localhost');
  });

  it('uses only the segment between the first and second colon as the name', () => {
    provision('KVStore', 'segment-store');
    const bindings = buildContextProxy({ kv: 'KVStore:segment-store:ignored' });
    assert.notEqual(bindings.kv, undefined);
  });

  it('uses an empty name, not the key, when nothing follows the colon', () => {
    provision('KVStore', 'empty-name-kv');
    // `'KVStore:'` splits into ['KVStore', ''], so the name is '' rather than the key.
    const bindings = buildContextProxy({ 'empty-name-kv': 'KVStore:' as 'KVStore' });
    assert.equal(bindings['empty-name-kv'], undefined);
    assert.deepEqual(registry.calls, [{ kind: 'KVStore', name: '' }]);
  });

  it('returns undefined for resources that are not provisioned', () => {
    const bindings = buildContextProxy({ 'unprovisioned-backend': 'Backend' });
    assert.equal(bindings['unprovisioned-backend'], undefined);
    assert.equal('unprovisioned-backend' in bindings, false);
  });

  it('returns undefined for keys that are not defined', () => {
    provision('Backend', 'undefined-key');
    const bindings = buildContextProxy({ origin: 'Backend' }) as Record<string, unknown>;
    assert.equal(bindings['undefined-key'], undefined);
    assert.equal('undefined-key' in bindings, false);
    assert.equal(registry.calls.length, 0);
  });

  it('ignores unknown resource types', () => {
    provision('Backend', 'unknown-type');
    const bindings = buildContextProxy({ 'unknown-type': 'Unknown:unknown-type' as 'Backend' });
    assert.equal(bindings['unknown-type'], undefined);
    assert.equal('unknown-type' in bindings, false);
    assert.equal(registry.calls.length, 0);
  });

  it('does not treat inherited Object.prototype keys as resource types', () => {
    const bindings = buildContextProxy({ thing: 'toString' as 'Backend' });
    assert.equal(bindings.thing, undefined);
    assert.equal(registry.calls.length, 0);
  });

  it('supports the `in` operator for provisioned bindings', () => {
    provision('Logger', 'audit');
    const bindings = buildContextProxy({ audit: 'Logger', 'missing-logger': 'Logger' });
    assert.equal('audit' in bindings, true);
    assert.equal('missing-logger' in bindings, false);
  });

  it('resolves lazily and shares the context cache', () => {
    provision('ConfigStore', 'lazy-config');
    const bindings = buildContextProxy({ a: 'ConfigStore:lazy-config', b: 'ConfigStore:lazy-config' });
    assert.equal(registry.calls.length, 0);
    assert.equal(bindings.a, bindings.b);
    assert.equal(bindings.a, createContext().CONFIG_STORES['lazy-config']);
    assert.equal(callsFor('ConfigStore', 'lazy-config').length, 1);
  });

  it('is empty when given no bindings', () => {
    const bindings = buildContextProxy({});
    assert.deepEqual(Object.keys(bindings), []);
    assert.equal((bindings as Record<string, unknown>).anything, undefined);
  });
});

describe('buildContextProxyOn', () => {
  it('prefers provisioned bindings over target properties', () => {
    provision('Backend', 'provisioned-origin');
    const extended = buildContextProxyOn(
      { origin: 'from-target' },
      { origin: 'Backend:provisioned-origin' },
    );
    assert.notEqual(extended.origin, undefined);
    assert.equal(extended.origin, createContext().BACKENDS['provisioned-origin']);
  });

  it('falls back to the target when a binding is not provisioned', () => {
    const extended = buildContextProxyOn(
      { origin: 'from-target' },
      { origin: 'Backend:unprovisioned-origin' },
    );
    assert.equal(extended.origin as unknown, 'from-target');
    assert.equal('origin' in extended, true);
  });

  it('passes through target properties that are not bindings', () => {
    const target = { extra: 42, method() { return this.extra; } };
    const extended = buildContextProxyOn(target, { origin: 'Backend' });
    assert.equal(extended.extra, 42);
    assert.equal(extended.method(), 42);
    assert.equal('extra' in extended, true);
    assert.equal('nope' in extended, false);
  });

  it('passes through symbol keys to the target', () => {
    const sym = Symbol('test');
    const extended = buildContextProxyOn({ [sym]: 'symbol-value' }, { origin: 'Backend' });
    assert.equal(extended[sym], 'symbol-value');
    assert.equal(sym in extended, true);
  });

  it('passes through inherited properties of the target', () => {
    class Base { inherited() { return 'base'; } }
    const extended = buildContextProxyOn(new Base(), { origin: 'Backend' });
    assert.equal(extended.inherited(), 'base');
    assert.ok(extended instanceof Base);
  });

  it('writes through to the target', () => {
    const target: Record<string, unknown> = {};
    const extended = buildContextProxyOn(target, { origin: 'Backend' }) as Record<string, unknown>;
    extended.added = 'value';
    assert.equal(target.added, 'value');
    assert.equal(extended.added, 'value');
  });
});
