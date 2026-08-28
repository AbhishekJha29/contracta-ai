import { OpenAPIObject } from 'openapi3-ts/oas30';

/**
 * Fixture: Whole endpoint removed.
 * Scenario: Old spec defines /api/users (GET, POST) and /api/products (GET, POST).
 * New spec removes the entire /api/products endpoint.
 * Expected result: 2 breaking changes with changeType 'endpoint-removed'.
 */
export const oldSpec: OpenAPIObject = {
  openapi: '3.0.0',
  info: {
    title: 'Store API',
    version: '1.0.0',
    description: 'Original spec with users and products endpoints',
  },
  paths: {
    '/api/users': {
      get: {
        summary: 'List users',
        responses: {
          '200': { description: 'Success' },
        },
      },
      post: {
        summary: 'Create user',
        responses: {
          '201': { description: 'Created' },
        },
      },
    },
    '/api/products': {
      get: {
        summary: 'List products',
        responses: {
          '200': { description: 'Success' },
        },
      },
      post: {
        summary: 'Create product',
        responses: {
          '201': { description: 'Created' },
        },
      },
    },
  },
};

export const newSpec: OpenAPIObject = {
  openapi: '3.0.0',
  info: {
    title: 'Store API',
    version: '2.0.0',
    description: 'Updated spec with /api/products removed',
  },
  paths: {
    '/api/users': {
      get: {
        summary: 'List users',
        responses: {
          '200': { description: 'Success' },
        },
      },
      post: {
        summary: 'Create user',
        responses: {
          '201': { description: 'Created' },
        },
      },
    },
  },
};
