export type {
  BatchFeatureEntry,
  BatchFeatureError,
  BatchUploadInput,
  BatchUploadResult,
  CrossComponentBatchInput,
  CrossComponentFeatureEntry,
} from './batch-upload-features.js';
export { BatchUploadFeatures } from './batch-upload-features.js';
export type { CreateComponentInput } from './create-component.js';
export { CreateComponent } from './create-component.js';
export type { CreateEdgeInput } from './create-edge.js';
export { CreateEdge } from './create-edge.js';
export type { CreateLayerInput } from './create-layer.js';
export { CreateLayer } from './create-layer.js';
export { DeleteAllVersions } from './delete-all-versions.js';
export { DeleteComponent } from './delete-component.js';
export { DeleteEdge } from './delete-edge.js';
export { DeleteFeature } from './delete-feature.js';
export { DeleteFeatureVersionScoped } from './delete-feature-version-scoped.js';
export {
  EdgeExistsError,
  EdgeNotFoundError,
  FeatureNotFoundError,
  NodeExistsError,
  NodeNotFoundError,
  NodeTypeError,
  ValidationError,
  VersionNotFoundError,
} from './errors.js';
export { ExportArchitecture } from './export-architecture.js';
export type { ExportFeaturesResult } from './export-features.js';
export { ExportFeatures } from './export-features.js';
export type { GenerateApiKeyInput, GenerateApiKeyResult } from './generate-api-key.js';
export { GenerateApiKey, hashKey } from './generate-api-key.js';
export type {
  ArchitectureData,
  EnrichedNode,
  ExecuteOptions,
  ProgressionTree,
} from './get-architecture.js';
export { GetArchitecture } from './get-architecture.js';
export { GetComponentContext } from './get-component-context.js';
export { GetComponentsByStatus } from './get-components-by-status.js';
export { GetDependencyTree } from './get-dependency-tree.js';
export { GetDependents } from './get-dependents.js';
export { GetFeatureVersionScoped } from './get-feature-version-scoped.js';
export { GetImplementationOrder } from './get-implementation-order.js';
export { GetLayer } from './get-layer.js';
export { GetLayerOverview } from './get-layer-overview.js';
export { GetNeighbourhood } from './get-neighbourhood.js';
export { GetNextImplementable } from './get-next-implementable.js';
export { GetShortestPath } from './get-shortest-path.js';
export type { StepTotalsResult } from './get-step-totals.js';
export { GetStepTotals } from './get-step-totals.js';
export { GetVersion } from './get-version.js';
export { ListApiKeys } from './list-api-keys.js';
export { ListLayers } from './list-layers.js';
export type { VersionWithSteps } from './list-versions.js';
export { ListVersions } from './list-versions.js';
export { MoveComponent } from './move-component.js';
export { RevokeApiKey } from './revoke-api-key.js';
export type { SearchResult } from './search-features.js';
export { SearchFeatures } from './search-features.js';
export type { FeatureFileInput } from './seed-features.js';
export { SeedFeatures } from './seed-features.js';
export type { SeedFeaturesApiResult } from './seed-features-api.js';
export { SeedFeaturesApi } from './seed-features-api.js';
export type { UpdateComponentInput } from './update-component.js';
export { UpdateComponent } from './update-component.js';
export type { UpdateVersionInput, UpdateVersionResult } from './update-version.js';
export { UpdateVersion } from './update-version.js';
export type { UploadFeatureInput, UploadFeatureResult } from './upload-feature.js';
export { UploadFeature } from './upload-feature.js';
export type { ValidateResult } from './validate-api-key.js';
export { ValidateApiKey } from './validate-api-key.js';
export { GetComponentPosition } from './get-component-position.js';
export { SaveComponentPosition } from './save-component-position.js';
export { DeleteComponentPosition } from './delete-component-position.js';

// Re-export domain types, interfaces, and constants for adapter-layer consumption.
// Adapters cannot import domain directly (boundary rule), so use-cases
// re-exports these to enable typed dependency injection and validation.
export type {
  ApiKeyScope,
  ComponentPositionRepository,
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
