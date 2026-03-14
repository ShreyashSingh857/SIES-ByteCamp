// Single source of truth for all mock data — replace with real API calls in production

export const mockGraphData = {
  nodes: [
    { id: 'api-gateway',          label: 'API Gateway',          type: 'service',  lang: 'Go',         path: 'services/api-gateway',          description: 'Kong-based gateway routing all inbound traffic' },
    { id: 'user-service',         label: 'UserService',          type: 'service',  lang: 'Java',       path: 'services/user-service',         description: 'Spring Boot service managing user identity & auth' },
    { id: 'order-service',        label: 'OrderService',         type: 'service',  lang: 'Node.js',    path: 'services/order-service',        description: 'Express.js service handling order lifecycle' },
    { id: 'payment-service',      label: 'PaymentService',       type: 'service',  lang: 'Python',     path: 'services/payment-service',      description: 'FastAPI service integrating with Stripe/Razorpay' },
    { id: 'analytics-service',    label: 'AnalyticsService',     type: 'service',  lang: 'Python',     path: 'services/analytics-service',    description: 'Data pipeline reading from multiple DB tables' },
    { id: 'notification-service', label: 'NotificationService',  type: 'service',  lang: 'Go',         path: 'services/notification-service', description: 'gRPC service for email/push notifications' },
    { id: 'users-table',          label: 'users',                type: 'schema',   lang: 'PostgreSQL', path: 'db/migrations/001_users.sql',   description: 'Core user identity table with PII fields' },
    { id: 'orders-table',         label: 'orders',               type: 'schema',   lang: 'PostgreSQL', path: 'db/migrations/002_orders.sql',  description: 'Transactional order records with status machine' },
    { id: 'payments-table',       label: 'payments',             type: 'schema',   lang: 'PostgreSQL', path: 'db/migrations/003_payments.sql','description': 'Payment ledger linked to orders' },
    { id: 'events-table',         label: 'events',               type: 'schema',   lang: 'PostgreSQL', path: 'db/migrations/004_events.sql',  description: 'Audit/event log consumed by analytics' },
    { id: 'user-api',             label: 'UserAPI',              type: 'api',      lang: 'OpenAPI',    path: 'specs/user-api.yaml',           description: 'OpenAPI 3.0 contract for user endpoints' },
    { id: 'order-api',            label: 'OrderAPI',             type: 'api',      lang: 'OpenAPI',    path: 'specs/order-api.yaml',          description: 'OpenAPI 3.0 contract for order CRUD' },
    { id: 'payment-api',          label: 'PaymentAPI',           type: 'api',      lang: 'OpenAPI',    path: 'specs/payment-api.yaml',        description: 'OpenAPI 3.0 contract for payment initiation' },
    { id: 'frontend',             label: 'React Frontend',       type: 'frontend', lang: 'JavaScript', path: 'client/src',                    description: 'React SPA consuming multiple API specs' },
  ],
  edges: [
    { id: 'e01', source: 'api-gateway',          target: 'user-service',         label: 'CALLS',       type: 'CALLS' },
    { id: 'e02', source: 'api-gateway',          target: 'order-service',        label: 'CALLS',       type: 'CALLS' },
    { id: 'e03', source: 'api-gateway',          target: 'payment-service',      label: 'CALLS',       type: 'CALLS' },
    { id: 'e04', source: 'api-gateway',          target: 'notification-service', label: 'CALLS',       type: 'CALLS' },
    { id: 'e05', source: 'order-service',        target: 'user-service',         label: 'CALLS',       type: 'CALLS' },
    { id: 'e06', source: 'order-service',        target: 'payment-service',      label: 'CALLS',       type: 'CALLS' },
    { id: 'e07', source: 'notification-service', target: 'order-service',        label: 'CALLS',       type: 'CALLS' },
    { id: 'e08', source: 'user-service',         target: 'users-table',          label: 'USES_FIELD',  type: 'USES_FIELD' },
    { id: 'e09', source: 'order-service',        target: 'orders-table',         label: 'USES_FIELD',  type: 'USES_FIELD' },
    { id: 'e10', source: 'payment-service',      target: 'payments-table',       label: 'USES_FIELD',  type: 'USES_FIELD' },
    { id: 'e11', source: 'analytics-service',    target: 'orders-table',         label: 'USES_FIELD',  type: 'USES_FIELD' },
    { id: 'e12', source: 'analytics-service',    target: 'payments-table',       label: 'USES_FIELD',  type: 'USES_FIELD' },
    { id: 'e13', source: 'analytics-service',    target: 'users-table',          label: 'USES_FIELD',  type: 'USES_FIELD' },
    { id: 'e14', source: 'analytics-service',    target: 'events-table',         label: 'USES_FIELD',  type: 'USES_FIELD' },
    { id: 'e15', source: 'user-service',         target: 'user-api',             label: 'IMPLEMENTS',  type: 'IMPLEMENTS' },
    { id: 'e16', source: 'order-service',        target: 'order-api',            label: 'IMPLEMENTS',  type: 'IMPLEMENTS' },
    { id: 'e17', source: 'payment-service',      target: 'payment-api',          label: 'IMPLEMENTS',  type: 'IMPLEMENTS' },
    { id: 'e18', source: 'frontend',             target: 'user-api',             label: 'CONSUMES',    type: 'CONSUMES' },
    { id: 'e19', source: 'frontend',             target: 'order-api',            label: 'CONSUMES',    type: 'CONSUMES' },
    { id: 'e20', source: 'frontend',             target: 'payment-api',          label: 'CONSUMES',    type: 'CONSUMES' },
  ],
};

