# API Testing Guide

**Document Version**: 1.0.0  
**Last Updated**: March 14, 2026  
**Framework**: Jest + Axios  

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Setup](#environment-setup)
3. [Running Tests](#running-tests)
4. [Test Structure](#test-structure)
5. [Manual Testing Guide](#manual-testing-guide)
6. [Debugging](#debugging)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- Node.js v16+
- npm or yarn
- Git
- Docker (for Neo4j - optional)

### Installation

```bash
# Backend
cd Backend
npm install
npm install --save-dev jest @jest/globals

# Frontend
cd Frontend
npm install
npm install --save-dev jest @jest/globals
```

### Run Tests

```bash
# Backend tests
cd Backend
npm test

# Frontend tests
cd Frontend
npm test

# All tests
npm test -- --projects Backend Frontend
```

---

## Environment Setup

### Backend (.env)

```env
# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Neo4j (Optional for basic API tests)
NEO4J_URI=neo4j://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
```

### Frontend (.env.local)

```env
REACT_APP_API_URL=http://localhost:5000/api
```

### Neo4j Setup (Docker)

```bash
# Start Neo4j in Docker
docker run -d \
  -p 7687:7687 \
  -p 7474:7474 \
  -e NEO4J_AUTH=neo4j/password \
  -e NEO4J_PLUGINS='["apoc"]' \
  neo4j:latest

# Access Neo4j Browser at http://localhost:7474
```

---

## Running Tests

### Run All Backend Tests

```bash
npm test
```

### Run Specific Test Suite

```bash
npm test -- --testNamePattern="Health Check"
```

### Run with Coverage

```bash
npm test -- --coverage
```

### Run in Watch Mode

```bash
npm test -- --watch
```

### Run with Verbose Output

```bash
npm test -- --verbose
```

### Run Frontend Tests

```bash
cd Frontend
npm test -- --testPathPattern="integration.test.js"
```

---

## Test Structure

### Backend Tests

Located in: `Backend/tests/api.test.js`

#### Test Categories

1. **Health Check Endpoints** (2 tests)
   - Tests basic API connectivity
   - Validates health endpoint response

2. **Database Schema Setup** (2 tests)
   - Schema initialization
   - Idempotency verification

3. **Repository Scanning** (3 tests)
   - Input validation
   - Successful repository scan
   - Response structure

4. **Graph Retrieval** (3 tests)
   - 404 handling
   - Valid graph retrieval
   - Response structure validation

5. **Graph Deletion** (2 tests)
   - Non-existent graph handling
   - Valid deletion (skipped for test preservation)

6. **Graph Seeding** (3 tests)
   - Non-existent graph handling
   - Valid seeding operation
   - Response validation

7. **Metrics** (4 tests)
   - Missing scanId validation
   - Non-existent scanId handling
   - Valid metrics retrieval
   - Response structure

8. **Impact Analysis** (3 tests)
   - Missing node parameter validation
   - Valid impact queries
   - Node structure validation
   - Hops normalization

9. **Error Handling** (2 tests)
   - 404 errors
   - Invalid JSON

10. **Integration Tests** (2 tests)
    - Full workflow sequences

### Frontend Tests

Located in: `Frontend/tests/integration.test.js`

#### Test Categories

1. **API Connectivity** (2 tests)
   - Backend reachability
   - Environment info validation

2. **Repository Scan Workflow** (4 tests)
   - Empty URL validation
   - Invalid URL error handling
   - Successful scan
   - Results structure

3. **Graph Retrieval** (4 tests)
   - Visualization fetch
   - Node format validation
   - Edge format validation
   - Missing graph handling

4. **Database Seeding** (3 tests)
   - Schema initialization
   - Graph seeding
   - Metrics in seed results

5. **Dashboard Metrics** (3 tests)
   - Metrics fetching
   - Format validation (numbers not BigInt)
   - Missing metrics handling

6. **Impact Analysis** (3 tests)
   - Query validation
   - Impact query execution
   - Normalized hops validation

7. **User Workflows** (2 tests)
   - Complete analysis workflow
   - Seed→Metrics→Impact workflow

8. **Error Handling** (4 tests)
   - 404 errors
   - Server errors
   - Neo4j unavailability
   - Malformed responses

9. **Performance** (2 tests)
   - Health check response time
   - Metrics response time

10. **Data Consistency** (2 tests)
    - Consistent graph retrieval
    - Metrics consistency

---

## Manual Testing Guide

### Tool Setup

#### Using cURL

```bash
# Health check
curl http://localhost:5000/api/health

# Scan repository
curl -X POST http://localhost:5000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/tc39/test262.git"}'
```

#### Using Postman

1. **Import Collection**
   - Create new collection: "SIES-ByteCamp API"
   - Add requests for each endpoint

2. **Environment Variables**
   - `baseUrl`: http://localhost:5000
   - `repoId`: (set from scan response)
   - `scanId`: (set from seed response)

3. **Sample Requests**

**Scan Repository**
```
POST {{baseUrl}}/api/scan
Content-Type: application/json

{
  "repoUrl": "https://github.com/tc39/test262.git"
}
```

**Get Graph**
```
GET {{baseUrl}}/api/graph/{{repoId}}
```

**Seed Schema**
```
POST {{baseUrl}}/api/db/seed/schema
```

**Seed Graph**
```
POST {{baseUrl}}/api/db/seed/graph/{{repoId}}
{
  "scanId": "scan-manual-001"
}
```

**Get Metrics**
```
GET {{baseUrl}}/api/metrics/{{scanId}}
```

**Get Impact**
```
GET {{baseUrl}}/api/impact?node=field:test:testField&scanId={{scanId}}
```

#### Using Thunder Client (VS Code)

```
# Create requests in Thunder Client
1. Health: GET /api/health
2. Scan: POST /api/scan
3. Graph: GET /api/graph/:repoId
4. Metrics: GET /api/metrics/:scanId
5. Impact: GET /api/impact?node=...&scanId=...
```

### Test Scenarios

#### Scenario 1: Basic Connectivity

```bash
# 1. Check health
curl http://localhost:5000/api/health

# Expected: 200, healthy status
```

#### Scenario 2: Complete Graph Workflow

```bash
# 1. Scan repository
REPO_RESPONSE=$(curl -s -X POST http://localhost:5000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/tc39/test262.git"}')

REPO_ID=$(echo $REPO_RESPONSE | jq -r '.data.repoId')

# 2. Get graph (wait for clone to complete)
curl http://localhost:5000/api/graph/$REPO_ID

# Expected: 200, nodes and edges
```

#### Scenario 3: Full Database Integration

```bash
# 1. Initialize schema
curl -X POST http://localhost:5000/api/db/seed/schema

# 2. Seed graph (with previous repoId)
SEED_RESPONSE=$(curl -s -X POST http://localhost:5000/api/db/seed/graph/$REPO_ID \
  -H "Content-Type: application/json" \
  -d '{"scanId":"scan-manual-001"}')

SCAN_ID=$(echo $SEED_RESPONSE | jq -r '.data.scanId')

# 3. Get metrics
curl http://localhost:5000/api/metrics/$SCAN_ID

# Expected: 200, metrics with totalServices and totalDependencies
```

---

## Debugging

### Enable Test Logging

```bash
# Verbose output
npm test -- --verbose

# With console output
npm test -- --verbose --silent=false
```

### Debug Specific Test

```bash
# Single test
npm test -- --testNamePattern="Frontend can fetch graph"

# With debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

### View Test Results

```bash
# Generate JSON report
npm test -- --json --outputFile=test-results.json

# View report
cat test-results.json | jq .
```

### Check Response Data

Add logging in test files:

```javascript
test('example', async () => {
  const res = await apiRequest('GET', '/api/health');
  console.log('Response:', JSON.stringify(res.data, null, 2)); // Log response
  expect(res.status).toBe(200);
});
```

### Common Debug Scenarios

**Test Timeout**
```javascript
test('timeout issue', async () => {
  // Increase timeout for long operations
  // Top of test file or test()
}, 60000); // 60 seconds
```

**Neo4j Unavailable**
```javascript
test('handle neo4j error', async () => {
  // Check for 503 status
  if (res.status === 503) {
    console.log('Neo4j not available (expected)');
  }
});
```

**Invalid Response**
```javascript
test('validate response', async () => {
  console.log('Actual response:', res.data);
  expect(res.data).toHaveProperty('data'); // Will show missing field
});
```

---

## Troubleshooting

### Test Failures

#### "Cannot find module 'jest'"

```bash
npm install --save-dev jest @jest/globals
```

#### "ECONNREFUSED - Connection refused"

**Backend not running**
```bash
cd Backend
npm start
# Or for development
npm run dev
```

**Neo4j not running (if tests require it)**
```bash
docker run -d -p 7687:7687 -p 7474:7474 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:latest
```

#### "Timeout - tests don't complete"

1. Check if backend is responding
2. Increase Jest timeout:
   ```javascript
   jest.setTimeout(60000);
   ```
3. Check network connectivity
4. Check repository size (very large repos take time)

#### "404 Not Found"

```
// Backend not started
// Or endpoint path incorrect
// Check route definitions in src/routes/
```

#### "Neo4j unavailable" (503 status)

**Expected behavior** if Neo4j is not configured. Tests should handle this gracefully.

To enable Neo4j:
1. Set `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` in `.env`
2. Ensure Neo4j server is running
3. Check neo4j.js configuration file

---

### Integration Issues

#### Frontend API calls fail

```javascript
// Check CORS
// Check API_URL environment variable
// Check backend is running on correct port
```

#### Metrics return 0 values

```javascript
// Graph may not be seeded to database
// Check seed operation completed successfully
// Verify Neo4j connectivity
```

#### Impact analysis returns empty

```javascript
// Node ID may not exist in database
// Verify node format: type:scanId:nodeId
// Check scanId matches seeded graph
```

---

### Performance Issues

#### Tests run slowly

1. **Disable verbose mode for speed**
   ```bash
   npm test -- --silent
   ```

2. **Run tests in parallel (default)**
   ```bash
   npm test -- --maxWorkers=4
   ```

3. **Skip network tests during debugging**
   ```bash
   npm test -- --testNamePattern="!POST /scan"
   ```

#### Repository scanning slow

- Large repositories take time
- Network limited
- Disk I/O bottleneck
- Consider using smaller test repositories

---

## Test Data Management

### Using Test Fixtures

Create `Backend/tests/fixtures/` for test data:

```javascript
// fixtures/sample-graph.json
{
  "nodes": [...],
  "edges": [...],
  "summary": {...}
}

// In test
const sampleGraph = require('./fixtures/sample-graph.json');
```

### Cleanup

Tests should clean up after themselves:

```javascript
afterEach(async () => {
  // Delete test graph
  await apiRequest('DELETE', `/graph/${TEST_REPO_ID}`);
});
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      neo4j:
        image: neo4j:latest
        env:
          NEO4J_AUTH: neo4j/password

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install Backend
        run: cd Backend && npm install
      
      - name: Run Backend Tests
        run: cd Backend && npm test
      
      - name: Install Frontend
        run: cd Frontend && npm install
      
      - name: Run Frontend Tests
        run: cd Frontend && npm test
```

---

## Best Practices

1. **Test Independence**: Each test should be independent
2. **Clear Names**: Use descriptive test names
3. **Assertions**: One assertion per test when possible
4. **Speeds**: Tests should run in < 500ms (except network calls)
5. **Cleanup**: Always clean up test data
6. **Error Messages**: Use descriptive error messages
7. **Mocking**: Mock external services when needed
8. **Coverage**: Aim for > 80% code coverage

---

## Performance Benchmarks

| Operation | Expected Time | Notes |
|-----------|--------------|-------|
| Health check | < 100ms | Baseline |
| Graph retrieval | < 500ms | Depends on size |
| Metrics query | < 1s | Neo4j dependent |
| Impact analysis | < 2s | Traversal limited to 1-6 hops |
| Scan (small repo) | 10-30s | Network dependent |
| Scan (large repo) | 1-5 min | Repository size dependent |

---

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [Axios Documentation](https://axios-http.com/)
- [Neo4j Query Language](https://neo4j.com/developer/cypher/)
- [REST API Best Practices](https://restfulapi.net/)

---

**End of Testing Guide**
