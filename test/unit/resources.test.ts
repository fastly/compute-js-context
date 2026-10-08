/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

import { beforeEach, describe, expect, it } from 'vitest';
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

describe.each(resourceMaps)('$kind map', ({ kind, create, cls }) => {
  it('returns an instance for a provisioned resource', () => {
    provision(kind, 'mine');
    const map = create();
    const value = map.mine;
    expect(value).toBeInstanceOf(cls);
    expect((value as { name: string }).name).toBe('mine');
  });

  it('returns undefined when opening the resource throws', () => {
    const map = create();
    expect(map.missing).toBeUndefined();
    expect(callsFor(kind, 'missing')).toHaveLength(1);
  });

  it('does not open any resource until accessed', () => {
    provision(kind, 'mine');
    create();
    expect(registry.calls).toHaveLength(0);
  });

  it('opens each resource at most once', () => {
    provision(kind, 'mine');
    const map = create();
    expect(map.mine).toBe(map.mine);
    map.missing;
    map.missing;
    expect(callsFor(kind, 'mine')).toHaveLength(1);
    expect(callsFor(kind, 'missing')).toHaveLength(1);
  });

  it('supports the `in` operator', () => {
    provision(kind, 'mine');
    const map = create();
    expect('mine' in map).toBe(true);
    expect('missing' in map).toBe(false);
  });

  it('opens only the named resource type', () => {
    provision(kind, 'mine');
    create().mine;
    expect(registry.calls).toEqual([{ kind, name: 'mine' }]);
  });
});

describe('env map', () => {
  it('returns environment variable values', () => {
    registry.env.set('FASTLY_HOSTNAME', 'localhost');
    registry.env.set('CUSTOM', 'value');
    const env = createEnv();
    expect(env.FASTLY_HOSTNAME).toBe('localhost');
    expect(env.CUSTOM).toBe('value');
  });

  it('returns whatever the runtime returns for unset variables', () => {
    const env = createEnv();
    expect(env.NOT_SET).toBeUndefined();
    expect('NOT_SET' in env).toBe(false);
  });

  it('treats an empty string value as present', () => {
    registry.env.set('EMPTY', '');
    const env = createEnv();
    expect(env.EMPTY).toBe('');
    expect('EMPTY' in env).toBe(true);
  });

  it('reads each variable at most once', () => {
    registry.env.set('FASTLY_POP', 'TYO');
    const env = createEnv();
    env.FASTLY_POP;
    env.FASTLY_POP;
    expect(callsFor('env', 'FASTLY_POP')).toHaveLength(1);
  });
});
