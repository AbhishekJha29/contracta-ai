import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { parseRoutes } from '../parser/parseRoutes';
import { generateSpec } from '../generator/generateSpec';
import { writeSpec } from '../generator/writeSpec';

// Load environment variables from .env if present
dotenv.config();

/**
 * Regenerates and overwrites the committed openapi.json baseline contract from current codebase.
 */
function updateBaseline(): void {
  console.log('================================================================');
  console.log(' Contracta - Update API Baseline Specification');
  console.log('================================================================');

  const appPath = process.env.APP_PATH
    ? path.resolve(process.cwd(), process.env.APP_PATH)
    : path.resolve(process.cwd(), 'fixtures/sample-express-app');

  if (!fs.existsSync(appPath)) {
    console.error(`❌ Error: Target application directory not found at: ${appPath}`);
    process.exit(1);
  }

  console.log(`\n1. Scanning codebase at: ${appPath}`);
  const routes = parseRoutes(appPath);
  console.log(`   Discovered ${routes.length} route(s).`);

  console.log('\n2. Generating OpenAPI 3.0 specification document...');
  const spec = generateSpec(routes, {
    title: 'Sample Express App API',
    version: '1.0.0',
    description: 'Contracta auto-generated OpenAPI 3.0 document from Express.js codebase.',
  });

  console.log('\n3. Overwriting baseline openapi.json at project root...');
  const writtenPath = writeSpec(spec);

  console.log(`   ✅ Baseline contract updated successfully at: ${writtenPath}`);
  console.log('   You can now commit this updated openapi.json to your version control.');
  console.log('================================================================\n');
}

try {
  updateBaseline();
} catch (error: any) {
  console.error('❌ Failed to update baseline:', error.message || error);
  process.exit(1);
}
