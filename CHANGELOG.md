# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased]

### Updated

- Build with TypeScript 7
- Tests use Node's built-in test runner (`node:test`) in place of Vitest
- Peer dependency is now `@fastly/js-compute` `^3.33.0 || ^4.0.0`: 3.32.x doesn't provide the `fastly:acl` type declarations that this package's types import
- Integration tests install the packed package, type-check against each SDK version's types, and also run against the minimum supported 3.x

### Fixed

- README: `ENV` returns `undefined` (not `''`) for an environment variable that isn't set, and its type is `Record<string, string | undefined>`
- README: heading for the `ContextProxy<T>` type (was `ContentProxy<T>`)

## [0.6.0] - 2026-10-08

### Updated

- Support `@fastly/js-compute` v4 (peer dependency is now `^3.32.0 || ^4.0.0`)

### Added

- Unit tests, and integration tests that run under Viceroy against both v3 and v4 of `@fastly/js-compute`

## [0.5.6] - 2026-02-13

### Updated

- Release to npmjs using updated CI workflow

## [0.5.5] - 2026-01-07

### Fixed

- Correct CI for GitHub packages

## [0.5.4] - 2026-01-07

### Added

- Release using CI

## [0.5.2] - 2025-10-16

### Fixed

- Updated README

## [0.5.1] - 2025-10-14

### Fixed

- Updated README

## [0.5.0] - 2025-10-14

### Changed

- BREAKING: Make build context proxy create the context internally

### Added

- Make proxy object possible to extend an existing object

## [0.4.2] - 2025-10-08

### Fixed

- Fix typing of Proxy when bindings are empty

## [0.4.1] - 2025-10-06

### Changed

- Moved to `@fastly` scope

## [0.2.0] - 2025-10-03

### Added

- Initial public release

[unreleased]: https://github.com/fastly/compute-js-context/compare/v0.5.6...HEAD
[0.5.6]: https://github.com/fastly/compute-js-context/compare/v0.5.5...v0.5.6
[0.5.5]: https://github.com/fastly/compute-js-context/compare/v0.5.4...v0.5.5
[0.5.4]: https://github.com/fastly/compute-js-context/compare/v0.5.2...v0.5.4
[0.5.2]: https://github.com/fastly/compute-js-context/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/fastly/compute-js-context/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/fastly/compute-js-context/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/fastly/compute-js-context/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/fastly/compute-js-context/compare/v0.2.0...v0.4.1
[0.2.0]: https://github.com/fastly/compute-js-context/releases/tag/v0.2.0
