export type { CreateComponentInput } from './create-component.js';
export { CreateComponent } from './create-component.js';
export type { CreateEdgeInput } from './create-edge.js';
export { CreateEdge } from './create-edge.js';
export { DeleteComponent } from './delete-component.js';
export { DeleteEdge } from './delete-edge.js';
export { DeleteFeature } from './delete-feature.js';
export {
  EdgeExistsError,
  EdgeNotFoundError,
  FeatureNotFoundError,
  NodeExistsError,
  NodeNotFoundError,
  NodeTypeError,
  ValidationError,
} from './errors.js';
export { ExportArchitecture } from './export-architecture.js';
export type { GenerateApiKeyInput, GenerateApiKeyResult } from './generate-api-key.js';
export { GenerateApiKey, hashKey } from './generate-api-key.js';
export type {
  ArchitectureData,
  EnrichedNode,
  ExecuteOptions,
  ProgressionTree,
} from './get-architecture.js';
export { GetArchitecture } from './get-architecture.js';
export type { StepTotalsResult } from './get-step-totals.js';
export { GetStepTotals } from './get-step-totals.js';
export { ListApiKeys } from './list-api-keys.js';
export { RevokeApiKey } from './revoke-api-key.js';
export type { FeatureFileInput } from './seed-features.js';
export { SeedFeatures } from './seed-features.js';
export type { UpdateComponentInput } from './update-component.js';
export { UpdateComponent } from './update-component.js';
export type { UpdateVersionInput, UpdateVersionResult } from './update-version.js';
export { UpdateVersion } from './update-version.js';
export type { UploadFeatureInput, UploadFeatureResult } from './upload-feature.js';
export { UploadFeature } from './upload-feature.js';
export type { ValidateResult } from './validate-api-key.js';
export { ValidateApiKey } from './validate-api-key.js';

// Re-export domain types, interfaces, and constants for adapter-layer consumption.
// Adapters cannot import domain directly (boundary rule), so use-cases
// re-exports these to enable typed dependency injection and validation.
export type {
  ApiKeyScope,
  IApiKeyRepository,
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
  NodeType,
  VersionStatus,
} from '../domain/index.js';
export { Edge, Node } from '../domain/index.js';

import { Node as _Node } from '../domain/index.js';
/** Canonical list of valid node types, sourced from the domain entity. */
export const VALID_NODE_TYPES: readonly string[] = _Node.TYPES;
