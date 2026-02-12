import type { IEdgeRepository, INodeRepository } from '../domain/index.js';
import { Edge } from '../domain/index.js';

import { EdgeExistsError, ValidationError } from './errors.js';

export interface CreateEdgeInput {
  source_id: string;
  target_id: string;
  type: string;
  label?: string;
  metadata?: string;
}

interface Deps {
  nodeRepo: INodeRepository;
  edgeRepo: IEdgeRepository;
}

/**
 * CreateEdge use case.
 *
 * Validates source/target existence, edge type, self-reference,
 * and duplicate detection before persisting a new edge.
 */
export class CreateEdge {
  private readonly nodeRepo: INodeRepository;
  private readonly edgeRepo: IEdgeRepository;

  constructor({ nodeRepo, edgeRepo }: Deps) {
    this.nodeRepo = nodeRepo;
    this.edgeRepo = edgeRepo;
  }

  async execute(input: CreateEdgeInput): Promise<Edge> {
    const validTypes = Edge.TYPES as readonly string[];
    if (!validTypes.includes(input.type)) {
      throw new ValidationError(`Invalid edge type: ${input.type}`);
    }

    if (input.source_id === input.target_id) {
      throw new ValidationError('Self-referencing edges are not allowed');
    }

    const [sourceExists, targetExists] = await Promise.all([
      this.nodeRepo.exists(input.source_id),
      this.nodeRepo.exists(input.target_id),
    ]);
    if (!sourceExists) {
      throw new ValidationError(`Invalid source: node "${input.source_id}" does not exist`);
    }
    if (!targetExists) {
      throw new ValidationError(`Invalid target: node "${input.target_id}" does not exist`);
    }

    const duplicate = await this.edgeRepo.existsBySrcTgtType(
      input.source_id,
      input.target_id,
      input.type
    );
    if (duplicate) {
      throw new EdgeExistsError(input.source_id, input.target_id, input.type);
    }

    const edge = new Edge({
      source_id: input.source_id,
      target_id: input.target_id,
      type: input.type as Edge['type'],
      label: input.label ?? null,
      metadata: input.metadata ?? null,
    });

    return this.edgeRepo.save(edge);
  }
}
