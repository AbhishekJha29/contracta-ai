import {
  OpenAPIObject,
  PathItemObject,
  OperationObject,
  SchemaObject,
  ParameterObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
} from 'openapi3-ts/oas30';
import { DiffEntry } from './types';

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'] as const;
type HttpMethodKey = (typeof HTTP_METHODS)[number];

interface SchemaDiffContext {
  method: string;
  path: string;
  location: string;
  fieldPath: string;
  oldSpec: OpenAPIObject;
  newSpec: OpenAPIObject;
  isResponse?: boolean;
}

/**
 * Resolves a schema reference ($ref) within an OpenAPI spec if present.
 * Supports standard local refs such as "#/components/schemas/User".
 */
export function resolveSchema(
  schema: SchemaObject | ReferenceObject | undefined,
  spec: OpenAPIObject,
  visited = new Set<string>()
): SchemaObject | undefined {
  if (!schema) return undefined;
  if (!('$ref' in schema) || !schema.$ref) {
    return schema as SchemaObject;
  }

  const ref = schema.$ref;
  if (visited.has(ref)) {
    // Circular reference guard
    return undefined;
  }
  visited.add(ref);

  if (ref.startsWith('#/')) {
    const parts = ref.replace(/^#\//, '').split('/');
    let current: unknown = spec;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return resolveSchema(current as SchemaObject | ReferenceObject, spec, visited);
  }

  return undefined;
}

/**
 * Resolves a parameter reference ($ref) within an OpenAPI spec if present.
 */
export function resolveParameter(
  param: ParameterObject | ReferenceObject | undefined,
  spec: OpenAPIObject
): ParameterObject | undefined {
  if (!param) return undefined;
  if (!('$ref' in param) || !param.$ref) {
    return param as ParameterObject;
  }

  const ref = param.$ref;
  if (ref.startsWith('#/components/parameters/')) {
    const paramName = ref.replace('#/components/parameters/', '');
    const found = spec.components?.parameters?.[paramName];
    return resolveParameter(found, spec);
  }

  return undefined;
}

/**
 * Resolves a request body reference ($ref) within an OpenAPI spec if present.
 */
export function resolveRequestBody(
  requestBody: RequestBodyObject | ReferenceObject | undefined,
  spec: OpenAPIObject
): RequestBodyObject | undefined {
  if (!requestBody) return undefined;
  if (!('$ref' in requestBody) || !requestBody.$ref) {
    return requestBody as RequestBodyObject;
  }

  const ref = requestBody.$ref;
  if (ref.startsWith('#/components/requestBodies/')) {
    const name = ref.replace('#/components/requestBodies/', '');
    const found = spec.components?.requestBodies?.[name];
    return resolveRequestBody(found, spec);
  }

  return undefined;
}

/**
 * Resolves a response reference ($ref) within an OpenAPI spec if present.
 */
export function resolveResponse(
  response: ResponseObject | ReferenceObject | undefined,
  spec: OpenAPIObject
): ResponseObject | undefined {
  if (!response) return undefined;
  if (!('$ref' in response) || !response.$ref) {
    return response as ResponseObject;
  }

  const ref = response.$ref;
  if (ref.startsWith('#/components/responses/')) {
    const name = ref.replace('#/components/responses/', '');
    const found = spec.components?.responses?.[name];
    return resolveResponse(found, spec);
  }

  return undefined;
}

/**
 * Determines whether an operation requires authentication.
 * Checks operation-level security, falling back to root-level security.
 */
export function isOperationSecured(
  operation: OperationObject,
  spec: OpenAPIObject
): boolean {
  if (operation.security !== undefined) {
    if (!Array.isArray(operation.security) || operation.security.length === 0) {
      return false;
    }
    // In OpenAPI 3.0, an empty security object `{}` in the array indicates optional / no auth
    return operation.security.some((sec) => Object.keys(sec).length > 0);
  }

  // Fall back to spec root security
  if (spec.security && Array.isArray(spec.security) && spec.security.length > 0) {
    return spec.security.some((sec) => Object.keys(sec).length > 0);
  }

  return false;
}

/**
 * Extracts the primary JSON schema from a request body object.
 */
export function extractRequestBodySchema(
  requestBody: RequestBodyObject | ReferenceObject | undefined,
  spec: OpenAPIObject
): SchemaObject | undefined {
  const resolvedBody = resolveRequestBody(requestBody, spec);
  if (!resolvedBody?.content) return undefined;

  if (resolvedBody.content['application/json']?.schema) {
    return resolveSchema(resolvedBody.content['application/json'].schema, spec);
  }

  const firstContentType = Object.keys(resolvedBody.content)[0];
  if (firstContentType && resolvedBody.content[firstContentType]?.schema) {
    return resolveSchema(resolvedBody.content[firstContentType].schema, spec);
  }

  return undefined;
}

/**
 * Extracts effective parameters for an operation, merging PathItem-level
 * and Operation-level parameter declarations.
 */
export function getEffectiveParameters(
  pathItem: PathItemObject,
  operation: OperationObject,
  spec: OpenAPIObject
): Map<string, ParameterObject> {
  const paramMap = new Map<string, ParameterObject>();

  // 1. PathItem-level parameters
  if (pathItem.parameters) {
    for (const rawParam of pathItem.parameters) {
      const resolved = resolveParameter(rawParam, spec);
      if (resolved && resolved.name && resolved.in) {
        paramMap.set(`${resolved.in}:${resolved.name}`, resolved);
      }
    }
  }

  // 2. Operation-level parameters (override path-level)
  if (operation.parameters) {
    for (const rawParam of operation.parameters) {
      const resolved = resolveParameter(rawParam, spec);
      if (resolved && resolved.name && resolved.in) {
        paramMap.set(`${resolved.in}:${resolved.name}`, resolved);
      }
    }
  }

  return paramMap;
}

/**
 * Deeply compares two SchemaObjects (request or response schemas)
 * and produces classified breaking / non-breaking DiffEntries.
 */
export function diffSchemas(
  oldRawSchema: SchemaObject | ReferenceObject | undefined,
  newRawSchema: SchemaObject | ReferenceObject | undefined,
  context: SchemaDiffContext
): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  const oldSchema = resolveSchema(oldRawSchema, context.oldSpec);
  const newSchema = resolveSchema(newRawSchema, context.newSpec);

  if (!oldSchema && !newSchema) {
    return diffs;
  }

  const fieldLabel = context.fieldPath ? `field "${context.fieldPath}"` : context.location;

  // Case 1: Entire schema removed
  if (oldSchema && !newSchema) {
    diffs.push({
      severity: 'breaking',
      method: context.method,
      path: context.path,
      changeType: 'required-field-removed',
      description: `Required ${fieldLabel} was removed from ${context.location}`,
      oldValue: oldSchema,
      newValue: undefined,
    });
    return diffs;
  }

  // Case 2: Entire schema added
  if (!oldSchema && newSchema) {
    diffs.push({
      severity: 'non-breaking',
      method: context.method,
      path: context.path,
      changeType: 'field-added',
      description: `Optional ${fieldLabel} was added to ${context.location}`,
      oldValue: undefined,
      newValue: newSchema,
    });
    return diffs;
  }

  if (!oldSchema || !newSchema) return diffs;

  // Case 3: Type changed
  const oldType = oldSchema.type;
  const newType = newSchema.type;
  if (oldType && newType && oldType !== newType) {
    diffs.push({
      severity: 'breaking',
      method: context.method,
      path: context.path,
      changeType: 'field-type-changed',
      description: context.fieldPath
        ? `Field "${context.fieldPath}" type changed from "${oldType}" to "${newType}" in ${context.location}`
        : `Type changed from "${oldType}" to "${newType}" in ${context.location}`,
      oldValue: oldType,
      newValue: newType,
    });
    return diffs;
  }

  // Case 4: Enum values comparison
  const oldEnum = oldSchema.enum;
  const newEnum = newSchema.enum;
  if (oldEnum || newEnum) {
    if (oldEnum && newEnum) {
      const oldSet = new Set(oldEnum);
      const newSet = new Set(newEnum);
      const removedValues = oldEnum.filter((val) => !newSet.has(val));

      if (removedValues.length > 0) {
        // Breaking: previously valid enum values are no longer accepted
        diffs.push({
          severity: 'breaking',
          method: context.method,
          path: context.path,
          changeType: 'field-type-changed',
          description: `Enum value(s) [${removedValues.map((v) => `"${v}"`).join(', ')}] removed from ${fieldLabel} in ${context.location}`,
          oldValue: oldEnum,
          newValue: newEnum,
        });
      } else if (newEnum.length > oldEnum.length) {
        // Non-breaking: allowed enum set expanded
        diffs.push({
          severity: 'non-breaking',
          method: context.method,
          path: context.path,
          changeType: 'field-added',
          description: `Enum values expanded for ${fieldLabel} in ${context.location}`,
          oldValue: oldEnum,
          newValue: newEnum,
        });
      }
    } else if (oldEnum && !newEnum) {
      // Enum restriction removed -> non-breaking
      diffs.push({
        severity: 'non-breaking',
        method: context.method,
        path: context.path,
        changeType: 'field-modified',
        description: `Enum restriction removed from ${fieldLabel} in ${context.location}`,
        oldValue: oldEnum,
        newValue: undefined,
      });
    } else if (!oldEnum && newEnum) {
      // Enum restriction added -> breaking
      diffs.push({
        severity: 'breaking',
        method: context.method,
        path: context.path,
        changeType: 'field-type-changed',
        description: `${fieldLabel} restricted to enum values [${newEnum.map((v) => `"${v}"`).join(', ')}] in ${context.location}`,
        oldValue: undefined,
        newValue: newEnum,
      });
    }
  }

  // Case 5: Object Properties Comparison
  const oldProps = oldSchema.properties || {};
  const newProps = newSchema.properties || {};
  const oldRequired = new Set(oldSchema.required || []);
  const newRequired = new Set(newSchema.required || []);

  const hasProperties = Object.keys(oldProps).length > 0 || Object.keys(newProps).length > 0;

  if (hasProperties || oldSchema.type === 'object' || newSchema.type === 'object') {
    // 5a. Check properties removed or changed from old schema
    for (const [propName, oldPropRaw] of Object.entries(oldProps)) {
      const fullPath = context.fieldPath ? `${context.fieldPath}.${propName}` : propName;
      const isOldRequired = oldRequired.has(propName);

      if (!(propName in newProps)) {
        // Property was removed in new schema
        if (context.isResponse) {
          // In responses, removing any field that clients might consume is breaking
          diffs.push({
            severity: 'breaking',
            method: context.method,
            path: context.path,
            changeType: 'required-field-removed',
            description: `Field "${fullPath}" was removed from ${context.location}`,
            oldValue: oldPropRaw,
            newValue: undefined,
          });
        } else if (isOldRequired) {
          // In requests, removing a required field is breaking
          diffs.push({
            severity: 'breaking',
            method: context.method,
            path: context.path,
            changeType: 'required-field-removed',
            description: `Required field "${fullPath}" was removed from ${context.location}`,
            oldValue: oldPropRaw,
            newValue: undefined,
          });
        } else {
          // In requests, removing an optional field is non-breaking
          diffs.push({
            severity: 'non-breaking',
            method: context.method,
            path: context.path,
            changeType: 'field-removed',
            description: `Optional field "${fullPath}" was removed from ${context.location}`,
            oldValue: oldPropRaw,
            newValue: undefined,
          });
        }
      } else {
        const newPropRaw = newProps[propName];
        const isNewRequired = newRequired.has(propName);
        const resolvedNewProp = resolveSchema(newPropRaw, context.newSpec);

        // Check requiredness transition
        if (!isOldRequired && isNewRequired) {
          // Field became required
          const hasDefault = resolvedNewProp?.default !== undefined || (newPropRaw as SchemaObject)?.default !== undefined;
          if (!hasDefault && !context.isResponse) {
            diffs.push({
              severity: 'breaking',
              method: context.method,
              path: context.path,
              changeType: 'required-field-added',
              description: `Field "${fullPath}" became required without default in ${context.location}`,
              oldValue: false,
              newValue: true,
            });
          } else {
            diffs.push({
              severity: 'non-breaking',
              method: context.method,
              path: context.path,
              changeType: 'field-modified',
              description: `Field "${fullPath}" became required with default in ${context.location}`,
              oldValue: false,
              newValue: true,
            });
          }
        } else if (isOldRequired && !isNewRequired) {
          // Field became optional (non-breaking)
          diffs.push({
            severity: 'non-breaking',
            method: context.method,
            path: context.path,
            changeType: 'field-modified',
            description: `Required field "${fullPath}" became optional in ${context.location}`,
            oldValue: true,
            newValue: false,
          });
        }

        // Recursively diff child property schema
        const childDiffs = diffSchemas(oldPropRaw, newPropRaw, {
          ...context,
          fieldPath: fullPath,
        });
        diffs.push(...childDiffs);
      }
    }

    // 5b. Check properties added in new schema
    for (const [propName, newPropRaw] of Object.entries(newProps)) {
      if (!(propName in oldProps)) {
        const fullPath = context.fieldPath ? `${context.fieldPath}.${propName}` : propName;
        const isNewRequired = newRequired.has(propName);
        const resolvedNewProp = resolveSchema(newPropRaw, context.newSpec);
        const hasDefault = resolvedNewProp?.default !== undefined || (newPropRaw as SchemaObject)?.default !== undefined;

        if (context.isResponse) {
          // Adding a field to response payload is non-breaking
          diffs.push({
            severity: 'non-breaking',
            method: context.method,
            path: context.path,
            changeType: 'field-added',
            description: `Field "${fullPath}" was added to ${context.location}`,
            oldValue: undefined,
            newValue: newPropRaw,
          });
        } else if (isNewRequired && !hasDefault) {
          // New required field with NO default in request payload is BREAKING
          diffs.push({
            severity: 'breaking',
            method: context.method,
            path: context.path,
            changeType: 'required-field-added',
            description: `New required field "${fullPath}" with no default was added to ${context.location}`,
            oldValue: undefined,
            newValue: newPropRaw,
          });
        } else {
          // New optional field or required with default is NON-BREAKING
          diffs.push({
            severity: 'non-breaking',
            method: context.method,
            path: context.path,
            changeType: 'field-added',
            description: `Optional field "${fullPath}" was added to ${context.location}`,
            oldValue: undefined,
            newValue: newPropRaw,
          });
        }
      }
    }
  }

  // Case 6: Array Items Comparison
  if (oldSchema.type === 'array' && newSchema.type === 'array') {
    if (oldSchema.items && newSchema.items) {
      const itemDiffs = diffSchemas(oldSchema.items, newSchema.items, {
        ...context,
        fieldPath: context.fieldPath ? `${context.fieldPath}[]` : '[]',
      });
      diffs.push(...itemDiffs);
    }
  }

  return diffs;
}

