import type {
  IEdgeRepository,
  INodeRepository,
  IVersionRepository,
  NodeType,
} from '../domain/index.js';
import { Edge, Node, Version } from '../domain/index.js';

import { ValidationError } from '../domain/errors.js';
import { NodeExistsError, NodeTypeError } from './errors.js';

export interface CreateComponentInput {
  id: string;
  name: string;
  type: NodeType;
  layer?: string;
  description?: string;
  tags?: string[];
  color?: string;
  icon?: string;
  sort_order?: number;
}

interface Deps {
  nodeRepo: INodeRepository;
  edgeRepo: IEdgeRepository;
  versionRepo: IVersionRepository;
}

/**
 * CreateComponent use case.
 *
 * Creates a new component node with a CONTAINS edge from its layer,
 * and generates default version entries (overview, mvp, v1, v2).
 */
export class CreateComponent {
  private readonly nodeRepo: INodeRepository;
  private readonly edgeRepo: IEdgeRepository;
  private readonly versionRepo: IVersionRepository;

  constructor({ nodeRepo, edgeRepo, versionRepo }: Deps) {
    this.nodeRepo = nodeRepo;
    this.edgeRepo = edgeRepo;
    this.versionRepo = versionRepo;
  }

  async execute(input: CreateComponentInput): Promise<Node> {
    await this.validate(input);

    const node = new Node({
      id: input.id,
      name: input.name,
      type: input.type,
      layer: this.hasLayer(input) ? input.layer : null,
      description: input.description ?? null,
      tags: input.tags ?? [],
      color: input.color ?? null,
      icon: input.icon ?? null,
      sort_order: input.sort_order ?? 0,
    });

    await this.nodeRepo.save(node);
    await Promise.all([this.createContainsEdge(input), this.createDefaultVersions(input.id)]);

    return node;
  }

  private hasLayer(input: CreateComponentInput): input is CreateComponentInput & { layer: string } {
    return typeof input.layer === 'string' && input.layer.length > 0;
  }

  private async validate(input: CreateComponentInput): Promise<void> {
    if (!Node.TYPES.includes(input.type)) {
      throw new NodeTypeError(input.type);
    }
    if (this.hasLayer(input)) {
      const layerNode = await this.nodeRepo.findById(input.layer);
      if (!layerNode) {
        throw new ValidationError(`Invalid layer: ${input.layer} does not exist`);
      }
    }
    const exists = await this.nodeRepo.exists(input.id);
    if (exists) {
      throw new NodeExistsError(input.id);
    }
  }

  private async createContainsEdge(input: CreateComponentInput): Promise<void> {
    if (!this.hasLayer(input)) {
      return;
    }
    const containsEdge = new Edge({
      source_id: input.layer,
      target_id: input.id,
      type: 'CONTAINS',
    });
    await this.edgeRepo.save(containsEdge);
  }

  private async createDefaultVersions(nodeId: string): Promise<void> {
    for (const ver of Version.VERSIONS) {
      const version = new Version({
        node_id: nodeId,
        version: ver,
        content: '',
        progress: 0,
        status: 'planned',
      });
      await this.versionRepo.save(version);
    }
  }
}
