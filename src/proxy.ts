/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

import type { Acl } from 'fastly:acl';
import type { Backend } from 'fastly:backend';
import type { ConfigStore } from 'fastly:config-store';
import type { KVStore } from 'fastly:kv-store';
import type { Logger } from 'fastly:logger';
import type { SecretStore } from 'fastly:secret-store';
import { type Context, createContext } from './index.js';

type Def<T extends string> = T | `${T}:${string}`;
type Defs<T extends string> = T extends string ? Def<T> : never;

const BindingStringToContextKeyMapping = {
  Acl: 'ACLS',
  Backend: 'BACKENDS',
  ConfigStore: 'CONFIG_STORES',
  env: 'ENV',
  KVStore: 'KV_STORES',
  Logger: 'LOGGERS',
  SecretStore: 'SECRET_STORES',
} as const;
export type ResourceType = keyof typeof BindingStringToContextKeyMapping;
export type BindingsString = Defs<ResourceType>;
export type BindingsDefs = Record<string, BindingsString>;

type BindingStringToResourceInstanceTypeMapping = {
  Acl: Acl;
  Backend: Backend;
  ConfigStore: ConfigStore;
  env: string;
  KVStore: KVStore;
  Logger: Logger;
  SecretStore: SecretStore;
};

export type ResourceInstance<T> =
  T extends Def<infer K extends keyof BindingStringToResourceInstanceTypeMapping>
    ? BindingStringToResourceInstanceTypeMapping[K]
    : never;

export type ContextProxy<T extends BindingsDefs> = keyof T extends never ?
  Record<string, never> :
  {
    [K in keyof T]: ResourceInstance<T[K]>;
  };

function isResourceType(resourceType: string): resourceType is ResourceType {
  return resourceType in BindingStringToContextKeyMapping;
}

function getResourceType(typeName: string): ResourceType | undefined {
  const [resourceType,] = typeName.split(':');
  if (isResourceType(resourceType)) {
    return resourceType;
  }
  return undefined;
}

function getResourceName(key: string, typeName: string) {
  const [,seg,] = typeName.split(':');
  return seg ?? key;
}

export function buildContextProxyOn<TTarget extends object, T extends BindingsDefs>(
  target: TTarget,
  bindingsDefs: T
) {
  const context = createContext();

  const getEntry = (key: string | symbol) => {
    if (typeof key !== "string" || !(key in bindingsDefs)) {
      return undefined;
    }
    const typeName = bindingsDefs[key];
    const resourceType = getResourceType(typeName);
    if (resourceType == null) {
      return undefined;
    }
    const resourceName = getResourceName(key, typeName);
    const contextKey = BindingStringToContextKeyMapping[resourceType];
    const contextEntry = context[contextKey];
    if (contextEntry == null) {
      return undefined;
    }
    return contextEntry[resourceName];
  };

  const handler: ProxyHandler<typeof target> = {
    get(target, key, receiver) {
      if (typeof key !== "string") {
        return Reflect.get(target, key, receiver);
      }
      const entry = getEntry(key);
      if (entry !== undefined) {
        return entry;
      }
      return Reflect.get(target, key, receiver);
    },
    has(target, key) {
      if (typeof key !== "string") {
        return Reflect.has(target, key);
      }
      if (getEntry(key) !== undefined) {
        return true;
      }
      return Reflect.has(target, key);
    },
  };

  return new Proxy(target, handler) as unknown as (TTarget & ContextProxy<T>);
}

export function buildContextProxy<T extends BindingsDefs>(
  bindingsDefs: T
): ContextProxy<T> {
  return buildContextProxyOn({}, bindingsDefs);
}
