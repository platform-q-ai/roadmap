import type { Node } from '../entities/node.js';

export interface INodeRepository {
  findAll(): Promise<Node[]>;
  findById(id: string): Promise<Node | null>;
  findByType(type: string): Promise<Node[]>;
  findByLayer(layerId: string): Promise<Node[]>;
  exists(id: string): Promise<boolean>;
  save(node: Node): Promise<void>;
  delete(id: string): Promise<void>;
}
