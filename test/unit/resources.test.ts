/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { Acl } from 'fastly:acl';
import { Backend } from 'fastly:backend';
import { ConfigStore } from 'fastly:config-store';
import { KVStore } from 'fastly:kv-store';
import { Logger } from 'fastly:logger';
import { SecretStore } from 'fastly:secret-store';
import { createAcls } from '../../src/acls.js';
import { createBackends } from '../../src/backends.js';
import { createConfigStores } from '../../src/config-stores.js';
import { createEnv } from '../../src/env.js';
import { createKVStores } from '../../src/kv-stores.js';
import { createLoggers } from '../../src/loggers.js';
import { createSecretStores } from '../../src/secret-stores.js';
import { callsFor, provision, registry, resetRegistry, type ResourceKind } from './fakes/registry.js';

beforeEach(() => {
  resetRegistry();
});

const resourceMaps: {
  kind: ResourceKind,
  create: () => Readonly<Record<string, unknown>>,
  cls: abstract new (...args: never[]) => unknown,
}[] = [
  { kind: 'Acl', create: createAcls, cls: Acl },
  { kind: 'Backend', create: createBackends, cls: Backend },
  { kind: 'ConfigStore', create: createConfigStores, cls: ConfigStore },
  { kind: 'KVStore', create: createKVStores, cls: KVStore },
  { kind: 'Logger', create: createLoggers, cls: Logger },
  { kind: 'SecretStore', create: createSecretStores, cls: SecretStore },
];

for (const { kind, create, cls } of resourceMaps) {
  describe(`${kind} map`, () => {
    it('returns an instance for a provisioned resource', () => {
      provision(kind, 'mine');
      const map = create();
      const value = map.mine;
      assert.ok(value instanceof cls);
      assert.equal((value as { name: string }).name, 'mine');
    });

    it('returns undefined when opening the resource throws', () => {
      const map = create();
      assert.equal(map.missing, undefined);
      assert.equal(callsFor(kind, 'missing').length, 1);
    });

    it('does not open any resource until accessed', () => {
      provision(kind, 'mine');
      create();
      assert.equal(registry.calls.length, 0);
    });

    it('opens each resource at most once', () => {
      provision(kind, 'mine');
      const map = create();
      assert.equal(map.mine, map.mine);
      map.missing;
      map.missing;
      assert.equal(callsFor(kind, 'mine').length, 1);
      assert.equal(callsFor(kind, 'missing').length, 1);
    });

    it('supports the `in` operator', () => {
      provision(kind, 'mine');
      const map = create();
      assert.equal('mine' in map, true);
      assert.equal('missing' in map, false);
    });

    it('opens only the named resource type', () => {
      provision(kind, 'mine');
      create().mine;
      assert.deepEqual(registry.calls, [{ kind, name: 'mine' }]);
    });
  });
}

describe('env map', () => {
  it('returns environment variable values', () => {
    registry.env.set('FASTLY_HOSTNAME', 'localhost');
    registry.env.set('CUSTOM', 'value');
    const env = createEnv();
    assert.equal(env.FASTLY_HOSTNAME, 'localhost');
    assert.equal(env.CUSTOM, 'value');
  });

  it('returns whatever the runtime returns for unset variables', () => {
    const env = createEnv();
    assert.equal(env.NOT_SET, undefined);
    assert.equal('NOT_SET' in env, false);
  });

  it('treats an empty string value as present', () => {
    registry.env.set('EMPTY', '');
    const env = createEnv();
    assert.equal(env.EMPTY, '');
    assert.equal('EMPTY' in env, true);
  });

  it('reads each variable at most once', () => {
    registry.env.set('FASTLY_POP', 'TYO');
    const env = createEnv();
    env.FASTLY_POP;
    env.FASTLY_POP;
    assert.equal(callsFor('env', 'FASTLY_POP').length, 1);
  });
});
