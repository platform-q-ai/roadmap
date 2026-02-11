import {
  edgesTable,
  featuresTable,
  nodesTable,
  nodeVersionsTable,
} from '@infrastructure/drizzle/schema.js';
import { describe, expect, it } from 'vitest';

describe('Drizzle Schema', () => {
  describe('nodesTable', () => {
    it('should be defined', () => {
      expect(nodesTable).toBeDefined();
    });

    it('should have all required columns', () => {
      const cols = nodesTable as Record<string, unknown>;
      expect(cols.id).toBeDefined();
      expect(cols.name).toBeDefined();
      expect(cols.type).toBeDefined();
      expect(cols.layer).toBeDefined();
      expect(cols.color).toBeDefined();
      expect(cols.icon).toBeDefined();
      expect(cols.description).toBeDefined();
      expect(cols.tags).toBeDefined();
      expect(cols.sort_order).toBeDefined();
      expect(cols.current_version).toBeDefined();
    });
  });

  describe('edgesTable', () => {
    it('should be defined', () => {
      expect(edgesTable).toBeDefined();
    });

    it('should have all required columns', () => {
      const cols = edgesTable as Record<string, unknown>;
      expect(cols.id).toBeDefined();
      expect(cols.source_id).toBeDefined();
      expect(cols.target_id).toBeDefined();
      expect(cols.type).toBeDefined();
      expect(cols.label).toBeDefined();
      expect(cols.metadata).toBeDefined();
    });
  });

  describe('nodeVersionsTable', () => {
    it('should be defined', () => {
      expect(nodeVersionsTable).toBeDefined();
    });

    it('should have all required columns', () => {
      const cols = nodeVersionsTable as Record<string, unknown>;
      expect(cols.id).toBeDefined();
      expect(cols.node_id).toBeDefined();
      expect(cols.version).toBeDefined();
      expect(cols.content).toBeDefined();
      expect(cols.progress).toBeDefined();
      expect(cols.status).toBeDefined();
      expect(cols.updated_at).toBeDefined();
    });
  });

  describe('featuresTable', () => {
    it('should be defined', () => {
      expect(featuresTable).toBeDefined();
    });

    it('should have all required columns', () => {
      const cols = featuresTable as Record<string, unknown>;
      expect(cols.id).toBeDefined();
      expect(cols.node_id).toBeDefined();
      expect(cols.version).toBeDefined();
      expect(cols.filename).toBeDefined();
      expect(cols.title).toBeDefined();
      expect(cols.content).toBeDefined();
      expect(cols.updated_at).toBeDefined();
    });
  });
});
