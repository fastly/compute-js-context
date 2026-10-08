/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest';
import { loadFresh } from './helpers/load.js';

describe('buildContextProxy', () => {
  it('maps each resource type to the corresponding context entry', async () => {
    const { buildContextProxy, createContext, provision, registry } = await loadFresh();
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

    expect(bindings.acl).toBe(ctx.ACLS.acl);
    expect(bindings.backend).toBe(ctx.BACKENDS.backend);
    expect(bindings.config).toBe(ctx.CONFIG_STORES.config);
    expect(bindings.env).toBe('env-value');
    expect(bindings.kv).toBe(ctx.KV_STORES.kv);
    expect(bindings.logger).toBe(ctx.LOGGERS.logger);
    expect(bindings.secrets).toBe(ctx.SECRET_STORES.secrets);
    expect(bindings.acl).toBeDefined();
  });

  it('uses the name after the colon as the resource name', async () => {
    const { buildContextProxy, createContext, provision, registry } = await loadFresh();
    provision('Backend', 'origin-s3');
    registry.env.set('FASTLY_HOSTNAME', 'localhost');

    const bindings = buildContextProxy({
      origin: 'Backend:origin-s3',
      host: 'env:FASTLY_HOSTNAME',
    });

    expect(bindings.origin).toBe(createContext().BACKENDS['origin-s3']);
    expect(bindings.origin).toBeDefined();
    expect(bindings.host).toBe('localhost');
  });

  it('uses only the segment between the first and second colon as the name', async () => {
    const { buildContextProxy, provision } = await loadFresh();
    provision('KVStore', 'store');
    const bindings = buildContextProxy({ kv: 'KVStore:store:ignored' });
    expect(bindings.kv).toBeDefined();
  });

  it('falls back to the key when the name after the colon is empty', async () => {
    const { buildContextProxy, provision } = await loadFresh();
    provision('KVStore', 'kv');
    // `'KVStore:'` splits into ['KVStore', ''], so the name is '' rather than the key.
    const bindings = buildContextProxy({ kv: 'KVStore:' as 'KVStore' });
    expect(bindings.kv).toBeUndefined();
  });

  it('returns undefined for resources that are not provisioned', async () => {
    const { buildContextProxy } = await loadFresh();
    const bindings = buildContextProxy({ missing: 'Backend' });
    expect(bindings.missing).toBeUndefined();
    expect('missing' in bindings).toBe(false);
  });

  it('returns undefined for keys that are not defined', async () => {
    const { buildContextProxy, provision, registry } = await loadFresh();
    provision('Backend', 'other');
    const bindings = buildContextProxy({ origin: 'Backend' }) as Record<string, unknown>;
    expect(bindings.other).toBeUndefined();
    expect('other' in bindings).toBe(false);
    expect(registry.calls).toHaveLength(0);
  });

  it('ignores unknown resource types', async () => {
    const { buildContextProxy, provision, registry } = await loadFresh();
    provision('Backend', 'thing');
    const bindings = buildContextProxy({ thing: 'Unknown:thing' as 'Backend' });
    expect(bindings.thing).toBeUndefined();
    expect('thing' in bindings).toBe(false);
    expect(registry.calls).toHaveLength(0);
  });

  it('does not treat inherited Object.prototype keys as resource types', async () => {
    const { buildContextProxy, registry } = await loadFresh();
    const bindings = buildContextProxy({ thing: 'toString' as 'Backend' });
    expect(bindings.thing).toBeUndefined();
    expect(registry.calls).toHaveLength(0);
  });

  it('supports the `in` operator for provisioned bindings', async () => {
    const { buildContextProxy, provision } = await loadFresh();
    provision('Logger', 'audit');
    const bindings = buildContextProxy({ audit: 'Logger', missing: 'Logger' });
    expect('audit' in bindings).toBe(true);
    expect('missing' in bindings).toBe(false);
  });

  it('resolves lazily and shares the context cache', async () => {
    const { buildContextProxy, callsFor, provision, registry } = await loadFresh();
    provision('ConfigStore', 'config');
    const bindings = buildContextProxy({ a: 'ConfigStore:config', b: 'ConfigStore:config' });
    expect(registry.calls).toHaveLength(0);
    expect(bindings.a).toBe(bindings.b);
    expect(callsFor('ConfigStore', 'config')).toHaveLength(1);
  });

  it('is empty when given no bindings', async () => {
    const { buildContextProxy } = await loadFresh();
    const bindings = buildContextProxy({});
    expect(Object.keys(bindings)).toEqual([]);
    expect((bindings as Record<string, unknown>).anything).toBeUndefined();
  });
});

describe('buildContextProxyOn', () => {
  it('prefers provisioned bindings over target properties', async () => {
    const { buildContextProxyOn, createContext, provision } = await loadFresh();
    provision('Backend', 'origin');
    const extended = buildContextProxyOn({ origin: 'from-target' }, { origin: 'Backend' });
    expect(extended.origin).toBe(createContext().BACKENDS.origin);
    expect(extended.origin).not.toBe('from-target');
  });

  it('falls back to the target when a binding is not provisioned', async () => {
    const { buildContextProxyOn } = await loadFresh();
    const extended = buildContextProxyOn({ origin: 'from-target' }, { origin: 'Backend' });
    expect(extended.origin as unknown).toBe('from-target');
    expect('origin' in extended).toBe(true);
  });

  it('passes through target properties that are not bindings', async () => {
    const { buildContextProxyOn } = await loadFresh();
    const target = { extra: 42, method() { return this.extra; } };
    const extended = buildContextProxyOn(target, { origin: 'Backend' });
    expect(extended.extra).toBe(42);
    expect(extended.method()).toBe(42);
    expect('extra' in extended).toBe(true);
    expect('nope' in extended).toBe(false);
  });

  it('passes through symbol keys to the target', async () => {
    const { buildContextProxyOn } = await loadFresh();
    const sym = Symbol('test');
    const extended = buildContextProxyOn({ [sym]: 'symbol-value' }, { origin: 'Backend' });
    expect(extended[sym]).toBe('symbol-value');
    expect(sym in extended).toBe(true);
  });

  it('passes through inherited properties of the target', async () => {
    const { buildContextProxyOn } = await loadFresh();
    class Base { inherited() { return 'base'; } }
    const extended = buildContextProxyOn(new Base(), { origin: 'Backend' });
    expect(extended.inherited()).toBe('base');
    expect(extended).toBeInstanceOf(Base);
  });

  it('writes through to the target', async () => {
    const { buildContextProxyOn } = await loadFresh();
    const target: Record<string, unknown> = {};
    const extended = buildContextProxyOn(target, { origin: 'Backend' }) as Record<string, unknown>;
    extended.added = 'value';
    expect(target.added).toBe('value');
    expect(extended.added).toBe('value');
  });
});
