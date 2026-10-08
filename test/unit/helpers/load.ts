/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

import { vi } from 'vitest';

// createContext() memoizes at module scope, so tests that need a fresh context load
// a fresh copy of the library. The fake registry is reloaded alongside it so that
// both share the same instance.
export async function loadFresh() {
  vi.resetModules();
  const registry = await import('../fakes/registry.js');
  const lib = await import('../../../src/index.js');
  return { ...registry, ...lib };
}
