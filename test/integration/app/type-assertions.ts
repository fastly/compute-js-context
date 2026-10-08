/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

/// <reference types="@fastly/js-compute" />

// Compile-time only; not part of the app bundle. build-apps.mjs type-checks it
// against each @fastly/js-compute version under test, using the packed library,
// to catch the published types breaking or degrading (e.g. to `any`) under that SDK.

import type { Acl } from 'fastly:acl';
import type { Backend } from 'fastly:backend';
import type { ConfigStore } from 'fastly:config-store';
import type { KVStore } from 'fastly:kv-store';
import type { Logger } from 'fastly:logger';
import type { SecretStore } from 'fastly:secret-store';
import {
  buildContextProxy,
  buildContextProxyOn,
  createContext,
  type ContextProxy,
  type ResourceType,
} from '@fastly/compute-js-context';

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
function assertType<T extends true>() {}

// --- createContext()

const ctx = createContext();
assertType<Equals<typeof ctx.ACLS[string], Acl | undefined>>();
assertType<Equals<typeof ctx.BACKENDS[string], Backend | undefined>>();
assertType<Equals<typeof ctx.CONFIG_STORES[string], ConfigStore | undefined>>();
assertType<Equals<typeof ctx.KV_STORES[string], KVStore | undefined>>();
assertType<Equals<typeof ctx.LOGGERS[string], Logger | undefined>>();
assertType<Equals<typeof ctx.SECRET_STORES[string], SecretStore | undefined>>();
assertType<Equals<typeof ctx.ENV.FASTLY_HOSTNAME, string | undefined>>();
assertType<Equals<typeof ctx.ENV[string], string | undefined>>();
// @ts-expect-error -- the context is readonly
ctx.ENV = ctx.ENV;

// --- buildContextProxy()

const bindings = buildContextProxy({
  acl: 'Acl',
  backend: 'Backend:my-backend',
  config: 'ConfigStore',
  hostname: 'env:FASTLY_HOSTNAME',
  kv: 'KVStore',
  logger: 'Logger',
  secrets: 'SecretStore',
});
assertType<Equals<typeof bindings.acl, Acl>>();
assertType<Equals<typeof bindings.backend, Backend>>();
assertType<Equals<typeof bindings.config, ConfigStore>>();
assertType<Equals<typeof bindings.hostname, string>>();
assertType<Equals<typeof bindings.kv, KVStore>>();
assertType<Equals<typeof bindings.logger, Logger>>();
assertType<Equals<typeof bindings.secrets, SecretStore>>();
assertType<Equals<ContextProxy<{}>, Record<string, never>>>();

// @ts-expect-error -- not a resource type
buildContextProxy({ foo: 'NotAResource' });
// @ts-expect-error -- not a resource type, even with a name
buildContextProxy({ foo: 'NotAResource:name' });

assertType<Equals<ResourceType, 'Acl' | 'Backend' | 'ConfigStore' | 'env' | 'KVStore' | 'Logger' | 'SecretStore'>>();

// --- buildContextProxyOn()

const extended = buildContextProxyOn({ extra: 1 }, { kv: 'KVStore' });
assertType<Equals<typeof extended.extra, number>>();
assertType<Equals<typeof extended.kv, KVStore>>();
