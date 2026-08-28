import path from 'path';
import { parseRoutes } from './parseRoutes';

const fixturePath = path.resolve(__dirname, '../../fixtures/sample-express-app');

console.log('================================================================');
console.log(' Contracta - Phase 1 Express Route Parser Test');
console.log('================================================================');
console.log(`Target Fixture: ${fixturePath}\n`);

try {
  const routes = parseRoutes(fixturePath);
  
  console.log('--- PARSED ROUTES OUTPUT (JSON) ---');
  console.log(JSON.stringify(routes, null, 2));
  console.log('\n--- SUMMARY ---');
  console.log(`Total Routes Discovered: ${routes.length}`);
  
  const authRoutes = routes.filter(r => r.requiresAuth);
  const validatedRoutes = routes.filter(r => r.requestBody && r.requestBody.length > 0);
  const paramRoutes = routes.filter(r => r.params && Object.keys(r.params).length > 0);
  
  console.log(`- Auth-Protected Routes: ${authRoutes.length}`);
  console.log(`- Routes with Request Body (Zod): ${validatedRoutes.length}`);
  console.log(`- Routes with Path Parameters: ${paramRoutes.length}`);
  console.log('================================================================');
} catch (error) {
  console.error('Failed to parse routes:', error);
  process.exit(1);
}
