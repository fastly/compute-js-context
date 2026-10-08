/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

// The @fastly/js-compute versions the integration tests run against.
// Each must be installed as a devDependency (older majors via npm aliases).
export const SDK_VERSIONS = [
  { name: 'v3', packageDir: 'js-compute-v3' },
  { name: 'v4', packageDir: '@fastly/js-compute' },
];
