import { ValidationError } from '../domain/errors.js';
import type { IEdgeRepository, INodeRepository } from '../domain/index.js';
import { Edge, Node } from '../domain/index.js';

import { NodeNotFoundError } from './errors.js';

interface Deps {
  nodeRepo: INodeRepository;
  edgeRepo: IEdgeRepository;
}

/**
 * Move a component to a different layer.
 * Re-wires the CONTAINS edge from old layer to new layer.
 */
export class MoveComponent {
  private readonly nodeRepo: INodeRepository;
  private readonly edgeRepo: IEdgeRepository;

  constructor({ nodeRepo, edgeRepo }: Deps) {
    this.nodeRepo = nodeRepo;
    this.edgeRepo = edgeRepo;
  }

  async execute(componentId: string, targetLayerId: string): Promise<Node> {
    const component = await this.nodeRepo.findById(componentId);
    if (!component) {
      throw new NodeNotFoundError(componentId);
    }

    const targetLayer = await this.nodeRepo.findById(targetLayerId);
    if (!targetLayer || !targetLayer.isLayer()) {
      throw new ValidationError(`Invalid layer: ${targetLayerId} is not a valid layer`);
    }

    // No-op when moving to the same layer
    if (component.layer === targetLayerId) {
      return component;
    }

    await this.rewireContainsEdge(component, targetLayerId);

    const moved = new Node({
      id: component.id,
      name: component.name,
      type: component.type,
      layer: targetLayerId,
      color: component.color,
      icon: component.icon,
      description: component.description,
      tags: component.tags,
      sort_order: component.sort_order,
      current_version: component.current_version,
    });

    await this.nodeRepo.save(moved);
    return moved;
  }

  private async rewireContainsEdge(component: Node, newLayerId: string): Promise<void> {
    const inboundEdges = await this.edgeRepo.findByTarget(component.id);
    const containsEdge = inboundEdges.find(e => e.type === 'CONTAINS');

    if (containsEdge && containsEdge.id !== undefined && containsEdge.id !== null) {
      await this.edgeRepo.delete(containsEdge.id);
    }

    await this.edgeRepo.save(
      new Edge({
        source_id: newLayerId,
        target_id: component.id,
        type: 'CONTAINS',
      })
    );
  }
}
