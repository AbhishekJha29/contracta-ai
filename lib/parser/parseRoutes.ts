import {
  Project,
  Node,
  SyntaxKind,
  CallExpression,
  ObjectLiteralExpression,
  SourceFile,
} from 'ts-morph';
import path from 'path';
import fs from 'fs';
import { ParsedRoute, RequestBodyField } from './types';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'options', 'head']);
const AUTH_KEYWORDS = ['auth', 'protect', 'authenticate', 'jwt', 'token', 'session', 'guard', 'login'];

/**
 * Normalizes file paths for consistent map keys across operating systems.
 */
function normalizeFilePath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, '/').toLowerCase();
}

/**
 * Combines router mount prefix with route path.
 */
function combinePaths(prefix: string, routePath: string): string {
  const cleanPrefix = (prefix || '').trim();
  const cleanRoute = (routePath || '').trim();

  if (!cleanPrefix) {
    let p = cleanRoute.startsWith('/') ? cleanRoute : `/${cleanRoute}`;
    if (p.length > 1 && p.endsWith('/')) {
      p = p.slice(0, -1);
    }
    return p || '/';
  }

  // Avoid duplicate prefix if route already includes it
  if (cleanRoute.startsWith(cleanPrefix)) {
    return cleanRoute;
  }

  let combined = `${cleanPrefix}/${cleanRoute}`;
  combined = combined.replace(/\/+/g, '/');
  if (combined.length > 1 && combined.endsWith('/')) {
    combined = combined.slice(0, -1);
  }
  if (!combined.startsWith('/')) {
    combined = '/' + combined;
  }
  return combined;
}

/**
 * Extracts URL path parameters like :id from a route path.
 */
function extractPathParams(routePath: string): Record<string, string> | undefined {
  const matches = routePath.match(/:([a-zA-Z0-9_]+)/g);
  if (!matches || matches.length === 0) {
    return undefined;
  }

  const params: Record<string, string> = {};
  for (const match of matches) {
    const paramName = match.substring(1);
    params[paramName] = 'string';
  }
  return params;
}

/**
 * Determines if an AST node corresponds to an auth middleware.
 */
function isAuthMiddlewareNode(node: Node): boolean {
  if (Node.isIdentifier(node)) {
    const name = node.getText().toLowerCase();
    return AUTH_KEYWORDS.some((k) => name.includes(k));
  }

  if (Node.isCallExpression(node)) {
    const exprText = node.getExpression().getText().toLowerCase();
    return AUTH_KEYWORDS.some((k) => exprText.includes(k));
  }

  if (Node.isPropertyAccessExpression(node)) {
    const fullText = node.getText().toLowerCase();
    return AUTH_KEYWORDS.some((k) => fullText.includes(k));
  }

  if (Node.isArrayLiteralExpression(node)) {
    return node.getElements().some((element) => isAuthMiddlewareNode(element));
  }

  return false;
}

/**
 * Resolves an AST node to its original declaration across imports and files.
 */
function resolveDeclaration(node: Node): Node | undefined {
  if (Node.isIdentifier(node)) {
    const definitions = node.getDefinitionNodes();
    if (definitions.length > 0) {
      return definitions[0];
    }

    const symbol = node.getSymbol();
    if (symbol) {
      const declarations = symbol.getDeclarations();
      if (declarations.length > 0) {
        return declarations[0];
      }
      const aliased = symbol.getAliasedSymbol();
      if (aliased) {
        const aliasDecls = aliased.getDeclarations();
        if (aliasDecls.length > 0) {
          return aliasDecls[0];
        }
      }
    }
  }

  if (Node.isPropertyAccessExpression(node)) {
    const symbol = node.getSymbol();
    if (symbol) {
      const declarations = symbol.getDeclarations();
      if (declarations.length > 0) {
        return declarations[0];
      }
    }
  }

  return undefined;
}

/**
 * Resolves a function body / handler node (handling arrow functions, function declarations, wrappers).
 */
