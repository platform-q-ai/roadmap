# Contributing to Roadmap

Thank you for considering contributing to this project! This guide explains
how to get started and what to expect when submitting changes.

## Getting Started

1. **Fork** the repository and clone your fork locally.
2. Run `npm install` to install dependencies.
3. Copy `.env.example` to `.env` and fill in your local values.
4. Run `npm test` to verify everything works before making changes.

## Development Workflow

This project follows **BDD red-to-green** development:

1. Write a Gherkin feature file in `features/`.
2. Add step definitions in `tests/step-definitions/`.
3. Write unit tests in `tests/unit/`.
4. Implement the minimum code to pass all tests.
5. Refactor while keeping tests green.

### Running Tests

```bash
npm run test:unit        # Vitest unit tests
npm run test:features    # Cucumber BDD scenarios
npm run lint             # ESLint + boundary checks
npm run typecheck        # TypeScript type checking
npm run pre-commit       # Full 7-gate pipeline
```

## Pull Requests

1. Create a feature branch from `master` (e.g. `feat/my-feature`).
2. Make your changes following the BDD workflow above.
3. Ensure `npm run pre-commit` passes with no errors.
4. Push your branch and open a pull request against `master`.
5. Fill in the PR template and describe what your change does and why.
6. Address any review feedback — all review threads must be resolved
   before merging.

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): add new feature
fix(scope): correct a bug
test(scope): add or update tests
docs(scope): update documentation
refactor(scope): restructure without changing behaviour
```

## Code Style

- TypeScript strict mode with no `any` types.
- Clean Architecture: dependencies point inward (see `AGENTS.md`).
- ESLint + Prettier enforced automatically.
- Every layer and subdirectory must have an `index.ts` barrel export.

## Reporting Bugs

Open a [GitHub issue](https://github.com/platform-q-ai/roadmap/issues/new)
with steps to reproduce, expected behaviour, and actual behaviour.

## Security Issues

Please report security vulnerabilities **privately** — see `SECURITY.md`.
