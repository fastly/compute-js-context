/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest';
import { loadFresh } from './helpers/load.js';

describe('createContext', () => {
  it('exposes every resource category', async () => {
    const { createContext } = await loadFresh();
    const ctx = createContext();
    expect(Object.keys(ctx).sort()).toEqual([
      'ACLS',
      'BACKENDS',
      'CONFIG_STORES',
      'ENV',
      'KV_STORES',
      'LOGGERS',
      'SECRET_STORES',
    ]);
  });

  it('returns the same context on every call', async () => {
    const { createContext } = await loadFresh();
    expect(createContext()).toBe(createContext());
  });

  it('returns a frozen context', async () => {
    const { createContext } = await loadFresh();
    const ctx = createContext();
    expect(Object.isFrozen(ctx)).toBe(true);
    expect(() => {
      (ctx as { ENV: unknown }).ENV = {};
    }).toThrow(TypeError);
  });

  it('does not open any resources when created', async () => {
    const { createContext, registry } = await loadFresh();
    createContext();
    expect(registry.calls).toHaveLength(0);
  });

  it('routes each category to the matching resource type', async () => {
    const { createContext, provision, registry } = await loadFresh();
    provision('Acl', 'a');
    provision('Backend', 'b');
    provision('ConfigStore', 'c');
    provision('KVStore', 'k');
    provision('Logger', 'l');
    provision('SecretStore', 's');
    registry.env.set('E', 'e');

    const ctx = createContext();
    expect(ctx.ACLS.a).toBeDefined();
    expect(ctx.BACKENDS.b).toBeDefined();
    expect(ctx.CONFIG_STORES.c).toBeDefined();
    expect(ctx.KV_STORES.k).toBeDefined();
    expect(ctx.LOGGERS.l).toBeDefined();
    expect(ctx.SECRET_STORES.s).toBeDefined();
    expect(ctx.ENV.E).toBe('e');

    // Names provisioned for one type are not visible through another.
    expect(ctx.BACKENDS.a).toBeUndefined();
    expect(ctx.KV_STORES.c).toBeUndefined();
  });

  it('shares cached resources across calls', async () => {
    const { createContext, provision } = await loadFresh();
    provision('KVStore', 'k');
    expect(createContext().KV_STORES.k).toBe(createContext().KV_STORES.k);
  });
});
