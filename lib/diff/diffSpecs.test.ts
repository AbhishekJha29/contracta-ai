import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { diffSpecs } from './diffSpecs';
import { formatDiff } from './formatDiff';
import { oldSpec as oldFieldRemoved, newSpec as newFieldRemoved } from './fixtures/breaking-field-removed';
import { oldSpec as oldEndpointRemoved, newSpec as newEndpointRemoved } from './fixtures/breaking-endpoint-removed';
import { oldSpec as oldFieldAdded, newSpec as newFieldAdded } from './fixtures/non-breaking-field-added';
import { OpenAPIObject } from 'openapi3-ts/oas30';

describe('OpenAPI Diffing Engine (diffSpecs)', () => {
  describe('Fixture Scenarios', () => {
    it('1. breaking-field-removed: correctly produces severity: "breaking" and changeType: "required-field-removed"', () => {
      const diffs = diffSpecs(oldFieldRemoved, newFieldRemoved);
      expect(diffs.length).toBeGreaterThan(0);

      const emailRemoval = diffs.find(
        (d) => d.changeType === 'required-field-removed' && d.description.includes('email')
      );
      expect(emailRemoval).toBeDefined();
      expect(emailRemoval?.severity).toBe('breaking');
      expect(emailRemoval?.method).toBe('POST');
      expect(emailRemoval?.path).toBe('/api/users');
    });

    it('2. breaking-endpoint-removed: correctly produces severity: "breaking" and changeType: "endpoint-removed"', () => {
      const diffs = diffSpecs(oldEndpointRemoved, newEndpointRemoved);
      expect(diffs.length).toBe(2);

      for (const diff of diffs) {
        expect(diff.severity).toBe('breaking');
        expect(diff.changeType).toBe('endpoint-removed');
        expect(diff.path).toBe('/api/products');
      }

      const methods = diffs.map((d) => d.method).sort();
      expect(methods).toEqual(['GET', 'POST']);
    });

    it('3. non-breaking-field-added: correctly produces severity: "non-breaking" and is NOT flagged breaking', () => {
      const diffs = diffSpecs(oldFieldAdded, newFieldAdded);
      expect(diffs.length).toBe(1);

      const fieldAdded = diffs[0];
      expect(fieldAdded.severity).toBe('non-breaking');
      expect(fieldAdded.changeType).toBe('field-added');
      expect(fieldAdded.description).toContain('bio');

      const breakingDiffs = diffs.filter((d) => d.severity === 'breaking');
      expect(breakingDiffs).toHaveLength(0);
    });
  });

  describe('Core Diffing Rules', () => {
    it('Rule: Endpoint added is non-breaking', () => {
      const oldSpec: OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/v1/users': {
            get: { responses: { '200': { description: 'OK' } } },
          },
        },
      };

      const newSpec: OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/v1/users': {
            get: { responses: { '200': { description: 'OK' } } },
          },
          '/api/v1/reports': {
            post: { responses: { '201': { description: 'Created' } } },
          },
        },
      };

      const diffs = diffSpecs(oldSpec, newSpec);
      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toEqual(
        expect.objectContaining({
          severity: 'non-breaking',
          method: 'POST',
          path: '/api/v1/reports',
          changeType: 'endpoint-added',
        })
      );
    });

    it('Rule: Field type changed is breaking', () => {
      const oldSpec: OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/profile': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        age: { type: 'integer' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const newSpec: OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/profile': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        age: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const diffs = diffSpecs(oldSpec, newSpec);
      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toEqual(
        expect.objectContaining({
          severity: 'breaking',
          method: 'POST',
          path: '/api/profile',
          changeType: 'field-type-changed',
          oldValue: 'integer',
          newValue: 'string',
        })
      );
    });

    it('Rule: Enum values removed is breaking, expanded is non-breaking', () => {
      const baseSpec = (enumList: string[]): OpenAPIObject => ({
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/orders': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', enum: enumList },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      });

      // Removal of enum value
      const diffsRemoved = diffSpecs(
        baseSpec(['active', 'pending', 'cancelled']),
        baseSpec(['active', 'pending'])
      );
      expect(diffsRemoved).toHaveLength(1);
      expect(diffsRemoved[0].severity).toBe('breaking');
      expect(diffsRemoved[0].changeType).toBe('field-type-changed');
      expect(diffsRemoved[0].description).toContain('cancelled');

      // Expansion of enum values
      const diffsExpanded = diffSpecs(
        baseSpec(['active', 'pending']),
        baseSpec(['active', 'pending', 'archived'])
      );
      expect(diffsExpanded).toHaveLength(1);
      expect(diffsExpanded[0].severity).toBe('non-breaking');
    });

    it('Rule: New required field with no default is breaking, with default is non-breaking', () => {
      const oldSpec: OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/accounts': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                      },
                      required: ['name'],
                    },
                  },
                },
              },
              responses: { '201': { description: 'Created' } },
            },
          },
        },
      };

      // Case A: New required field without default -> BREAKING
      const newSpecNoDefault: OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/accounts': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        organizationId: { type: 'string' },
                      },
                      required: ['name', 'organizationId'],
                    },
                  },
                },
              },
              responses: { '201': { description: 'Created' } },
            },
          },
        },
      };

      const diffsNoDefault = diffSpecs(oldSpec, newSpecNoDefault);
      expect(diffsNoDefault).toHaveLength(1);
      expect(diffsNoDefault[0].severity).toBe('breaking');
      expect(diffsNoDefault[0].changeType).toBe('required-field-added');
      expect(diffsNoDefault[0].description).toContain('organizationId');

      // Case B: New required field with default -> NON-BREAKING
      const newSpecWithDefault: OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/accounts': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        role: { type: 'string', default: 'member' },
                      },
                      required: ['name', 'role'],
                    },
                  },
                },
              },
              responses: { '201': { description: 'Created' } },
            },
          },
        },
      };

      const diffsWithDefault = diffSpecs(oldSpec, newSpecWithDefault);
      expect(diffsWithDefault).toHaveLength(1);
      expect(diffsWithDefault[0].severity).toBe('non-breaking');
      expect(diffsWithDefault[0].changeType).toBe('field-added');
    });

    it('Rule: Auth added is breaking', () => {
      const oldSpec: OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/documents': {
            get: {
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const newSpec: OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/documents': {
            get: {
              security: [{ bearerAuth: [] }],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const diffs = diffSpecs(oldSpec, newSpec);
      expect(diffs).toHaveLength(1);
      expect(diffs[0].severity).toBe('breaking');
      expect(diffs[0].changeType).toBe('auth-added');
      expect(diffs[0].method).toBe('GET');
      expect(diffs[0].path).toBe('/api/documents');
    });

    it('Rule: Auth removed is non-breaking (security weakened)', () => {
      const oldSpec: OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/documents': {
            get: {
              security: [{ bearerAuth: [] }],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const newSpec: OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/documents': {
            get: {
              security: [],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const diffs = diffSpecs(oldSpec, newSpec);
      expect(diffs).toHaveLength(1);
      expect(diffs[0].severity).toBe('non-breaking');
      expect(diffs[0].changeType).toBe('auth-removed');
      expect(diffs[0].description).toContain('security weakened');
    });

    it('Rule: Path param removed is breaking, required param added is breaking, optional param added is non-breaking', () => {
      // 1. Path param removed
      const oldWithParam: OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/items/{id}': {
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            get: { responses: { '200': { description: 'OK' } } },
          },
        },
      };

      const newWithoutParam: OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/items/{id}': {
            parameters: [],
            get: { responses: { '200': { description: 'OK' } } },
          },
        },
      };

      const diffsRemoved = diffSpecs(oldWithParam, newWithoutParam);
      expect(diffsRemoved).toHaveLength(1);
      expect(diffsRemoved[0].severity).toBe('breaking');
      expect(diffsRemoved[0].changeType).toBe('required-field-removed');

      // 2. Optional query param added
      const newWithOptionalQuery: OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/items/{id}': {
            parameters: [
              { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
              { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } },
            ],
            get: { responses: { '200': { description: 'OK' } } },
          },
        },
      };

      const diffsOptionalAdded = diffSpecs(oldWithParam, newWithOptionalQuery);
      expect(diffsOptionalAdded).toHaveLength(1);
      expect(diffsOptionalAdded[0].severity).toBe('non-breaking');
      expect(diffsOptionalAdded[0].changeType).toBe('field-added');

      // 3. Required query param added without default
      const newWithRequiredQuery: OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/items/{id}': {
            parameters: [
              { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
              { name: 'apiKey', in: 'query', required: true, schema: { type: 'string' } },
            ],
            get: { responses: { '200': { description: 'OK' } } },
          },
        },
      };

      const diffsRequiredAdded = diffSpecs(oldWithParam, newWithRequiredQuery);
      expect(diffsRequiredAdded).toHaveLength(1);
      expect(diffsRequiredAdded[0].severity).toBe('breaking');
      expect(diffsRequiredAdded[0].changeType).toBe('required-field-added');
    });
  });

  describe('Self-Diff Verification (Zero False Positives)', () => {
    it('returns an empty array when diffing Phase 2 openapi.json against itself', () => {
      const openapiPath = join(process.cwd(), 'openapi.json');
      if (existsSync(openapiPath)) {
        const specContent = JSON.parse(readFileSync(openapiPath, 'utf8')) as OpenAPIObject;
        const diffs = diffSpecs(specContent, specContent);
        expect(diffs).toEqual([]);
      } else {
        // Fallback test case if running from different directory
        const sampleSpec: OpenAPIObject = {
          openapi: '3.0.0',
          info: { title: 'Sample API', version: '1.0.0' },
          paths: {
            '/api/users': {
              get: { responses: { '200': { description: 'OK' } } },
            },
          },
        };
        expect(diffSpecs(sampleSpec, sampleSpec)).toEqual([]);
      }
    });
  });

  describe('Markdown Formatter (formatDiff)', () => {
    it('formats empty diffs into a clean compatibility badge', () => {
      const md = formatDiff([]);
      expect(md).toContain('No API contract changes detected');
      expect(md).toContain('backwards-compatible');
    });

    it('formats mixed diffs with breaking changes first and non-breaking changes second', () => {
      const diffs = [
        {
          severity: 'non-breaking' as const,
          method: 'GET',
          path: '/api/v1/search',
          changeType: 'endpoint-added',
          description: 'Endpoint GET /api/v1/search was added',
        },
        {
          severity: 'breaking' as const,
          method: 'DELETE',
          path: '/api/v1/users/{id}',
          changeType: 'endpoint-removed',
          description: 'Endpoint DELETE /api/v1/users/{id} was removed',
        },
      ];

      const md = formatDiff(diffs);
      expect(md).toContain('Breaking Changes (1)');
      expect(md).toContain('Non-Breaking Changes (1)');

      const breakingIndex = md.indexOf('Breaking Changes');
      const nonBreakingIndex = md.indexOf('Non-Breaking Changes');
      expect(breakingIndex).toBeLessThan(nonBreakingIndex);

      expect(md).toContain('| `DELETE` | `/api/v1/users/{id}` | `endpoint-removed` |');
      expect(md).toContain('| `GET` | `/api/v1/search` | `endpoint-added` |');
      expect(md).toContain('Impact & Remediation Guidance');
    });
  });
});
