import type { Edge } from '../entities/index.js';

export interface IEdgeRepository {
  findAll(): Promise<Edge[]>;
  findById(id: number): Promise<Edge | null>;
  findBySource(sourceId: string): Promise<Edge[]>;
  findByTarget(targetId: string): Promise<Edge[]>;
  findByType(type: string): Promise<Edge[]>;
  findRelationships(): Promise<Edge[]>;
  existsBySrcTgtType(sourceId: string, targetId: string, type: string): Promise<boolean>;
  save(edge: Edge): Promise<Edge>;
  delete(id: number): Promise<void>;
}
