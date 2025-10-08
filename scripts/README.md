# Scripts

## Test Database Cleanup

### Automatic Cleanup

Test databases are automatically cleaned up after running tests thanks to Jest's `globalTeardown` hook configured in [package.json](../package.json#L80).

When you run `yarn test`, Jest will:
1. Create temporary databases for each test (named `DB_<timestamp>`)
2. Run all tests
3. Automatically drop all test databases via `jest.globalTeardown.js`

### Manual Cleanup

If you need to manually clean up test databases (e.g., after tests crash or are interrupted), run:

```bash
yarn test:cleanup
```

or directly:

```bash
node scripts/cleanup-test-dbs.js
```

This script will:
- Connect to your MongoDB instance
- Find all test databases (those starting with `DB_` or containing `test`)
- Display the list of databases and their sizes
- Drop all test databases
- Show a summary of cleaned databases

### Configuration

The MongoDB connection URL can be configured via the `MONGO_URL` environment variable:

```bash
MONGO_URL=mongodb://localhost:27017/perps-trader node scripts/cleanup-test-dbs.js
```

By default, it uses `mongodb://localhost:27017/perps-trader`.