export const mockRepos = [
  {
    id: 1,
    name: 'ecommerce-platform',
    url: 'github.com/acme-corp/ecommerce-platform',
    branch: 'main',
    langs: ['Java', 'Node.js', 'Python', 'Go'],
    status: 'scanned',
    nodes: 14,
    edges: 20,
    services: 6,
    schemas: 4,
    scannedAt: '2026-03-14T08:30:00Z',
  },
  {
    id: 2,
    name: 'ml-pipeline',
    url: 'github.com/acme-corp/ml-pipeline',
    branch: 'develop',
    langs: ['Python', 'Scala'],
    status: 'scanned',
    nodes: 7,
    edges: 9,
    services: 3,
    schemas: 2,
    scannedAt: '2026-03-13T14:15:00Z',
  },
  {
    id: 3,
    name: 'infra-config',
    url: 'github.com/acme-corp/infra-config',
    branch: 'main',
    langs: ['Go', 'HCL'],
    status: 'scanning',
    nodes: 0,
    edges: 0,
    services: 0,
    schemas: 0,
    scannedAt: null,
  },
];

export const MOCK_USER = {
  id: 1,
  name: 'Alex Chen',
  email: 'alex@acme-corp.io',
  role: 'ADMIN',
  avatar: null,
};

export const NODE_TYPE_CONFIG = {
  service:  { color: '#1e3a8a', border: '#3b82f6', shape: 'ellipse',    label: 'Service'  },
  schema:   { color: '#78350f', border: '#f59e0b', shape: 'rectangle',  label: 'Schema'   },
  api:      { color: '#14532d', border: '#22c55e', shape: 'diamond',    label: 'API Spec' },
  frontend: { color: '#4c1d95', border: '#a855f7', shape: 'ellipse',    label: 'Frontend' },
};

export const EDGE_TYPE_CONFIG = {
  CALLS:      { color: '#3b82f6', style: 'solid',  label: 'Calls'      },
  USES_FIELD: { color: '#f59e0b', style: 'dashed', label: 'Uses Field' },
  IMPLEMENTS: { color: '#22c55e', style: 'solid',  label: 'Implements' },
  CONSUMES:   { color: '#a855f7', style: 'dotted', label: 'Consumes'   },
};