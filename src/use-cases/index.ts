export type { CreateComponentInput } from './create-component.js';
export { CreateComponent } from './create-component.js';
export { DeleteComponent } from './delete-component.js';
export { ExportArchitecture } from './export-architecture.js';
export type { ArchitectureData, EnrichedNode, ProgressionTree } from './get-architecture.js';
export { GetArchitecture } from './get-architecture.js';
export type { FeatureFileInput } from './seed-features.js';
export { SeedFeatures } from './seed-features.js';
export { UpdateProgress } from './update-progress.js';
export type { UploadFeatureInput, UploadFeatureResult } from './upload-feature.js';
export { UploadFeature } from './upload-feature.js';

// Re-export domain repository interfaces for adapter-layer consumption.
// Adapters cannot import domain directly (boundary rule), so use-cases
// re-exports these interfaces to enable typed dependency injection.
export type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
  NodeType,
  VersionStatus,
} from '../domain/index.js';