function resolveFunctionNode(node: Node, visited = new Set<Node>()): Node | undefined {
  if (!node || visited.has(node)) return undefined;
  visited.add(node);

  if (
    Node.isArrowFunction(node) ||
    Node.isFunctionExpression(node) ||
    Node.isFunctionDeclaration(node)
  ) {
    return node;
  }

  if (Node.isCallExpression(node)) {
    // e.g. asyncHandler((req, res) => { ... })
    const args = node.getArguments();
    for (const arg of args) {
      const resolved = resolveFunctionNode(arg, visited);
      if (resolved) return resolved;
    }
  }

  if (Node.isIdentifier(node) || Node.isPropertyAccessExpression(node)) {
    const decl = resolveDeclaration(node);
    if (decl) {
      if (Node.isFunctionDeclaration(decl)) {
        return decl;
      }
      if (Node.isVariableDeclaration(decl)) {
        const init = decl.getInitializer();
        if (init) {
          return resolveFunctionNode(init, visited);
        }
      }
      if (Node.isExportAssignment(decl)) {
        const expr = decl.getExpression();
        if (expr) return resolveFunctionNode(expr, visited);
      }
      if (Node.isPropertyAssignment(decl)) {
        const init = decl.getInitializer();
        if (init) return resolveFunctionNode(init, visited);
      }
    }
  }

  return undefined;
}

/**
 * Maps a Zod method to a human-readable schema type.
 */
