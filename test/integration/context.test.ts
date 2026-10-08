/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

// Runs the integration app (built once per SDK version by build-apps.mjs) under the
// Fastly CLI's local server (Viceroy) and asserts that every SDK version produces
// the same, expected report.

import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { SDK_VERSIONS, sdkWorkDir } from './sdk-versions.mjs';

const fastlyCli = process.env.FASTLY_CLI ?? 'fastly';

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address == null || typeof address === 'string') {
          reject(new Error('Could not determine free port'));
        } else {
          resolve(address.port);
        }
      });
    });
  });
}

async function waitForServer(url: string, proc: ChildProcess, getOutput: () => string) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (proc.exitCode != null) {
      throw new Error(`Local server exited early (code ${proc.exitCode}):\n${getOutput()}`);
    }
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Timed out waiting for local server at ${url}:\n${getOutput()}`);
}

const expectedLookup = (presentClass: string) => ({
  present: presentClass,
  missing: 'undefined',
  presentIsCached: true,
  hasPresent: true,
  hasMissing: false,
});

const expectedReport = {
  context: {
    isSingleton: true,
    isFrozen: true,
    keys: ['ACLS', 'BACKENDS', 'CONFIG_STORES', 'ENV', 'KV_STORES', 'LOGGERS', 'SECRET_STORES'],
  },
  env: {
    FASTLY_HOSTNAME: 'localhost',
    FASTLY_SERVICE_VERSION: '0',
    // `missing` is undefined, so it is dropped from the JSON report.
    missingKind: 'undefined',
    hasHostname: true,
  },
  acls: {
    ...expectedLookup('Acl'),
    lookupBlocked: { value: 'BLOCK' },
    lookupUnlisted: { value: null },
  },
  backends: {
    ...expectedLookup('Backend'),
    name: { value: 'origin' },
    target: { value: '127.0.0.1' },
  },
  configStores: {
    ...expectedLookup('ConfigStore'),
    get: { value: 'hello' },
    getMissingKey: { value: null },
  },
  kvStores: {
    ...expectedLookup('KVStore'),
    get: { value: 'kv-value' },
    getMissingKey: { value: null },
  },
  loggers: {
    present: 'Logger',
    presentIsCached: true,
    log: { value: true },
  },
  secretStores: {
    ...expectedLookup('SecretStore'),
    matches: { value: true },
    getMissingKey: { value: null },
  },
  proxy: {
    aclIsSame: true,
    originIsSame: true,
    renamedOriginName: { value: 'origin-renamed' },
    configIsSame: true,
    hostname: 'localhost',
    kvIsSame: true,
    logIsSame: true,
    secretsIsSame: true,
    missingBackend: 'undefined',
    hasOrigin: true,
    hasMissingBackend: false,
  },
  proxyOn: {
    origin: 'Backend',
    missingBackend: 'target-fallback',
    extra: 'target-extra',
  },
};

for (const version of SDK_VERSIONS) {
  describe(`integration with @fastly/js-compute@${version}`, () => {
    const dir = sdkWorkDir(version);
    const wasm = join(dir, 'bin', 'main.wasm');
    let proc: ChildProcess | undefined;
    let output = '';
    let report: Record<string, unknown>;

    before(async () => {
      if (!existsSync(wasm)) {
        throw new Error(`${wasm} not found. Run "npm run test:integration" to build it first.`);
      }
      const port = await getFreePort();
      const url = `http://127.0.0.1:${port}/`;
      proc = spawn(
        fastlyCli,
        ['compute', 'serve', '--skip-build', '--file', wasm, '--addr', `127.0.0.1:${port}`],
        // Own process group, so the CLI and the Viceroy process it spawns can be stopped together.
        { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], detached: true },
      );
      proc.stdout?.on('data', (chunk) => { output += chunk; });
      proc.stderr?.on('data', (chunk) => { output += chunk; });
      await waitForServer(url, proc, () => output);

      const res = await fetch(url);
      assert.equal(res.status, 200);
      report = await res.json() as Record<string, unknown>;
    }, { timeout: 90_000 });

    after(() => {
      // Kept for debugging failures
      writeFileSync(join(dir, 'serve.log'), output);
      if (proc?.pid != null && proc.exitCode == null) {
        process.kill(-proc.pid, 'SIGTERM');
      }
    });

    for (const section of Object.keys(expectedReport) as (keyof typeof expectedReport)[]) {
      it(section, () => {
        assert.deepEqual(report[section], expectedReport[section]);
      });
    }
  });
}
