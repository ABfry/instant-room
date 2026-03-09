# Contributing to instant-room

Thank you for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/ABfry/instant-room.git
cd instant-room
npm install
```

**Requirements:** Node.js 22

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build with tsup |
| `npm test` | Run tests (vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run lint` | Lint source files (eslint) |
| `npm run format` | Format source and test files (prettier) |
| `npm run typecheck` | Type-check with tsc |

## Before Submitting a PR

Make sure all checks pass locally:

```bash
npm run typecheck
npm run lint
npm test
```

These same checks run in CI on every pull request.

## Branch Naming

Use the following format:

```
feature/<issue-number>-<short-description>
```

Examples: `feature/1-domain-types-errors-url`, `feature/14-license`

## Commit Messages

This project follows [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>: <description>
```

**Types:**

- `feat` — new feature
- `fix` — bug fix
- `docs` — documentation only
- `test` — adding or updating tests
- `refactor` — code change that neither fixes a bug nor adds a feature
- `chore` — tooling, config, dependencies
- `ci` — CI/CD changes

**Examples:**

```
feat: add RoomId value object with validation
fix: validate length parameter in RoomId.generate()
docs: add MIT LICENSE file
test: add RoomId tests for generate, from, buildUrl, equals
ci: Add CI workflow and fix build config issues
```

## Pull Request Workflow

1. Create an issue (or pick an existing one)
2. Create a branch from `main` following the naming convention above
3. Make your changes and commit using Conventional Commits
4. Push and open a pull request using the PR template
5. Reference the related issue (e.g. `Closes #3`)
6. Wait for CI to pass and a review

## Code Style

- TypeScript strict mode
- Prettier: no semicolons, single quotes, trailing commas, 80 char line width, 2 space indent
- ESLint: `no-explicit-any` is an error, unused vars prefixed with `_` are allowed
