import dotenv from 'dotenv';
import { prisma } from './client';

// Load environment variables from .env
dotenv.config();

async function main() {
  console.log('================================================================');
  console.log(' Contracta - Phase 6 Prisma Database & Cascade Verification Test');
  console.log('================================================================');

  if (!process.env.DATABASE_URL) {
    console.error('\n❌ DATABASE_URL is not defined in your environment or .env file.');
    console.error('👉 Please set DATABASE_URL in your .env file and run migrations first:');
    console.error('   npx prisma migrate dev --name init\n');
    process.exit(1);
  }

  const uniqueSuffix = Date.now().toString();

  try {
    // 1. Create dummy User
    console.log('\n1. Creating dummy User...');
    const user = await prisma.user.create({
      data: {
        githubId: `gh-user-${uniqueSuffix}`,
        githubUsername: `octocat-${uniqueSuffix}`,
        email: `octocat.${uniqueSuffix}@example.com`,
      },
    });
    console.log(`   ✅ User created: ID = ${user.id} (@${user.githubUsername})`);

    // 2. Create Installation under User
    console.log('\n2. Creating GitHub App Installation under User...');
    const installation = await prisma.installation.create({
      data: {
        githubInstallationId: `gh-inst-${uniqueSuffix}`,
        userId: user.id,
      },
    });
    console.log(`   ✅ Installation created: ID = ${installation.id}`);

    // 3. Create Repo under Installation
    console.log('\n3. Creating Repository under Installation...');
    const repo = await prisma.repo.create({
      data: {
        installationId: installation.id,
        githubRepoId: `gh-repo-${uniqueSuffix}`,
        owner: user.githubUsername,
        name: 'sample-express-api',
        defaultBranch: 'main',
      },
    });
    console.log(`   ✅ Repo created: ID = ${repo.id} (${repo.owner}/${repo.name})`);

    // 4. Create Baseline under Repo
    console.log('\n4. Creating Baseline OpenAPI spec under Repo...');
    const fakeSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Sample Express App API',
        version: '1.0.0',
      },
      paths: {
        '/api/users': {
          get: {
            summary: 'List users',
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };

    const baseline = await prisma.baseline.create({
      data: {
        repoId: repo.id,
        version: 1,
        specJson: fakeSpec,
      },
    });
    console.log(`   ✅ Baseline created: ID = ${baseline.id} (Version ${baseline.version})`);

    // 5. Create DriftReport under Repo
    console.log('\n5. Creating DriftReport under Repo...');
    const driftReport = await prisma.driftReport.create({
      data: {
        repoId: repo.id,
        baselineVersion: 1,
        diffJson: [
          {
            severity: 'breaking',
            method: 'DELETE',
            path: '/api/users/{id}',
            changeType: 'endpoint-removed',
            description: 'Endpoint DELETE /api/users/{id} was removed',
          },
        ],
        severity: 'breaking',
        githubIssueUrl: 'https://github.com/octocat/sample-express-api/issues/1',
      },
    });
    console.log(`   ✅ DriftReport created: ID = ${driftReport.id} (Severity: ${driftReport.severity})`);

    // 6. Read back full relational tree
    console.log('\n6. Querying full relational tree from User -> Installation -> Repo -> Baseline & DriftReport...');
    const fetchedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        installations: {
          include: {
            repos: {
              include: {
                baselines: true,
                driftReports: true,
              },
            },
          },
        },
      },
    });

    const fetchedInstallation = fetchedUser?.installations[0];
    const fetchedRepo = fetchedInstallation?.repos[0];
    const fetchedBaseline = fetchedRepo?.baselines[0];
    const fetchedReport = fetchedRepo?.driftReports[0];

    if (!fetchedUser || !fetchedInstallation || !fetchedRepo || !fetchedBaseline || !fetchedReport) {
      throw new Error('Relation tree query did not return all expected nested records.');
    }

    console.log(`   ✅ Successfully read back relational hierarchy:`);
    console.log(`      User: ${fetchedUser.githubUsername}`);
    console.log(`      └─ Installation: ${fetchedInstallation.githubInstallationId}`);
    console.log(`         └─ Repo: ${fetchedRepo.owner}/${fetchedRepo.name}`);
    console.log(`            ├─ Baseline v${fetchedBaseline.version} (${(fetchedBaseline.specJson as any).info?.title})`);
    console.log(`            └─ DriftReport (${fetchedReport.severity})`);

    // 7. Verify Cascading Deletes
    console.log('\n7. Testing Cascading Delete: Deleting User and verifying all child entities are removed...');
    await prisma.user.delete({
      where: { id: user.id },
    });

    const checkInstallation = await prisma.installation.findUnique({ where: { id: installation.id } });
    const checkRepo = await prisma.repo.findUnique({ where: { id: repo.id } });
    const checkBaseline = await prisma.baseline.findUnique({ where: { id: baseline.id } });
    const checkReport = await prisma.driftReport.findUnique({ where: { id: driftReport.id } });

    if (checkInstallation || checkRepo || checkBaseline || checkReport) {
      throw new Error('Cascade delete failed! One or more child records still exist.');
    }

    console.log('   ✅ Cascade verified: Installation, Repo, Baseline, and DriftReport all successfully deleted.');

    console.log('\n================================================================');
    console.log(' 🎉 Phase 6 Database Verification Passed Successfully!');
    console.log('================================================================\n');
  } catch (error: any) {
    console.error('\n❌ Test execution encountered an error:', error.message || error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
