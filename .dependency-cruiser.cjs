/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make code hard to reason about and test.',
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: 'no-domain-to-infrastructure',
      severity: 'error',
      comment: 'Clean Architecture: domain layer must not import from infrastructure.',
      from: { path: '^src/domain' },
      to: { path: '^src/infrastructure' },
    },
    {
      name: 'no-domain-to-adapters',
      severity: 'error',
      comment: 'Clean Architecture: domain layer must not import from adapters.',
      from: { path: '^src/domain' },
      to: { path: '^src/adapters' },
    },
    {
      name: 'no-domain-to-use-cases',
      severity: 'error',
      comment: 'Clean Architecture: domain layer must not import from use-cases.',
      from: { path: '^src/domain' },
      to: { path: '^src/use-cases' },
    },
    {
      name: 'no-use-cases-to-infrastructure',
      severity: 'error',
      comment: 'Clean Architecture: use-cases layer must not import from infrastructure.',
      from: { path: '^src/use-cases' },
      to: { path: '^src/infrastructure' },
    },
    {
      name: 'no-use-cases-to-adapters',
      severity: 'error',
      comment: 'Clean Architecture: use-cases layer must not import from adapters.',
      from: { path: '^src/use-cases' },
      to: { path: '^src/adapters' },
    },
    {
      name: 'no-infrastructure-to-use-cases',
      severity: 'error',
      comment: 'Clean Architecture: infrastructure layer must not import from use-cases.',
      from: { path: '^src/infrastructure' },
      to: { path: '^src/use-cases' },
    },
    {
      name: 'no-infrastructure-to-adapters',
      severity: 'error',
      comment: 'Clean Architecture: infrastructure layer must not import from adapters.',
      from: { path: '^src/infrastructure' },
      to: { path: '^src/adapters' },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
