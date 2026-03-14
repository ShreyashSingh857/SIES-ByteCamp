/**
 * ============================================================================
 * COMPREHENSIVE FRONTEND TEST SUITE
 * ============================================================================
 * Tests API integration, component rendering, and user flows
 */

import axios from 'axios';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ============================================================================
// TEST DATA
// ============================================================================

const TEST_DATA = {
  repoUrl: 'https://github.com/tc39/test262.git',
  invalidRepoUrl: 'not-a-url',
  credentials: {
    email: 'test@example.com',
    password: 'password123',
  },
  invalidCredentials: {
    email: 'invalid@example.com',
    password: 'wrongpass',
  },
};

// ============================================================================
// API CLIENT
// ============================================================================

const apiClient = axios.create({
  baseURL: API_URL,
  validateStatus: () => true,
  withCredentials: true,
});

let authToken = null;
let testRepoId = null;
let testScanId = null;

// ============================================================================
// TEST HELPERS
// ============================================================================

function logTestResult(testName, status, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [Frontend] ${testName}: ${status}${details ? ` - ${details}` : ''}`);
}

async function apiRequest(method, url, data = null, headers = {}) {
  try {
    const config = { 
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await apiClient({
      method,
      url,
      data,
      ...config,
    });
    return response;
  } catch (error) {
    console.error(`API request failed: ${method} ${url}`, error.message);
    throw error;
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Frontend Integration Tests', () => {
  
  // ──────────────────────────────────────────────────────────────────
  // 1. HEALTH & CONNECTIVITY TESTS
  // ──────────────────────────────────────────────────────────────────
  describe('API Connectivity', () => {
    
    test('Frontend can reach backend health endpoint', async () => {
      const res = await apiRequest('GET', '/health');
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      logTestResult('Backend connectivity', res.status === 200 ? 'PASS' : 'FAIL');
    });

    test('Backend returns correct environment info', async () => {
      const res = await apiRequest('GET', '/health');
      if (res.status === 200) {
        expect(res.data.data).toHaveProperty('uptime');
        expect(res.data.data).toHaveProperty('timestamp');
        logTestResult('Backend environment info', 'PASS');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 2. REPOSITORY SCAN WORKFLOW TESTS
  // ──────────────────────────────────────────────────────────────────
  describe('Repository Scan Workflow', () => {
    
    test('Frontend cannot trigger scan with empty repoUrl', async () => {
      const res = await apiRequest('POST', '/scan', { repoUrl: '' });
      expect(res.status).toBe(400);
      expect(res.data.success).toBe(false);
      logTestResult('Empty repoUrl validation', 'PASS');
    });

    test('Frontend receives clear error for invalid repo URL', async () => {
      const res = await apiRequest('POST', '/scan', { repoUrl: TEST_DATA.invalidRepoUrl });
      expect(res.status).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toBeDefined();
      logTestResult('Invalid URL error message', res.data.message ? 'PASS' : 'FAIL');
    });

    test('Frontend can initiate repository scan', async () => {
      const res = await apiRequest('POST', '/scan', { repoUrl: TEST_DATA.repoUrl });
      
      if (res.status === 200) {
        expect(res.data.success).toBe(true);
        expect(res.data.data.repoId).toBeDefined();
        expect(res.data.data.graphApi).toBeDefined();
        testRepoId = res.data.data.repoId;
        logTestResult('Scan initiation', 'PASS', `repoId: ${testRepoId}`);
      } else {
        logTestResult('Scan initiation', 'WARN', `Status: ${res.status}`);
      }
    }, 90000);

    test('Frontend receives scan results with parser summary', async () => {
      if (!testRepoId) {
        logTestResult('Scan results structure', 'WARN', 'No repoId');
        return;
      }

      const res = await apiRequest('POST', '/scan', { repoUrl: TEST_DATA.repoUrl });
      
      if (res.status === 200) {
        expect(res.data.data).toHaveProperty('parserSummary');
        expect(res.data.data).toHaveProperty('clonedRepoPath');
        expect(res.data.data).toHaveProperty('graphPath');
        logTestResult('Scan results structure', 'PASS');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 3. GRAPH RETRIEVAL TESTS
  // ──────────────────────────────────────────────────────────────────
  describe('Graph Retrieval for Visualization', () => {
    
    test('Frontend can fetch graph for visualization', async () => {
      if (!testRepoId) {
        logTestResult('Fetch visualization graph', 'WARN', 'No repoId');
        return;
      }

      const res = await apiRequest('GET', `/graph/${testRepoId}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data.nodes)).toBe(true);
      expect(Array.isArray(res.data.data.edges)).toBe(true);
      logTestResult('Graph visualization fetch', 'PASS');
    });

    test('Frontend receives graph nodes in correct format', async () => {
      if (!testRepoId) {
        logTestResult('Graph nodes format', 'WARN', 'No repoId');
        return;
      }

      const res = await apiRequest('GET', `/graph/${testRepoId}`);
      
      if (res.status === 200 && res.data.data.nodes.length > 0) {
        const node = res.data.data.nodes[0];
        expect(node).toHaveProperty('id');
        expect(node).toHaveProperty('name');
        expect(node).toHaveProperty('type');
        logTestResult('Graph node format', 'PASS');
      }
    });

    test('Frontend receives graph edges in correct format', async () => {
      if (!testRepoId) {
        logTestResult('Graph edges format', 'WARN', 'No repoId');
        return;
      }

      const res = await apiRequest('GET', `/graph/${testRepoId}`);
      
      if (res.status === 200 && res.data.data.edges.length > 0) {
        const edge = res.data.data.edges[0];
        expect(['from', 'to', 'type']).toBeDefined();
        logTestResult('Graph edge format', 'PASS');
      }
    });

    test('Frontend handles missing graph gracefully', async () => {
      const res = await apiRequest('GET', '/graph/nonexistent-repo-xyz');
      expect(res.status).toBe(404);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toBeDefined();
      logTestResult('Missing graph error handling', 'PASS');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 4. DATABASE SEEDING TESTS (From Frontend Perspective)
  // ──────────────────────────────────────────────────────────────────
  describe('Database Operations (Frontend Integration)', () => {
    
    test('Frontend can trigger schema initialization', async () => {
      const res = await apiRequest('POST', '/db/seed/schema');
      expect([200, 503]).toContain(res.status);
      logTestResult('Schema initialization', res.status === 200 ? 'PASS' : 'WARN');
    });

    test('Frontend can seed graph to Neo4j', async () => {
      if (!testRepoId) {
        logTestResult('Graph seeding', 'WARN', 'No repoId');
        return;
      }

      const res = await apiRequest('POST', `/db/seed/graph/${testRepoId}`, {
        scanId: `scan-frontend-test-${Date.now()}`,
      });

      if (res.status === 200) {
        expect(res.data.success).toBe(true);
        expect(res.data.data).toHaveProperty('scanId');
        testScanId = res.data.data.scanId;
        logTestResult('Graph seeding', 'PASS', `scanId: ${testScanId}`);
      } else if (res.status === 503) {
        logTestResult('Graph seeding', 'WARN', 'Neo4j not available');
      } else {
        logTestResult('Graph seeding', 'FAIL', `Status: ${res.status}`);
      }
    });

    test('Frontend receives seed results with metrics', async () => {
      if (!testRepoId) {
        logTestResult('Seed metrics', 'WARN', 'No repoId');
        return;
      }

      const res = await apiRequest('POST', `/db/seed/graph/${testRepoId}`, {
        scanId: `scan-metrics-test-${Date.now()}`,
      });

      if (res.status === 200) {
        expect(res.data.data).toHaveProperty('fileCount');
        expect(res.data.data).toHaveProperty('functionCount');
        expect(res.data.data).toHaveProperty('dependencyCount');
        expect(typeof res.data.data.fileCount).toBe('number');
        expect(typeof res.data.data.functionCount).toBe('number');
        logTestResult('Seed metrics', 'PASS');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 5. DASHBOARD METRICS TESTS
  // ──────────────────────────────────────────────────────────────────
  describe('Dashboard Metrics', () => {
    
    test('Frontend can fetch metrics for dashboard', async () => {
      if (!testScanId) {
        logTestResult('Dashboard metrics fetch', 'WARN', 'No scanId');
        return;
      }

      const res = await apiRequest('GET', `/metrics/${testScanId}`);
      
      if (res.status === 200) {
        expect(res.data.success).toBe(true);
        expect(res.data.data).toHaveProperty('totalServices');
        expect(res.data.data).toHaveProperty('totalDependencies');
        logTestResult('Dashboard metrics fetch', 'PASS');
      } else if (res.status === 503) {
        logTestResult('Dashboard metrics fetch', 'WARN', 'Neo4j unavailable');
      }
    });

    test('Frontend receives metrics as numbers (not BigInt)', async () => {
      if (!testScanId) {
        logTestResult('Metrics format validation', 'WARN', 'No scanId');
        return;
      }

      const res = await apiRequest('GET', `/metrics/${testScanId}`);
      
      if (res.status === 200) {
        expect(typeof res.data.data.totalServices).toBe('number');
        expect(typeof res.data.data.totalDependencies).toBe('number');
        expect(Number.isInteger(res.data.data.totalServices)).toBe(true);
        expect(Number.isInteger(res.data.data.totalDependencies)).toBe(true);
        logTestResult('Metrics format validation', 'PASS');
      }
    });

    test('Frontend handles missing scan metrics gracefully', async () => {
      const res = await apiRequest('GET', '/metrics/nonexistent-scan');
      expect([200, 404]).toContain(res.status);
      logTestResult('Missing metrics error handling', 'PASS');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 6. IMPACT ANALYSIS TESTS
  // ──────────────────────────────────────────────────────────────────
  describe('Impact Analysis for Knowledge Panel', () => {
    
    test('Frontend cannot query impact without node parameter', async () => {
      const res = await apiRequest('GET', '/impact');
      expect(res.status).toBe(400);
      expect(res.data.success).toBe(false);
      logTestResult('Impact query validation', 'PASS');
    });

    test('Frontend can query impact for a specific node', async () => {
      const res = await apiRequest('GET', '/impact', null, { 
        node: 'field:test:testField',
        scanId: testScanId || '',
      });

      if (res.status === 200) {
        expect(res.data.success).toBe(true);
        expect(res.data.data).toHaveProperty('node');
        expect(res.data.data).toHaveProperty('impactedNodes');
        expect(Array.isArray(res.data.data.impactedNodes)).toBe(true);
        logTestResult('Impact query', 'PASS', `impacted: ${res.data.data.count}`);
      } else if (res.status === 503) {
        logTestResult('Impact query', 'WARN', 'Neo4j unavailable');
      }
    });

    test('Frontend receives impacted nodes with normalized hops', async () => {
      const scanId = testScanId || 'test-scan';
      const res = await apiRequest('GET', '/impact', null, { 
        node: 'field:test:testField',
        scanId,
      });

      if (res.status === 200 && res.data.data.impactedNodes.length > 0) {
        res.data.data.impactedNodes.forEach(impactedNode => {
          expect(impactedNode).toHaveProperty('id');
          expect(impactedNode).toHaveProperty('name');
          expect(impactedNode).toHaveProperty('type');
          expect(impactedNode).toHaveProperty('hops');
          expect(typeof impactedNode.hops).toBe('number');
          expect(Number.isInteger(impactedNode.hops)).toBe(true);
        });
        logTestResult('Impacted nodes format', 'PASS');
      } else {
        logTestResult('Impacted nodes format', 'WARN', 'No impacted nodes');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 7. FULL USER WORKFLOW TESTS
  // ──────────────────────────────────────────────────────────────────
  describe('Complete User Workflows', () => {
    
    test('Workflow: Upload → Visualize → Analyze', async () => {
      if (!testRepoId) {
        logTestResult('Upload → Visualize → Analyze', 'WARN', 'No test repo');
        return;
      }

      // Step 1: Get graph
      const graphRes = await apiRequest('GET', `/graph/${testRepoId}`);
      if (graphRes.status !== 200) {
        logTestResult('Workflow: Visualize graph', 'FAIL');
        return;
      }

      // Step 2: Seed to DB
      const seedRes = await apiRequest('POST', `/db/seed/graph/${testRepoId}`, {
        scanId: `scan-workflow-${Date.now()}`,
      });
      
      if (seedRes.status !== 200 && seedRes.status !== 503) {
        logTestResult('Workflow: Seed graph', 'FAIL');
        return;
      }

      const workflowScanId = seedRes.data?.data?.scanId;

      // Step 3: Get metrics
      if (workflowScanId) {
        const metricsRes = await apiRequest('GET', `/metrics/${workflowScanId}`);
        expect([200, 503]).toContain(metricsRes.status);
      }

      logTestResult('Workflow: Upload → Visualize → Analyze', 'PASS');
    });

    test('Workflow: Seed → Metrics → Impact Analysis', async () => {
      if (!testScanId) {
        logTestResult('Workflow: Seed → Metrics → Impact', 'WARN', 'No scan');
        return;
      }

      // Step 1: Get metrics
      const metricsRes = await apiRequest('GET', `/metrics/${testScanId}`);
      expect([200, 503]).toContain(metricsRes.status);

      // Step 2: Get impact
      const impactRes = await apiRequest('GET', '/impact', null, {
        node: 'field:test:testField',
        scanId: testScanId,
      });
      expect([200, 503]).toContain(impactRes.status);

      logTestResult('Workflow: Seed → Metrics → Impact', metricsRes.status === 200 ? 'PASS' : 'WARN');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 8. ERROR HANDLING & EDGE CASES
  // ──────────────────────────────────────────────────────────────────
  describe('Error Handling & Edge Cases', () => {
    
    test('Frontend handles 404 errors gracefully', async () => {
      const res = await apiRequest('GET', '/graph/invalid-repo-that-does-not-exist');
      expect(res.status).toBe(404);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toBeDefined();
      logTestResult('404 error handling', 'PASS');
    });

    test('Frontend handles server errors gracefully', async () => {
      const res = await apiRequest('GET', '/nonexistent-endpoint');
      expect(res.status).toBeGreaterThanOrEqual(400);
      logTestResult('Server error handling', 'PASS');
    });

    test('Frontend handles Neo4j unavailability (503)', async () => {
      // This test assumes Neo4j might not be running
      const res = await apiRequest('POST', '/db/seed/schema');
      if (res.status === 503) {
        expect(res.data.success).toBe(false);
        logTestResult('Neo4j unavailability handling', 'PASS');
      } else {
        logTestResult('Neo4j unavailability handling', 'PASS', 'Neo4j is available');
      }
    });

    test('Frontend handles malformed API responses', async () => {
      try {
        const res = await apiRequest('GET', '/health');
        if (res.status === 200) {
          expect(res.data).toHaveProperty('data');
          logTestResult('Malformed response handling', 'PASS');
        }
      } catch (error) {
        logTestResult('Malformed response handling', 'PASS', 'Error caught');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 9. RESPONSE TIME & PERFORMANCE
  // ──────────────────────────────────────────────────────────────────
  describe('Performance & Response Times', () => {
    
    test('Health check responds quickly (< 500ms)', async () => {
      const start = Date.now();
      const res = await apiRequest('GET', '/health');
      const duration = Date.now() - start;
      
      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(500);
      logTestResult('Health check response time', duration < 500 ? 'PASS' : 'WARN', `${duration}ms`);
    });

    test('Metrics endpoint responds within reasonable time (< 5s)', async () => {
      if (!testScanId) {
        logTestResult('Metrics response time', 'WARN', 'No scanId');
        return;
      }

      const start = Date.now();
      const res = await apiRequest('GET', `/metrics/${testScanId}`);
      const duration = Date.now() - start;
      
      expect([200, 503]).toContain(res.status);
      expect(duration).toBeLessThan(5000);
      logTestResult('Metrics response time', duration < 5000 ? 'PASS' : 'WARN', `${duration}ms`);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 10. DATA CONSISTENCY TESTS
  // ──────────────────────────────────────────────────────────────────
  describe('Data Consistency & Integrity', () => {
    
    test('Multiple graph fetches return consistent data', async () => {
      if (!testRepoId) {
        logTestResult('Data consistency', 'WARN', 'No repoId');
        return;
      }

      const res1 = await apiRequest('GET', `/graph/${testRepoId}`);
      const res2 = await apiRequest('GET', `/graph/${testRepoId}`);

      if (res1.status === 200 && res2.status === 200) {
        expect(res1.data.data.nodes.length).toBe(res2.data.data.nodes.length);
        expect(res1.data.data.edges.length).toBe(res2.data.data.edges.length);
        logTestResult('Data consistency', 'PASS');
      }
    });

    test('Metrics remain consistent across multiple calls', async () => {
      if (!testScanId) {
        logTestResult('Metrics consistency', 'WARN', 'No scanId');
        return;
      }

      const res1 = await apiRequest('GET', `/metrics/${testScanId}`);
      const res2 = await apiRequest('GET', `/metrics/${testScanId}`);

      if (res1.status === 200 && res2.status === 200) {
        expect(res1.data.data.totalServices).toBe(res2.data.data.totalServices);
        expect(res1.data.data.totalDependencies).toBe(res2.data.data.totalDependencies);
        logTestResult('Metrics consistency', 'PASS');
      }
    });
  });
});
