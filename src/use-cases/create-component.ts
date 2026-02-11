import type {
  IEdgeRepository,
  INodeRepository,
  IVersionRepository,
  NodeType,
} from '../domain/index.js';
import { Edge, Node, Version } from '../domain/index.js';

export interface CreateComponentInput {
  id: string;
  name: string;
  type: NodeType;
  layer: string;
  description?: string;
  tags?: string[];
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

  async execute(input: CreateComponentInput): Promise<void> {
    const validTypes = Node.TYPES;
    if (!validTypes.includes(input.type)) {
      throw new NodeTypeError(input.type);
    }

    const exists = await this.nodeRepo.exists(input.id);
    if (exists) {
      throw new NodeExistsError(input.id);
    }

    const node = new Node({
      id: input.id,
      name: input.name,
      type: input.type,
      layer: input.layer,
      description: input.description ?? null,
      tags: input.tags ?? [],
    });

    await this.nodeRepo.save(node);

    const containsEdge = new Edge({
      source_id: input.layer,
      target_id: input.id,
      type: 'CONTAINS',
    });
    await this.edgeRepo.save(containsEdge);

    for (const ver of Version.VERSIONS) {
      const version = new Version({
        node_id: input.id,
        version: ver,
        content: '',
        progress: 0,
        status: 'planned',
      });
      await this.versionRepo.save(version);
    }
  }
}

class NodeTypeError extends Error {
  constructor(type: string) {
    super(`Invalid node type: ${type}`);
    this.name = 'NodeTypeError';
  }
}

class NodeExistsError extends Error {
  constructor(id: string) {
    super(`Node already exists: ${id}`);
    this.name = 'NodeExistsError';
  }
}
