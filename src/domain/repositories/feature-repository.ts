import type { Feature } from '../entities/index.js';

export interface StepCountSummary {
  totalSteps: number;
  featureCount: number;
}

export interface IFeatureRepository {
  findAll(): Promise<Feature[]>;
  findByNode(nodeId: string): Promise<Feature[]>;
  findByNodeAndVersion(nodeId: string, version: string): Promise<Feature[]>;
  findByNodeVersionAndFilename(
    nodeId: string,
    version: string,
    filename: string
  ): Promise<Feature | null>;
  getStepCountSummary(nodeId: string, version: string): Promise<StepCountSummary>;
  save(feature: Feature): Promise<void>;
  saveMany(features: Feature[]): Promise<void>;
  deleteAll(): Promise<void>;
  deleteByNode(nodeId: string): Promise<void>;
  deleteByNodeAndFilename(nodeId: string, filename: string): Promise<boolean>;
  deleteByNodeAndVersionAndFilename(
    nodeId: string,
    version: string,
    filename: string
  ): Promise<boolean>;
  deleteByNodeAndVersion(nodeId: string, version: string): Promise<number>;
  search(query: string, version?: string, limit?: number): Promise<Feature[]>;
}
