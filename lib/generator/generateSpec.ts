import { ParsedRoute, RequestBodyField } from '../parser/types';
import {
  OpenAPIObject,
  PathItemObject,
  OperationObject,
  SchemaObject,
  ParameterObject,
} from 'openapi3-ts/oas30';

export interface GeneratorOptions {
  title?: string;
  version?: string;
  description?: string;
}

/**
 * Converts Express route paths with parameters (:id) to OpenAPI template format ({id}).
 * e.g. /api/users/:id -> /api/users/{id}
 */
export function expressPathToOpenApiPath(expressPath: string): string {
  if (!expressPath) return '/';
  let formatted = expressPath.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
  if (!formatted.startsWith('/')) {
    formatted = '/' + formatted;
  }
  return formatted;
}

/**
 * Maps a parser type string (primitives, arrays, enums) to an OpenAPI 3.0 SchemaObject.
 */
export function mapTypeToOpenApiSchema(typeStr: string): SchemaObject {
  const trimmed = typeStr.trim();

  // 1. Enum / Union of string literals (e.g. "'admin' | 'user' | 'guest'")
  if (trimmed.includes('|') && (trimmed.includes("'") || trimmed.includes('"'))) {
    const enumValues = trimmed
      .split('|')
      .map((s) => s.trim().replace(/^['"`]|['"`]$/g, ''))
      .filter((v) => v.length > 0);

    return {
      type: 'string',
      enum: enumValues,
    };
  }

  // 2. Array type (e.g. "string[]", "number[]")
  if (trimmed.endsWith('[]')) {
    const itemType = trimmed.slice(0, -2);
    return {
      type: 'array',
      items: mapTypeToOpenApiSchema(itemType),
    };
  }

  if (trimmed === 'array') {
    return {
      type: 'array',
      items: { type: 'string' },
    };
  }

  // 3. Primitives & Built-in types
  switch (trimmed.toLowerCase()) {
    case 'string':
    case 'email':
    case 'url':
    case 'uuid':
      return { type: 'string' };
    case 'number':
    case 'int':
    case 'float':
    case 'double':
      return { type: 'number' };
    case 'integer':
    case 'bigint':
      return { type: 'integer' };
    case 'boolean':
      return { type: 'boolean' };
    case 'date':
    case 'datetime':
      return { type: 'string', format: 'date-time' };
    case 'object':
      return { type: 'object' };
    case 'any':
    case 'unknown':
      return { type: 'object' };
    default:
      return { type: 'string' };
  }
}

/**
 * Builds an OpenAPI SchemaObject for the request body from parsed fields.
 */
export function buildRequestBodySchema(fields: RequestBodyField[]): SchemaObject {
  const properties: Record<string, SchemaObject> = {};
  const requiredFields: string[] = [];

  for (const field of fields) {
    properties[field.field] = mapTypeToOpenApiSchema(field.type);
    if (field.required) {
      requiredFields.push(field.field);
    }
  }

  const schema: SchemaObject = {
    type: 'object',
    properties,
  };

  if (requiredFields.length > 0) {
    schema.required = requiredFields;
  }

  return schema;
}

/**
 * Extracts OpenAPI Path parameter objects from the formatted OpenAPI path template.
 */
export function extractPathParameters(
  openApiPath: string,
  paramsRecord?: Record<string, string>
): ParameterObject[] {
  const matches = openApiPath.match(/\{([a-zA-Z0-9_]+)\}/g);
  if (!matches || matches.length === 0) {
    return [];
  }

  const parameters: ParameterObject[] = [];
  for (const match of matches) {
    const paramName = match.slice(1, -1);
    const paramType = paramsRecord && paramsRecord[paramName] ? paramsRecord[paramName] : 'string';

    parameters.push({
      name: paramName,
      in: 'path',
      required: true,
      schema: mapTypeToOpenApiSchema(paramType),
      description: `Path parameter: ${paramName}`,
    });
  }

  return parameters;
}

/**
 * Generates an OpenAPI 3.0.0 document from an array of ParsedRoute items.
 */
export function generateSpec(
  routes: ParsedRoute[],
  meta?: GeneratorOptions
): OpenAPIObject {
  const title = meta?.title || 'Contracta API';
  const version = meta?.version || '1.0.0';
  const description = meta?.description || 'OpenAPI 3.0 specification generated automatically by Contracta.';

  const paths: Record<string, PathItemObject> = {};
  let anyRequiresAuth = false;

  for (const route of routes) {
    const openApiPath = expressPathToOpenApiPath(route.path);
    const method = route.method.toLowerCase();

    if (route.requiresAuth) {
      anyRequiresAuth = true;
    }

    if (!paths[openApiPath]) {
      paths[openApiPath] = {};
    }

    // NOTE: Known limitation - Phase 1 extracts route signatures and request schemas.
    // Generic placeholder responses (200/201/204) are generated since response shapes are not yet extracted.
    const responses: OperationObject['responses'] = {};
    if (method === 'post') {
      responses['201'] = {
        description: 'Resource created successfully',
        content: {
          'application/json': {
            schema: { type: 'object' },
          },
        },
      };
    } else if (method === 'delete') {
      responses['204'] = {
        description: 'Resource deleted successfully',
      };
    } else {
      responses['200'] = {
        description: 'Successful operation',
        content: {
          'application/json': {
            schema: { type: 'object' },
          },
        },
      };
    }

    const operation: OperationObject = {
      summary: `${route.method.toUpperCase()} ${openApiPath}`,
      operationId: `${method}_${openApiPath.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '')}`,
      responses,
    };

    // Add path parameters if present
    const pathParams = extractPathParameters(openApiPath, route.params);
    if (pathParams.length > 0) {
      operation.parameters = pathParams;
    }

    // Add request body if present
    if (route.requestBody && route.requestBody.length > 0) {
      operation.requestBody = {
        required: true,
        description: 'Request payload',
        content: {
          'application/json': {
            schema: buildRequestBodySchema(route.requestBody),
          },
        },
      };
    }

    // Add security requirement if protected
    if (route.requiresAuth) {
      operation.security = [{ bearerAuth: [] }];
    }

    // Assign operation to path item
    (paths[openApiPath] as Record<string, any>)[method] = operation;
  }

  const spec: OpenAPIObject = {
    openapi: '3.0.0',
    info: {
      title,
      version,
      description,
    },
    paths,
  };

  // Only include securitySchemes component if at least one route requires auth
  if (anyRequiresAuth) {
    spec.components = {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer Token Authentication',
        },
      },
    };
  }

  return spec;
}
