import fs from 'fs';
import path from 'path';
import { OpenAPIObject } from 'openapi3-ts/oas30';

/**
 * Writes the generated OpenAPI specification to a formatted JSON file.
 * Defaults to openapi.json in the project root.
 *
 * @param spec The OpenAPI specification object
 * @param outputPath Optional custom destination path
 * @returns The absolute file path written to
 */
export function writeSpec(spec: OpenAPIObject | any, outputPath?: string): string {
  const targetPath = outputPath
    ? path.resolve(outputPath)
    : path.resolve(process.cwd(), 'openapi.json');

  const jsonContent = JSON.stringify(spec, null, 2);
  fs.writeFileSync(targetPath, jsonContent, 'utf-8');

  return targetPath;
}
