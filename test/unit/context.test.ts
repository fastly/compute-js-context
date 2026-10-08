/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

// createContext() memoizes at module scope, so every test in this file shares one
// context (node:test runs each file in its own process). Tests use distinct
// resource names so that lookups cached by one test don't affect another.

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { createContext } from '../../src/index.js';
import { callsFor, provision, registry, resetRegistry } from './fakes/registry.js';

beforeEach(() => {
  resetRegistry();
});

describe('createContext', () => {
  // Must run first, before anything else in this file creates the context.
  it('does not open any resources when first created', () => {
    createContext();
    assert.equal(registry.calls.length, 0);
  });

  it('exposes every resource category', () => {
    assert.deepEqual(Object.keys(createContext()).sort(), [
      'ACLS',
      'BACKENDS',
      'CONFIG_STORES',
      'ENV',
      'KV_STORES',
      'LOGGERS',
      'SECRET_STORES',
    ]);
  });

  it('returns the same context on every call', () => {
    assert.equal(createContext(), createContext());
  });

  it('returns a frozen context', () => {
    const ctx = createContext();
    assert.equal(Object.isFrozen(ctx), true);
    assert.throws(() => {
      (ctx as { ENV: unknown }).ENV = {};
    }, TypeError);
  });

  it('routes each category to the matching resource type', () => {
    provision('Acl', 'route-a');
    provision('Backend', 'route-b');
    provision('ConfigStore', 'route-c');
    provision('KVStore', 'route-k');
    provision('Logger', 'route-l');
    provision('SecretStore', 'route-s');
    registry.env.set('ROUTE_E', 'e');

    const ctx = createContext();
    assert.notEqual(ctx.ACLS['route-a'], undefined);
    assert.notEqual(ctx.BACKENDS['route-b'], undefined);
    assert.notEqual(ctx.CONFIG_STORES['route-c'], undefined);
    assert.notEqual(ctx.KV_STORES['route-k'], undefined);
    assert.notEqual(ctx.LOGGERS['route-l'], undefined);
    assert.notEqual(ctx.SECRET_STORES['route-s'], undefined);
    assert.equal(ctx.ENV.ROUTE_E, 'e');

    // Names provisioned for one type are not visible through another.
    assert.equal(ctx.BACKENDS['route-a'], undefined);
    assert.equal(ctx.KV_STORES['route-c'], undefined);
  });

  it('shares cached resources across calls', () => {
    provision('KVStore', 'shared-k');
    assert.equal(createContext().KV_STORES['shared-k'], createContext().KV_STORES['shared-k']);
    assert.equal(callsFor('KVStore', 'shared-k').length, 1);
  });
});
