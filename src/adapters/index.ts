// CLI adapters are standalone entry points and do not export modules.
// API adapter exports:
export type { ApiDeps, AppOptions } from './api/index.js';
export { buildRoutes, createApp } from './api/index.js';
