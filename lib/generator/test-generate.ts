import path from 'path';
import SwaggerParser from '@apidevtools/swagger-parser';
import { OpenAPIObject } from 'openapi3-ts/oas30';
import { parseRoutes } from '../parser/parseRoutes';
import { generateSpec } from './generateSpec';
import { writeSpec } from './writeSpec';

async function run() {
  const fixturePath = path.resolve(__dirname, '../../fixtures/sample-express-app');

  console.log('================================================================');
  console.log(' Contracta - Phase 2 OpenAPI 3.0 Generator & Validation Test');
  console.log('================================================================');
  console.log(`1. Parsing routes from fixture: ${fixturePath}`);

  const parsedRoutes = parseRoutes(fixturePath);
  console.log(`   Found ${parsedRoutes.length} route(s).`);

  console.log('\n2. Generating OpenAPI 3.0 specification...');
  const spec = generateSpec(parsedRoutes, {
    title: 'Sample Express App API',
    version: '1.0.0',
    description: 'Contracta auto-generated OpenAPI 3.0 document from Express.js codebase.',
  });

  console.log('\n3. Writing spec to openapi.json in project root...');
  const writtenPath = writeSpec(spec);
  console.log(`   Successfully written to: ${writtenPath}`);

  console.log('\n4. Validating spec using @apidevtools/swagger-parser...');
  try {
    const validated = (await SwaggerParser.validate(writtenPath)) as OpenAPIObject;
    console.log('   ✅ RESULT: VALID OpenAPI 3.0 Document!');
    console.log(`   API Title   : ${validated.info.title}`);
    console.log(`   API Version : ${validated.info.version}`);
    console.log(`   OpenAPI Ver : ${validated.openapi}`);
    console.log(`   Total Paths : ${Object.keys(validated.paths || {}).length}`);
  } catch (error) {
    console.error('   ❌ RESULT: INVALID OpenAPI Specification');
    console.error(error);
    process.exit(1);
  }

  console.log('\n--- SAMPLE GENERATED ROUTE PREVIEW: POST /api/users ---');
  if (spec.paths['/api/users'] && spec.paths['/api/users'].post) {
    console.log(JSON.stringify(spec.paths['/api/users'].post, null, 2));
  }

  console.log('\n================================================================');
  console.log(' Phase 2 Generation and Validation Completed Successfully!');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
