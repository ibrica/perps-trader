const { MongoClient } = require('mongodb');

module.exports = async () => {
  try {
    const mongoUrl =
      process.env.MONGO_URL || 'mongodb://localhost:27017/perps-trader';

    // Connect to MongoDB
    const client = new MongoClient(mongoUrl);
    await client.connect();

    // Get all databases
    const adminDb = client.db().admin();
    const { databases } = await adminDb.listDatabases();

    // Filter test databases (those starting with 'DB_' or matching test patterns)
    const testDatabases = databases.filter(
      (db) =>
        db.name.startsWith('DB_') ||
        db.name.includes('test') ||
        db.name.match(/DB_\d+/),
    );

    // Drop all test databases
    for (const db of testDatabases) {
      await client.db(db.name).dropDatabase();
    }

    await client.close();

    console.log(
      `Successfully cleaned up ${testDatabases.length} test database(s)`,
    );
  } catch (error) {
    console.error('Failed to cleanup test databases:', error);
    // Don't fail the test suite if cleanup fails
  }
};
