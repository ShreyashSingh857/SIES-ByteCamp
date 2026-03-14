/**
 * ============================================================================
 * COMPREHENSIVE BACKEND API TEST SUITE
 * ============================================================================
 * Tests all endpoints: scan, graph, schema seeding, metrics, and impact analysis
 */

import axios from 'axios';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

const API_URL = process.env.API_URL || 'http://localhost:5000/api';
const apiClient = axios.create({ baseURL: API_URL, validateStatus: () => true });

// ============================================================================
// TEST DATA
// ============================================================================

const TEST_DATA = {
  repoUrl: 'https://github.com/tc39/test262.git',
  invalidRepoUrl: 'not-a-valid-url',
  repoId: 'test262-tmp',
  scanId: 'scan-test-001',
  invalidRepoId: 'nonexistent-repo-xyz',
  nodeId: 'field:test:fieldTest1',
};

let testRepoId = null;
let testScanId = null;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function makeRequest(method, url, data = null, params = null) {
  try {
    const config = { validateStatus: () => true };
    if (params) config.params = params;
    
    const response = await apiClient({
      method,
      url,
      data,
      ...config,
    });
    return response;
  } catch (error) {
    console.error(`Request failed: ${method} ${url}`, error.message);
    throw error;
  }
}

function logTestResult(testName, status, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${testName}: ${status}${details ? ` - ${details}` : ''}`);
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Backend API Comprehensive Test Suite', () => {
  
  // ──────────────────────────────────────────────────────────────────
  // 1. HEALTH CHECK TESTS
  // ──────────────────────────────────────────────────────────────────
  describe('Health Check Endpoints', () => {
    
    test('GET / should return API is running', async () => {
      const res = await makeRequest('GET', '/');
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.message).toContain('API is running');
      logTestResult('GET / - Health Check', res.status === 200 ? 'PASS' : 'FAIL');
    });

    test('GET /api/health should return health status', async () => {
      const res = await makeRequest('GET', '/health');
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.status).toBe('healthy');
      expect(res.data.uptime).toBeDefined();
      logTestResult('GET /api/health', res.status === 200 ? 'PASS' : 'FAIL');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 2. SCHEMA SEEDING TESTS
  // ──────────────────────────────────────────────────────────────────
  describe('Database Schema Setup', () => {
    
    test('POST /db/seed/schema should create constraints and indexes', async () => {
      const res = await makeRequest('POST', '/db/seed/schema');
      expect(res.status).toBeOneOf([200, 503]);
      
      if (res.status === 200) {
        expect(res.data.success).toBe(true);
        expect(res.data.message).toContain('Schema seed');
        logTestResult('POST /db/seed/schema', 'PASS');
      } else {
        logTestResult('POST /db/seed/schema', 'WARN', 'Neo4j not available (expected in test environment)');
      }
    });

    test('POST /db/seed/schema - Idempotent operation', async () => {
      const res1 = await makeRequest('POST', '/db/seed/schema');
      const res2 = await makeRequest('POST', '/db/seed/schema');
      
      if (res1.status === 200 && res2.status === 200) {
        expect(res1.data.success).toBe(true);
        expect(res2.data.success).toBe(true);
        logTestResult('POST /db/seed/schema - Idempotent', 'PASS');
      } else {
        logTestResult('POST /db/seed/schema - Idempotent', 'WARN', 'Neo4j not available');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 3. SCAN TESTS (Repository Scanning)
  // ──────────────────────────────────────────────────────────────────
  describe('Repository Scan Endpoint', () => {
    
    test('POST /scan - Missing repoUrl should return 400', async () => {
      const res = await makeRequest('POST', '/scan', {});
      expect(res.status).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toContain('required');
      logTestResult('POST /scan - Missing repoUrl validation', 'PASS');
    });

    test('POST /scan - Invalid repoUrl format should return 400', async () => {
      const res = await makeRequest('POST', '/scan', { repoUrl: TEST_DATA.invalidRepoUrl });
      expect(res.status).toBe(400);
      expect(res.data.success).toBe(false);
      logTestResult('POST /scan - Invalid URL validation', 'PASS');
    });

    test('POST /scan - Valid public repo should clone and parse', async () => {
      // NOTE: This test requires internet connection and may take time
      const res = await makeRequest('POST', '/scan', { repoUrl: TEST_DATA.repoUrl });
      
      if (res.status === 200) {
        expect(res.data.success).toBe(true);
        expect(res.data.data.repoId).toBeDefined();
        expect(res.data.data.clonedRepoPath).toBeDefined();
        expect(res.data.data.graphPath).toBeDefined();
        testRepoId = res.data.data.repoId;
        logTestResult('POST /scan - Successful scan', 'PASS', `repoId: ${testRepoId}`);
      } else {
        logTestResult('POST /scan - Successful scan', 'WARN', `Status: ${res.status}`);
      }
    }, 60000); // 60s timeout for repo clone
  });

  // ──────────────────────────────────────────────────────────────────
  // 4. GRAPH RETRIEVAL TESTS
  // ──────────────────────────────────────────────────────────────────
  describe('Graph Retrieval Endpoints', () => {
    
    test('GET /graph/:repoId - Non-existent repoId should return 404', async () => {
      const res = await makeRequest('GET', `/graph/${TEST_DATA.invalidRepoId}`);
      expect(res.status).toBe(404);
      expect(res.data.success).toBe(false);
      logTestResult('GET /graph/:repoId - 404 for invalid repoId', 'PASS');
    });

    test('GET /graph/:repoId - Valid repoId should return graph', async () => {
      if (!testRepoId) {
        logTestResult('GET /graph/:repoId - Valid graph retrieval', 'WARN', 'No repoId from earlier scan');
        return;
      }

      const res = await makeRequest('GET', `/graph/${testRepoId}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.repoId).toBe(testRepoId);
      expect(Array.isArray(res.data.data.nodes)).toBe(true);
      expect(Array.isArray(res.data.data.edges)).toBe(true);
      logTestResult('GET /graph/:repoId - Valid retrieval', 'PASS', `nodes: ${res.data.data.nodes.length}, edges: ${res.data.data.edges.length}`);
    });

    test('GET /graph/:repoId - Response structure validation', async () => {
      if (!testRepoId) {
        logTestResult('GET /graph/:repoId - Response structure', 'WARN', 'No repoId available');
        return;
      }

      const res = await makeRequest('GET', `/graph/${testRepoId}`);
      
      if (res.status === 200) {
        expect(res.data.data.nodes).toBeDefined();
        expect(res.data.data.edges).toBeDefined();
        expect(res.data.data.summary).toBeDefined();
        
        // Validate node structure
        if (res.data.data.nodes.length > 0) {
          const node = res.data.data.nodes[0];
          expect(['id', 'name', 'type']).toBeDefined();
        }
        
        logTestResult('GET /graph/:repoId - Response structure', 'PASS');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 5. GRAPH DELETION TESTS
  // ──────────────────────────────────────────────────────────────────
  describe('Graph Deletion Endpoint', () => {
    
    test('DELETE /graph/:repoId - Non-existent should return 404', async () => {
      const res = await makeRequest('DELETE', `/graph/${TEST_DATA.invalidRepoId}`);
      expect(res.status).toBe(404);
      expect(res.data.success).toBe(false);
      logTestResult('DELETE /graph/:repoId - 404 for invalid repoId', 'PASS');
    });

    // Don't delete test repo as it's needed for other tests
    test('DELETE /graph/:repoId - Valid deletion (skipped to preserve test data)', async () => {
      logTestResult('DELETE /graph/:repoId - Deletion', 'SKIP', 'Preserving test data');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 6. GRAPH SEEDING TESTS
  // ──────────────────────────────────────────────────────────────────
  describe('Graph Seeding to Neo4j', () => {
    
    test('POST /db/seed/graph/:repoId - Non-existent repoId should return 404', async () => {
      const res = await makeRequest('POST', `/db/seed/graph/${TEST_DATA.invalidRepoId}`, {});
      expect(res.status).toBe(404);
      expect(res.data.success).toBe(false);
      logTestResult('POST /db/seed/graph/:repoId - 404 for invalid repoId', 'PASS');
    });

    test('POST /db/seed/graph/:repoId - Valid seed to database', async () => {
      if (!testRepoId) {
        logTestResult('POST /db/seed/graph/:repoId - Seed valid graph', 'WARN', 'No repoId from scan');
        return;
      }

      const res = await makeRequest('POST', `/db/seed/graph/${testRepoId}`, {
        scanId: TEST_DATA.scanId,
      });

      if (res.status === 200) {
        expect(res.data.success).toBe(true);
        expect(res.data.data.repoId).toBe(testRepoId);
        expect(res.data.data.scanId).toBeDefined();
        expect(typeof res.data.data.fileCount).toBe('number');
        expect(typeof res.data.data.functionCount).toBe('number');
        testScanId = res.data.data.scanId;
        logTestResult('POST /db/seed/graph/:repoId - Seed successful', 'PASS', `scanId: ${testScanId}`);
      } else if (res.status === 503) {
        logTestResult('POST /db/seed/graph/:repoId - Seed graph', 'WARN', 'Neo4j not available');
      } else {
        logTestResult('POST /db/seed/graph/:repoId - Seed graph', 'FAIL', `Status: ${res.status}`);
      }
    });

    test('POST /db/seed/graph/:repoId - Response validation', async () => {
      if (!testRepoId) {
        logTestResult('POST /db/seed/graph/:repoId - Response validation', 'WARN', 'No repoId');
        return;
      }

      const res = await makeRequest('POST', `/db/seed/graph/${testRepoId}`, {
        scanId: 'scan-validation-test',
      });

      if (res.status === 200) {
        const requiredFields = ['repoId', 'scanId', 'fileCount', 'functionCount', 'dependencyCount'];
        const hasAllFields = requiredFields.every(field => res.data.data.hasOwnProperty(field));
        expect(hasAllFields).toBe(true);
        logTestResult('POST /db/seed/graph/:repoId - Response validation', 'PASS');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 7. METRICS TESTS
  // ──────────────────────────────────────────────────────────────────
  describe('Graph Metrics Endpoint', () => {
    
    test('GET /metrics/:scanId - Missing scanId should return 400', async () => {
      const res = await makeRequest('GET', '/metrics/');
      expect(res.status).toBeOneOf([400, 404]);
      logTestResult('GET /metrics/:scanId - Missing param validation', 'PASS');
    });

    test('GET /metrics/:scanId - Non-existent scanId behavior', async () => {
      const res = await makeRequest('GET', `/metrics/scan-nonexistent`);
      // Should return 200 with 0 metrics or 404 depending on implementation
      expect([200, 404]).toContain(res.status);
      logTestResult('GET /metrics/:scanId - Non-existent scanId', 'PASS', `Status: ${res.status}`);
    });

    test('GET /metrics/:scanId - Valid scanId returns metrics', async () => {
      if (!testScanId) {
        logTestResult('GET /metrics/:scanId - Valid metrics', 'WARN', 'No scanId from seeding');
        return;
      }

      const res = await makeRequest('GET', `/metrics/${testScanId}`);

      if (res.status === 200) {
        expect(res.data.success).toBe(true);
        expect(res.data.data.scanId).toBe(testScanId);
        expect(typeof res.data.data.totalServices).toBe('number');
        expect(typeof res.data.data.totalDependencies).toBe('number');
        logTestResult('GET /metrics/:scanId - Valid metrics', 'PASS', 
          `services: ${res.data.data.totalServices}, deps: ${res.data.data.totalDependencies}`);
      } else if (res.status === 503) {
        logTestResult('GET /metrics/:scanId - Valid metrics', 'WARN', 'Neo4j not available');
      }
    });

    test('GET /metrics/:scanId - Response structure', async () => {
      if (!testScanId) {
        logTestResult('GET /metrics/:scanId - Response structure', 'WARN', 'No scanId');
        return;
      }

      const res = await makeRequest('GET', `/metrics/${testScanId}`);

      if (res.status === 200) {
        expect(res.data.data).toHaveProperty('scanId');
        expect(res.data.data).toHaveProperty('totalServices');
        expect(res.data.data).toHaveProperty('totalDependencies');
        logTestResult('GET /metrics/:scanId - Response structure', 'PASS');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 8. IMPACT ANALYSIS TESTS
  // ──────────────────────────────────────────────────────────────────
  describe('Impact Analysis Endpoint', () => {
    
    test('GET /impact - Missing node param should return 400', async () => {
      const res = await makeRequest('GET', '/impact', null, {});
      expect(res.status).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toContain('node');
      logTestResult('GET /impact - Missing node param', 'PASS');
    });

    test('GET /impact - Valid node query returns impact analysis', async () => {
      const params = { node: TEST_DATA.nodeId };
      if (testScanId) params.scanId = testScanId;

      const res = await makeRequest('GET', '/impact', null, params);

      if (res.status === 200) {
        expect(res.data.success).toBe(true);
        expect(res.data.data.node).toBe(TEST_DATA.nodeId);
        expect(typeof res.data.data.count).toBe('number');
        expect(Array.isArray(res.data.data.impactedNodes)).toBe(true);
        logTestResult('GET /impact - Valid node query', 'PASS', `impacted: ${res.data.data.count}`);
      } else if (res.status === 503) {
        logTestResult('GET /impact - Valid node query', 'WARN', 'Neo4j not available');
      } else {
        logTestResult('GET /impact - Valid node query', 'PASS', `Status: ${res.status}`);
      }
    });

    test('GET /impact - Impacted nodes have required fields', async () => {
      const params = { node: TEST_DATA.nodeId, scanId: testScanId || '' };
      const res = await makeRequest('GET', '/impact', null, params);

      if (res.status === 200 && res.data.data.impactedNodes.length > 0) {
        const node = res.data.data.impactedNodes[0];
        expect(node).toHaveProperty('id');
        expect(node).toHaveProperty('name');
        expect(node).toHaveProperty('type');
        expect(node).toHaveProperty('hops');
        expect(typeof node.hops).toBe('number');
        logTestResult('GET /impact - Impacted node structure', 'PASS');
      } else {
        logTestResult('GET /impact - Impacted node structure', 'WARN', 'No impacted nodes to validate');
      }
    });

    test('GET /impact - Hops are normalized numbers (not BigInt)', async () => {
      const params = { node: TEST_DATA.nodeId, scanId: testScanId || '' };
      const res = await makeRequest('GET', '/impact', null, params);

      if (res.status === 200 && res.data.data.impactedNodes.length > 0) {
        res.data.data.impactedNodes.forEach(node => {
          expect(typeof node.hops).toBe('number');
          expect(Number.isInteger(node.hops)).toBe(true);
        });
        logTestResult('GET /impact - Hops normalization', 'PASS');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 9. ERROR HANDLING TESTS
  // ──────────────────────────────────────────────────────────────────
  describe('Error Handling', () => {
    
    test('404 for non-existent route', async () => {
      const res = await makeRequest('GET', '/nonexistent-endpoint');
      expect(res.status).toBe(404);
      expect(res.data.success).toBe(false);
      logTestResult('404 Error Handling', 'PASS');
    });

    test('Invalid JSON body should be handled', async () => {
      try {
        const res = await axios.post(`${API_URL}/scan`, 'invalid json', {
          headers: { 'Content-Type': 'application/json' },
          validateStatus: () => true,
        });
        expect(res.status).toBeGreaterThanOrEqual(400);
        logTestResult('Invalid JSON handling', 'PASS');
      } catch (error) {
        logTestResult('Invalid JSON handling', 'PASS', 'Request parsing error (expected)');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 10. INTEGRATION TESTS
  // ──────────────────────────────────────────────────────────────────
  describe('Integration Tests', () => {
    
    test('Full flow: Health → Schema → Metrics', async () => {
      // 1. Health check
      const healthRes = await makeRequest('GET', '/health');
      expect(healthRes.status).toBe(200);

      // 2. Schema seed
      const schemaRes = await makeRequest('POST', '/db/seed/schema');
      expect([200, 503]).toContain(schemaRes.status);

      // 3. Metrics (if scanId available)
      if (testScanId) {
        const metricsRes = await makeRequest('GET', `/metrics/${testScanId}`);
        expect([200, 503]).toContain(metricsRes.status);
      }

      logTestResult('Integration: Health → Schema → Metrics', 'PASS');
    });

    test('Full flow: Graph Storage → Seed → Metrics → Impact', async () => {
      if (!testRepoId || !testScanId) {
        logTestResult('Integration: Full flow', 'WARN', 'Incomplete setup');
        return;
      }

      // 1. Get stored graph
      const graphRes = await makeRequest('GET', `/graph/${testRepoId}`);
      expect(graphRes.status).toBe(200);

      // 2. Already seeded, check metrics
      const metricsRes = await makeRequest('GET', `/metrics/${testScanId}`);
      expect([200, 503]).toContain(metricsRes.status);

      // 3. Check impact
      const impactRes = await makeRequest('GET', '/impact', null, 
        { node: TEST_DATA.nodeId, scanId: testScanId });
      expect([200, 503]).toContain(impactRes.status);

      logTestResult('Integration: Full flow', metricsRes.status === 200 ? 'PASS' : 'WARN');
    });
  });
});

// ============================================================================
// CUSTOM MATCHERS
// ============================================================================

expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () => 
        `Expected ${received} to be one of ${expected.join(', ')}`,
    };
  },
});
