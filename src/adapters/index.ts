// CLI adapters are standalone entry points and do not export modules.
// API adapter exports:
export { buildRoutes, createApp } from './api/index.js';
export type { ApiDeps } from './api/index.js';
