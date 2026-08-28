import { OpenAPIObject } from 'openapi3-ts/oas30';

/**
 * Fixture: Required field removed from request payload.
 * Scenario: Old spec requires 'name' and 'email' for creating a user.
 * New spec removes 'email' from the schema entirely.
 * Expected result: 1 breaking change with changeType 'required-field-removed'.
 */
export const oldSpec: OpenAPIObject = {
  openapi: '3.0.0',
  info: {
    title: 'User Service API',
    version: '1.0.0',
    description: 'Original spec with required email field',
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
    description: 'Updated spec where required email field was removed',
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
                },
                required: ['name'],
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
