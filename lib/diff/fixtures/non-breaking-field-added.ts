import { OpenAPIObject } from 'openapi3-ts/oas30';

/**
 * Fixture: Optional field added to request payload.
 * Scenario: Old spec requires 'name' and 'email' for creating a user.
 * New spec adds an optional 'bio' field (not in required array).
 * Expected result: 1 non-breaking change with changeType 'field-added', 0 breaking changes.
 */
export const oldSpec: OpenAPIObject = {
  openapi: '3.0.0',
  info: {
    title: 'User Service API',
    version: '1.0.0',
    description: 'Original spec with name and email fields',
  },
  paths: {
    '/api/users': {
      post: {
        summary: 'Create user',
        operationId: 'createUser',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                },
                required: ['name', 'email'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'User created successfully',
          },
        },
      },
    },
  },
};

export const newSpec: OpenAPIObject = {
  openapi: '3.0.0',
  info: {
    title: 'User Service API',
    version: '1.1.0',
    description: 'Updated spec with optional bio field added',
  },
  paths: {
    '/api/users': {
      post: {
        summary: 'Create user',
        operationId: 'createUser',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  bio: { type: 'string' },
                },
                required: ['name', 'email'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'User created successfully',
          },
        },
      },
    },
  },
};
