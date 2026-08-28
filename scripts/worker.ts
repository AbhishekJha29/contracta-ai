import dotenv from 'dotenv';
dotenv.config();

import { startWorker } from '../lib/queue/analyzeWorker';

console.log('================================================================');
console.log(' 🚀 Contracta - Background AST Analysis Worker Service');
console.log('================================================================');

if (!process.env.REDIS_URL) {
  console.warn('⚠️ [Worker Warning] REDIS_URL environment variable is not defined.');
  console.warn('   Defaulting connection to redis://localhost:6379');
}

if (!process.env.DATABASE_URL) {
  console.error('❌ [Worker Error] DATABASE_URL is not defined in environment or .env file.');
  process.exit(1);
}

const worker = startWorker();

console.log('⏳ [Worker Service] Worker service initialized. Waiting for incoming jobs...');

const handleShutdown = async (signal: string) => {
  console.log(`\n🛑 [Worker Service] Received ${signal}. Closing worker gracefully...`);
  try {
    await worker.close();
    console.log('👋 [Worker Service] Worker connection closed cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('❌ [Worker Service] Error while shutting down worker:', err);
    process.exit(1);
  }
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
