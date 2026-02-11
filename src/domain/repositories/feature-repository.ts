import type { Feature } from '../entities/feature.js';

export interface IFeatureRepository {
  findAll(): Promise<Feature[]>;
  findByNode(nodeId: string): Promise<Feature[]>;
  findByNodeAndVersion(nodeId: string, version: string): Promise<Feature[]>;
  save(feature: Feature): Promise<void>;
  deleteAll(): Promise<void>;
  deleteByNode(nodeId: string): Promise<void>;
}
