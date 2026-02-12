import type { Feature } from '../entities/index.js';

export interface StepCountSummary {
  totalSteps: number;
  featureCount: number;
}

export interface IFeatureRepository {
  findAll(): Promise<Feature[]>;
  findByNode(nodeId: string): Promise<Feature[]>;
  findByNodeAndVersion(nodeId: string, version: string): Promise<Feature[]>;
  getStepCountSummary(nodeId: string, version: string): Promise<StepCountSummary>;
  save(feature: Feature): Promise<void>;
  deleteAll(): Promise<void>;
  deleteByNode(nodeId: string): Promise<void>;
  deleteByNodeAndFilename(nodeId: string, filename: string): Promise<boolean>;
}
