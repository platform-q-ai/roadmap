import type { INodeRepository } from '../domain/index.js';
import { Node } from '../domain/index.js';

import { NodeExistsError, ValidationError } from './errors.js';

export interface CreateLayerInput {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  description?: string;
  sort_order?: number;
}

interface Deps {
  nodeRepo: INodeRepository;
}

const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const MAX_ID_LENGTH = 64;

/**
 * Create a new layer node.
 */
export class CreateLayer {
  private readonly nodeRepo: INodeRepository;

  constructor({ nodeRepo }: Deps) {
    this.nodeRepo = nodeRepo;
  }

  async execute(input: CreateLayerInput): Promise<Node> {
    this.validate(input);

    const exists = await this.nodeRepo.exists(input.id);
    if (exists) {
      throw new NodeExistsError(input.id);
    }

    const layer = new Node({
      id: input.id,
      name: input.name,
      type: 'layer',
      color: input.color ?? null,
      icon: input.icon ?? null,
      description: input.description ?? null,
      sort_order: input.sort_order ?? 0,
    });

    await this.nodeRepo.save(layer);
    return layer;
  }

  private validate(input: CreateLayerInput): void {
    if (!input.name) {
      throw new ValidationError('Invalid name: name must not be empty');
    }
    if (input.id.length > MAX_ID_LENGTH) {
      throw new ValidationError(`Invalid id: must be ${MAX_ID_LENGTH} characters or fewer`);
    }
    if (!KEBAB_CASE_RE.test(input.id)) {
      throw new ValidationError(`Invalid id format: must be kebab-case (got "${input.id}")`);
    }
  }
}