function mapZodMethodToType(methodName: string, callExpr: CallExpression): string {
  switch (methodName) {
    case 'string':
    case 'email':
    case 'url':
    case 'uuid':
    case 'datetime':
    case 'cuid':
    case 'ip':
      return 'string';
    case 'number':
    case 'int':
    case 'bigint':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'Date';
    case 'array': {
      const args = callExpr.getArguments();
      if (args.length > 0) {
        const inner = parseZodField(args[0]);
        return `${inner.type}[]`;
      }
      return 'array';
    }
    case 'enum': {
      const args = callExpr.getArguments();
      if (args.length > 0 && Node.isArrayLiteralExpression(args[0])) {
        const elements = args[0].getElements().map((e) => e.getText().replace(/['"`]/g, ''));
        return elements.map((e) => `'${e}'`).join(' | ');
      }
      return 'string';
    }
    case 'nativeEnum':
      return 'enum';
    case 'object':
      return 'object';
    case 'record':
      return 'record';
    case 'any':
      return 'any';
    case 'unknown':
      return 'unknown';
    case 'null':
      return 'null';
    case 'undefined':
      return 'undefined';
    default:
      return methodName;
  }
}

/**
 * Parses a Zod field AST expression to extract its type and required status.
 */
function parseZodField(node: Node): { type: string; required: boolean } {
  let current: Node = node;
  let isOptional = false;
  let hasDefault = false;
  let baseType = 'string';

  while (Node.isCallExpression(current)) {
    const expr = current.getExpression();
    if (Node.isPropertyAccessExpression(expr)) {
      const methodName = expr.getName();
      if (methodName === 'optional' || methodName === 'nullish') {
        isOptional = true;
      } else if (methodName === 'default') {
        hasDefault = true;
      }

      const target = expr.getExpression();
      if (Node.isIdentifier(target) && target.getText() === 'z') {
        baseType = mapZodMethodToType(methodName, current);
        break;
      } else {
        current = target;
      }
    } else if (Node.isIdentifier(expr) && expr.getText() === 'z') {
      break;
    } else {
      break;
    }
  }

  // Handle z.optional(...) or z.nullable(...) wrapper calls
  if (Node.isCallExpression(current)) {
    const expr = current.getExpression();
    if (Node.isPropertyAccessExpression(expr)) {
      const target = expr.getExpression();
      if (Node.isIdentifier(target) && target.getText() === 'z') {
        const methodName = expr.getName();
        if (methodName === 'optional' || methodName === 'nullish') {
          isOptional = true;
          const args = current.getArguments();
          if (args.length > 0) {
            const inner = parseZodField(args[0]);
            baseType = inner.type;
          }
        }
      }
    }
  }

  return {
    type: baseType,
    required: !(isOptional || hasDefault),
  };
}

/**
 * Resolves a Zod schema expression to its underlying ObjectLiteralExpression of fields.
 */
function resolveZodObjectExpression(
  expr: Node,
  visited = new Set<Node>()
): ObjectLiteralExpression | undefined {
  if (!expr || visited.has(expr)) return undefined;
  visited.add(expr);

  if (Node.isObjectLiteralExpression(expr)) {
    return expr;
  }

  if (Node.isCallExpression(expr)) {
    const calledExpr = expr.getExpression();
    const calledText = calledExpr.getText();

    if (calledText === 'z.object' || calledText.endsWith('.object')) {
      const args = expr.getArguments();
      if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
        return args[0];
      }
    }

    // Chained methods like z.object({ ... }).strict() or .refine(...) or .strip()
    if (Node.isPropertyAccessExpression(calledExpr)) {
      return resolveZodObjectExpression(calledExpr.getExpression(), visited);
    }
  }

  if (Node.isIdentifier(expr) || Node.isPropertyAccessExpression(expr)) {
    const decl = resolveDeclaration(expr);
    if (decl) {
      if (Node.isVariableDeclaration(decl)) {
        const init = decl.getInitializer();
        if (init) {
          return resolveZodObjectExpression(init, visited);
        }
      }
      if (Node.isPropertyAssignment(decl)) {
        const init = decl.getInitializer();
        if (init) {
          return resolveZodObjectExpression(init, visited);
        }
      }
      if (Node.isExportAssignment(decl)) {
        const inner = decl.getExpression();
        if (inner) {
          return resolveZodObjectExpression(inner, visited);
        }
      }
    }
  }

  return undefined;
}

/**
 * Extracts field definitions from a Zod object literal AST node.
 */
function extractFieldsFromZodObject(objLiteral: ObjectLiteralExpression): RequestBodyField[] {
  const fields: RequestBodyField[] = [];

  for (const prop of objLiteral.getProperties()) {
    if (Node.isPropertyAssignment(prop)) {
      const fieldName = prop.getName().replace(/['"`]/g, '');
      const init = prop.getInitializer();
      if (init) {
        const { type, required } = parseZodField(init);
        fields.push({
          field: fieldName,
          type,
          required,
        });
      }
    } else if (Node.isShorthandPropertyAssignment(prop)) {
      const fieldName = prop.getName().replace(/['"`]/g, '');
      fields.push({
        field: fieldName,
        type: 'any',
        required: true,
      });
    }
  }

  return fields;
}

/**
 * Inspects a handler function body and route middleware for Zod schema validation on req.body.
 */
function extractRequestBodyFromHandler(
  handlerNode: Node | undefined,
  middlewareNodes: Node[]
): RequestBodyField[] | undefined {
  // Check middleware for validate(schema) or validateBody(schema)
  for (const mw of middlewareNodes) {
    if (Node.isCallExpression(mw)) {
      const exprText = mw.getExpression().getText().toLowerCase();
      if (exprText.includes('validate') || exprText.includes('body')) {
        const args = mw.getArguments();
        for (const arg of args) {
          const zodObj = resolveZodObjectExpression(arg);
          if (zodObj) {
            const fields = extractFieldsFromZodObject(zodObj);
            if (fields.length > 0) return fields;
          }
        }
      }
    }
  }

  if (!handlerNode) return undefined;

  // Search inside handler function body for .parse(req.body) or .safeParse(req.body)
  const calls = handlerNode.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of calls) {
    const expr = call.getExpression();
    if (Node.isPropertyAccessExpression(expr)) {
      const methodName = expr.getName();
      if (['parse', 'safeParse', 'parseAsync', 'safeParseAsync'].includes(methodName)) {
        const args = call.getArguments();
        if (args.length > 0) {
          const argText = args[0].getText();
          // Check if argument refers to request body
          if (
            argText.includes('req.body') ||
            argText === 'body' ||
            argText.includes('.body') ||
            argText.startsWith('{')
          ) {
            const schemaExpr = expr.getExpression();
            const zodObj = resolveZodObjectExpression(schemaExpr);
            if (zodObj) {
              const fields = extractFieldsFromZodObject(zodObj);
              if (fields.length > 0) return fields;
            }
          }
        }
      }
    }
  }

  return undefined;
}

/**
 * Builds a map of router file paths and symbol names to their mounted URL prefixes.
 */
function buildMountPrefixMap(sourceFiles: SourceFile[]): Map<string, string> {
  const mountMap = new Map<string, string>();

  for (const sf of sourceFiles) {
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const expr = call.getExpression();
      if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'use') {
        const args = call.getArguments();
        if (args.length >= 2) {
          const firstArg = args[0];
          // Check if first argument is a string path prefix
          if (Node.isStringLiteral(firstArg) || Node.isNoSubstitutionTemplateLiteral(firstArg)) {
            const prefix = firstArg.getLiteralText();
            // Remaining args could be router instances/identifiers
            for (let i = 1; i < args.length; i++) {
              const arg = args[i];
              if (Node.isIdentifier(arg) || Node.isPropertyAccessExpression(arg)) {
                const decl = resolveDeclaration(arg);
                if (decl) {
                  const targetSf = decl.getSourceFile();
                  const normalizedPath = normalizeFilePath(targetSf.getFilePath());
                  mountMap.set(normalizedPath, prefix);

                  if (Node.isVariableDeclaration(decl)) {
                    mountMap.set(decl.getName(), prefix);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return mountMap;
}

/**
 * Determines whether a source file or router has router-level auth middleware.
 */
function checkRouterLevelAuth(sf: SourceFile): boolean {
  const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of calls) {
    const expr = call.getExpression();
    if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'use') {
      const args = call.getArguments();
      for (const arg of args) {
        if (isAuthMiddlewareNode(arg)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Main parser function: extracts route definitions from an Express codebase using ts-morph.
 */
export function parseRoutes(projectPath: string): ParsedRoute[] {
  const absolutePath = path.resolve(projectPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Project path does not exist: ${absolutePath}`);
  }

  const possibleTsConfig = path.join(absolutePath, 'tsconfig.json');
  const hasTsConfig = fs.existsSync(possibleTsConfig);

  const project = new Project({
    tsConfigFilePath: hasTsConfig ? possibleTsConfig : undefined,
    skipAddingFilesFromTsConfig: false,
    compilerOptions: {
      allowJs: true,
    },
  });

  // Ensure source files are loaded
  project.addSourceFilesAtPaths([
    path.join(absolutePath, '**/*.ts').replace(/\\/g, '/'),
    path.join(absolutePath, '**/*.js').replace(/\\/g, '/'),
    `!${path.join(absolutePath, '**/node_modules/**').replace(/\\/g, '/')}`,
    `!${path.join(absolutePath, '**/*.d.ts').replace(/\\/g, '/')}`,
  ]);

  const sourceFiles = project.getSourceFiles().filter((sf) => {
    const p = sf.getFilePath();
    return !p.includes('node_modules') && !p.endsWith('.d.ts');
  });

  const mountPrefixMap = buildMountPrefixMap(sourceFiles);
  const parsedRoutes: ParsedRoute[] = [];
  const visitedRouteKeys = new Set<string>();

  for (const sf of sourceFiles) {
    const normalizedSfPath = normalizeFilePath(sf.getFilePath());
    const fileMountPrefix = mountPrefixMap.get(normalizedSfPath) || '';
    const hasRouterLevelAuth = checkRouterLevelAuth(sf);

    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of calls) {
      const expr = call.getExpression();

      // Case 1: Direct route call, e.g. router.get('/path', ...), app.post('/path', ...)
      if (Node.isPropertyAccessExpression(expr)) {
        const methodName = expr.getName().toLowerCase();
        if (HTTP_METHODS.has(methodName)) {
          const args = call.getArguments();
          if (args.length > 0) {
            const firstArg = args[0];
            let rawPath: string | undefined;

            if (Node.isStringLiteral(firstArg) || Node.isNoSubstitutionTemplateLiteral(firstArg)) {
              rawPath = firstArg.getLiteralText();
            }

            if (rawPath !== undefined) {
              const fullPath = combinePaths(fileMountPrefix, rawPath);
              const middlewareArgs = args.slice(1, args.length - 1);
              const handlerArg = args.length > 1 ? args[args.length - 1] : undefined;

              const requiresAuth =
                hasRouterLevelAuth ||
                middlewareArgs.some((arg) => isAuthMiddlewareNode(arg)) ||
                (handlerArg ? isAuthMiddlewareNode(handlerArg) && args.length > 2 : false);

              const resolvedHandler = handlerArg ? resolveFunctionNode(handlerArg) : undefined;
              const requestBody = extractRequestBodyFromHandler(resolvedHandler, middlewareArgs);
              const params = extractPathParams(fullPath);

              const routeKey = `${methodName.toUpperCase()}:${fullPath}`;
              if (!visitedRouteKeys.has(routeKey)) {
                visitedRouteKeys.add(routeKey);

                const route: ParsedRoute = {
                  method: methodName.toUpperCase(),
                  path: fullPath,
                  requiresAuth,
                };

                if (params) {
                  route.params = params;
                }

                if (requestBody && requestBody.length > 0) {
                  route.requestBody = requestBody;
                }

                parsedRoutes.push(route);
              }
            }
          }
        }
      }

      // Case 2: Chained .route('/path').get(...).post(...)
      if (Node.isPropertyAccessExpression(expr)) {
        const methodName = expr.getName().toLowerCase();
        if (HTTP_METHODS.has(methodName)) {
          const innerExpr = expr.getExpression();
          if (Node.isCallExpression(innerExpr)) {
            const innerProp = innerExpr.getExpression();
            if (Node.isPropertyAccessExpression(innerProp) && innerProp.getName() === 'route') {
              const routeArgs = innerExpr.getArguments();
              if (routeArgs.length > 0) {
                const pathArg = routeArgs[0];
                if (Node.isStringLiteral(pathArg) || Node.isNoSubstitutionTemplateLiteral(pathArg)) {
                  const rawPath = pathArg.getLiteralText();
                  const fullPath = combinePaths(fileMountPrefix, rawPath);

                  const args = call.getArguments();
                  const middlewareArgs = args.slice(0, args.length - 1);
                  const handlerArg = args.length > 0 ? args[args.length - 1] : undefined;

                  const requiresAuth =
                    hasRouterLevelAuth ||
                    middlewareArgs.some((arg) => isAuthMiddlewareNode(arg));

                  const resolvedHandler = handlerArg ? resolveFunctionNode(handlerArg) : undefined;
                  const requestBody = extractRequestBodyFromHandler(resolvedHandler, middlewareArgs);
                  const params = extractPathParams(fullPath);

                  const routeKey = `${methodName.toUpperCase()}:${fullPath}`;
                  if (!visitedRouteKeys.has(routeKey)) {
                    visitedRouteKeys.add(routeKey);

                    const route: ParsedRoute = {
                      method: methodName.toUpperCase(),
                      path: fullPath,
                      requiresAuth,
                    };

                    if (params) {
                      route.params = params;
                    }

                    if (requestBody && requestBody.length > 0) {
                      route.requestBody = requestBody;
                    }

                    parsedRoutes.push(route);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Sort routes for predictable, readable output: by path then method
  parsedRoutes.sort((a, b) => {
    if (a.path === b.path) {
      return a.method.localeCompare(b.method);
    }
    return a.path.localeCompare(b.path);
  });

  return parsedRoutes;
}
