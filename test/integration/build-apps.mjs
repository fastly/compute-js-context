/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

// Compiles the integration test app once per supported @fastly/js-compute major
// version. Expects the library to already be built into ./build.

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SDK_VERSIONS } from './sdk-versions.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const appDir = join(root, 'test/integration/app');

mkdirSync(join(appDir, 'bin'), { recursive: true });

for (const { name, packageDir } of SDK_VERSIONS) {
  const cli = join(root, 'node_modules', packageDir, 'dist/cli/js-compute-runtime-cli.js');
  const output = join(appDir, 'bin', `app-${name}.wasm`);
  console.log(`Building integration app with ${packageDir} -> ${output}`);
  execFileSync(process.execPath, [cli, join(appDir, 'index.js'), output], { stdio: 'inherit' });
}
