#!/usr/bin/env node

/**
 * Cleanup script for test databases
 * Removes all databases matching test patterns (DB_*, test*, etc.)
 */

const { MongoClient } = require('mongodb');

async function cleanupTestDatabases() {
  const mongoUrl =
    process.env.MONGO_URL || 'mongodb://localhost:27017/perps-trader';

  console.log(`Connecting to MongoDB: ${mongoUrl.split('@').pop()}`);

  try {
    const client = new MongoClient(mongoUrl);
    await client.connect();

    // Get all databases
    const adminDb = client.db().admin();
    const { databases } = await adminDb.listDatabases();

    // Filter test databases
    const testDatabases = databases.filter(
      (db) =>
        db.name.startsWith('DB_') ||
        (db.name.includes('test') && db.name !== 'admin') ||
        db.name.match(/DB_\d+/),
    );

    if (testDatabases.length === 0) {
      console.log('No test databases found.');
      await client.close();
      return;
    }

    console.log(`\nFound ${testDatabases.length} test database(s):`);
    testDatabases.forEach((db) => {
      console.log(`  - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });

    console.log('\nDropping test databases...');

    // Drop all test databases
    for (const db of testDatabases) {
      try {
        await client.db(db.name).dropDatabase();
        console.log(`✓ Dropped: ${db.name}`);
      } catch (error) {
        console.error(`✗ Failed to drop ${db.name}:`, error.message);
      }
    }

    await client.close();

    console.log(
      `\n✓ Cleanup complete! Removed ${testDatabases.length} database(s).`,
    );
  } catch (error) {
    console.error('Failed to cleanup test databases:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  cleanupTestDatabases();
}

module.exports = cleanupTestDatabases;
