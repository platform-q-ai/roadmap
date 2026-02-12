import type { Edge } from '../entities/index.js';

export interface IEdgeRepository {
  findAll(): Promise<Edge[]>;
  findBySource(sourceId: string): Promise<Edge[]>;
  findByTarget(targetId: string): Promise<Edge[]>;
  findByType(type: string): Promise<Edge[]>;
  findRelationships(): Promise<Edge[]>;
  save(edge: Edge): Promise<void>;
  delete(id: number): Promise<void>;
}