/**
 * Core diffing engine function. Compares two OpenAPI 3.0 specs and classifies
 * all changes into breaking and non-breaking DiffEntry records.
 */
export function diffSpecs(oldSpec: OpenAPIObject, newSpec: OpenAPIObject): DiffEntry[] {
  const diffs: DiffEntry[] = [];

  const oldPaths = oldSpec?.paths || {};
  const newPaths = newSpec?.paths || {};

  const allPathKeys = new Set([...Object.keys(oldPaths), ...Object.keys(newPaths)]);

  for (const pathKey of allPathKeys) {
    const oldPathItem: PathItemObject | undefined = oldPaths[pathKey];
    const newPathItem: PathItemObject | undefined = newPaths[pathKey];

    // Case 1: Entire path removed in new spec
    if (oldPathItem && !newPathItem) {
      for (const method of HTTP_METHODS) {
        if (oldPathItem[method as HttpMethodKey]) {
          diffs.push({
            severity: 'breaking',
            method: method.toUpperCase(),
            path: pathKey,
            changeType: 'endpoint-removed',
            description: `Endpoint ${method.toUpperCase()} ${pathKey} was removed`,
            oldValue: oldPathItem[method as HttpMethodKey],
            newValue: undefined,
          });
        }
      }
      continue;
    }

    // Case 2: Entire path added in new spec
    if (!oldPathItem && newPathItem) {
      for (const method of HTTP_METHODS) {
        if (newPathItem[method as HttpMethodKey]) {
          diffs.push({
            severity: 'non-breaking',
            method: method.toUpperCase(),
            path: pathKey,
            changeType: 'endpoint-added',
            description: `Endpoint ${method.toUpperCase()} ${pathKey} was added`,
            oldValue: undefined,
            newValue: newPathItem[method as HttpMethodKey],
          });
        }
      }
      continue;
    }

    if (!oldPathItem || !newPathItem) continue;

    // Case 3: Path exists in both specs — inspect each HTTP method
    for (const method of HTTP_METHODS) {
      const oldOp: OperationObject | undefined = oldPathItem[method as HttpMethodKey];
      const newOp: OperationObject | undefined = newPathItem[method as HttpMethodKey];
      const formattedMethod = method.toUpperCase();

      // 3a. Endpoint removed
      if (oldOp && !newOp) {
        diffs.push({
          severity: 'breaking',
          method: formattedMethod,
          path: pathKey,
          changeType: 'endpoint-removed',
          description: `Endpoint ${formattedMethod} ${pathKey} was removed`,
          oldValue: oldOp,
          newValue: undefined,
        });
        continue;
      }

      // 3b. Endpoint added
      if (!oldOp && newOp) {
        diffs.push({
          severity: 'non-breaking',
          method: formattedMethod,
          path: pathKey,
          changeType: 'endpoint-added',
          description: `Endpoint ${formattedMethod} ${pathKey} was added`,
          oldValue: undefined,
          newValue: newOp,
        });
        continue;
      }

      if (!oldOp || !newOp) continue;

      // 3c. Authentication changes
      const oldSecured = isOperationSecured(oldOp, oldSpec);
      const newSecured = isOperationSecured(newOp, newSpec);

      if (!oldSecured && newSecured) {
        diffs.push({
          severity: 'breaking',
          method: formattedMethod,
          path: pathKey,
          changeType: 'auth-added',
          description: `Authentication was added to ${formattedMethod} ${pathKey}`,
          oldValue: oldOp.security,
          newValue: newOp.security,
        });
      } else if (oldSecured && !newSecured) {
        diffs.push({
          severity: 'non-breaking',
          method: formattedMethod,
          path: pathKey,
          changeType: 'auth-removed',
          description: `Authentication was removed from ${formattedMethod} ${pathKey} (security weakened)`,
          oldValue: oldOp.security,
          newValue: newOp.security,
        });
      }

      // 3d. Parameters diffing (path, query, header, cookie)
      const oldParams = getEffectiveParameters(oldPathItem, oldOp, oldSpec);
      const newParams = getEffectiveParameters(newPathItem, newOp, newSpec);

      // Check removed parameters
      for (const [paramKey, oldParam] of oldParams.entries()) {
        if (!newParams.has(paramKey)) {
          const isRequired = oldParam.required === true || oldParam.in === 'path';
          if (isRequired) {
            diffs.push({
              severity: 'breaking',
              method: formattedMethod,
              path: pathKey,
              changeType: 'required-field-removed',
              description: `Required ${oldParam.in} parameter "${oldParam.name}" was removed from ${formattedMethod} ${pathKey}`,
              oldValue: oldParam,
              newValue: undefined,
            });
          } else {
            diffs.push({
              severity: 'non-breaking',
              method: formattedMethod,
              path: pathKey,
              changeType: 'field-removed',
              description: `Optional ${oldParam.in} parameter "${oldParam.name}" was removed from ${formattedMethod} ${pathKey}`,
              oldValue: oldParam,
              newValue: undefined,
            });
          }
        }
      }

      // Check added or modified parameters
      for (const [paramKey, newParam] of newParams.entries()) {
        const oldParam = oldParams.get(paramKey);

        if (!oldParam) {
          const isRequired = newParam.required === true || newParam.in === 'path';
          const resolvedParamSchema = resolveSchema(newParam.schema, newSpec);
          const hasDefault =
            resolvedParamSchema?.default !== undefined ||
            (newParam as ParameterObject & { default?: unknown }).default !== undefined;

          if (isRequired && !hasDefault) {
            diffs.push({
              severity: 'breaking',
              method: formattedMethod,
              path: pathKey,
              changeType: 'required-field-added',
              description: `Required ${newParam.in} parameter "${newParam.name}" was added to ${formattedMethod} ${pathKey}`,
              oldValue: undefined,
              newValue: newParam,
            });
          } else {
            diffs.push({
              severity: 'non-breaking',
              method: formattedMethod,
              path: pathKey,
              changeType: 'field-added',
              description: `Optional ${newParam.in} parameter "${newParam.name}" was added to ${formattedMethod} ${pathKey}`,
              oldValue: undefined,
              newValue: newParam,
            });
          }
        } else {
          // Parameter exists in both — check required transition
          const wasRequired = oldParam.required === true || oldParam.in === 'path';
          const isNowRequired = newParam.required === true || newParam.in === 'path';
          const resolvedParamSchema = resolveSchema(newParam.schema, newSpec);
          const hasDefault =
            resolvedParamSchema?.default !== undefined ||
            (newParam as ParameterObject & { default?: unknown }).default !== undefined;

          if (!wasRequired && isNowRequired && !hasDefault) {
            diffs.push({
              severity: 'breaking',
              method: formattedMethod,
              path: pathKey,
              changeType: 'required-field-added',
              description: `${newParam.in} parameter "${newParam.name}" became required in ${formattedMethod} ${pathKey}`,
              oldValue: false,
              newValue: true,
            });
          } else if (wasRequired && !isNowRequired) {
            diffs.push({
              severity: 'non-breaking',
              method: formattedMethod,
              path: pathKey,
              changeType: 'field-modified',
              description: `Required ${newParam.in} parameter "${newParam.name}" became optional in ${formattedMethod} ${pathKey}`,
              oldValue: true,
              newValue: false,
            });
          }

          // Check parameter schema differences
          if (oldParam.schema || newParam.schema) {
            const paramDiffs = diffSchemas(oldParam.schema, newParam.schema, {
              method: formattedMethod,
              path: pathKey,
              location: `${newParam.in} parameter "${newParam.name}"`,
              fieldPath: newParam.name,
              oldSpec,
              newSpec,
            });
            diffs.push(...paramDiffs);
          }
        }
      }

      // 3e. Request body diffing
      const oldReqBody = resolveRequestBody(oldOp.requestBody, oldSpec);
      const newReqBody = resolveRequestBody(newOp.requestBody, newSpec);

      const oldHasBody = Boolean(oldReqBody);
      const newHasBody = Boolean(newReqBody);

      if (oldHasBody && !newHasBody) {
        if (oldReqBody?.required) {
          diffs.push({
            severity: 'breaking',
            method: formattedMethod,
            path: pathKey,
            changeType: 'required-field-removed',
            description: `Required request body was removed from ${formattedMethod} ${pathKey}`,
            oldValue: oldReqBody,
            newValue: undefined,
          });
        } else {
          diffs.push({
            severity: 'non-breaking',
            method: formattedMethod,
            path: pathKey,
            changeType: 'field-removed',
            description: `Optional request body was removed from ${formattedMethod} ${pathKey}`,
            oldValue: oldReqBody,
            newValue: undefined,
          });
        }
      } else if (!oldHasBody && newHasBody) {
        if (newReqBody?.required) {
          diffs.push({
            severity: 'breaking',
            method: formattedMethod,
            path: pathKey,
            changeType: 'required-field-added',
            description: `Required request body was added to ${formattedMethod} ${pathKey}`,
            oldValue: undefined,
            newValue: newReqBody,
          });
        } else {
          diffs.push({
            severity: 'non-breaking',
            method: formattedMethod,
            path: pathKey,
            changeType: 'field-added',
            description: `Optional request body was added to ${formattedMethod} ${pathKey}`,
            oldValue: undefined,
            newValue: newReqBody,
          });
        }
      } else if (oldHasBody && newHasBody) {
        // Both have request body — check if it became required
        if (!oldReqBody?.required && newReqBody?.required) {
          diffs.push({
            severity: 'breaking',
            method: formattedMethod,
            path: pathKey,
            changeType: 'required-field-added',
            description: `Request body became required in ${formattedMethod} ${pathKey}`,
            oldValue: false,
            newValue: true,
          });
        }

        const oldBodySchema = extractRequestBodySchema(oldReqBody, oldSpec);
        const newBodySchema = extractRequestBodySchema(newReqBody, newSpec);

        if (oldBodySchema || newBodySchema) {
          const bodyDiffs = diffSchemas(oldBodySchema, newBodySchema, {
            method: formattedMethod,
            path: pathKey,
            location: 'request body',
            fieldPath: '',
            oldSpec,
            newSpec,
          });
          diffs.push(...bodyDiffs);
        }
      }

      // 3f. Responses diffing
      const oldResponses = oldOp.responses || {};
      const newResponses = newOp.responses || {};

      for (const [code, oldRespRaw] of Object.entries(oldResponses)) {
        if (!(code in newResponses)) {
          diffs.push({
            severity: 'breaking',
            method: formattedMethod,
            path: pathKey,
            changeType: 'response-status-removed',
            description: `Response status code "${code}" was removed from ${formattedMethod} ${pathKey}`,
            oldValue: oldRespRaw,
            newValue: undefined,
          });
        } else {
          // Status code present in both — diff response body schemas if defined
          const oldRespObj = resolveResponse(oldRespRaw, oldSpec);
          const newRespObj = resolveResponse(newResponses[code], newSpec);

          const oldRespSchema = oldRespObj?.content?.['application/json']?.schema;
          const newRespSchema = newRespObj?.content?.['application/json']?.schema;

          if (oldRespSchema && newRespSchema) {
            const respDiffs = diffSchemas(oldRespSchema, newRespSchema, {
              method: formattedMethod,
              path: pathKey,
              location: `response body (${code})`,
              fieldPath: '',
              oldSpec,
              newSpec,
              isResponse: true,
            });
            diffs.push(...respDiffs);
          }
        }
      }

      for (const [code, newRespRaw] of Object.entries(newResponses)) {
        if (!(code in oldResponses)) {
          diffs.push({
            severity: 'non-breaking',
            method: formattedMethod,
            path: pathKey,
            changeType: 'response-status-added',
            description: `Response status code "${code}" was added to ${formattedMethod} ${pathKey}`,
            oldValue: undefined,
            newValue: newRespRaw,
          });
        }
      }
    }
  }

  return diffs;
}
