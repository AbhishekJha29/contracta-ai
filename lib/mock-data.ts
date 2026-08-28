import { Repo, Route, DiffEntry, ActivityEvent, OpenApiMockSpec } from './types';

export const mockRepo: Repo = {
  id: 'demo',
  name: 'acme/billing-service',
  githubUrl: 'https://github.com/acme/billing-service',
  lastChecked: '4 minutes ago',
  status: 'drift-detected',
  branch: 'main',
  commit: 'c9f4d1e',
  openIssuesCount: 2,
  breakingChangesCount: 2,
  totalRoutes: 6,
};

export const mockRoutes: Route[] = [
  {
    id: 'route-1',
    method: 'GET',
    path: '/v1/subscriptions',
    summary: 'List active subscriptions',
    description: 'Retrieves a paginated list of all active subscriptions for the authenticated tenant.',
    requiresAuth: true,
    tags: ['Subscriptions'],
    params: [
      { name: 'limit', type: 'integer', required: false, description: 'Number of results to return (max 100)' },
      { name: 'starting_after', type: 'string', required: false, description: 'Cursor for pagination' },
      { name: 'status', type: 'string', required: false, description: 'Filter by status: active, trialing, canceled' },
    ],
    responseBody: [
      { field: 'object', type: 'string', description: 'Value is always "list"' },
      { field: 'data', type: 'Array<Subscription>', description: 'List of subscription objects' },
      { field: 'has_more', type: 'boolean', description: 'Whether additional pages exist' },
      { field: 'total_count', type: 'integer', description: 'Total matched records' },
    ],
    statusCodes: [
      { code: 200, description: 'Successful query response' },
      { code: 401, description: 'Missing or invalid bearer token' },
      { code: 429, description: 'Rate limit exceeded' },
    ],
  },
  {
    id: 'route-2',
    method: 'POST',
    path: '/v1/subscriptions',
    summary: 'Create a new subscription',
    description: 'Creates a recurring billing subscription for a customer with tier pricing.',
    requiresAuth: true,
    tags: ['Subscriptions'],
    requestBody: [
      { field: 'customer_id', type: 'string', required: true, description: 'Unique customer identifier (cus_*)' },
      { field: 'plan_id', type: 'string', required: true, description: 'Billing plan identifier (plan_*)' },
      { field: 'payment_method_id', type: 'string', required: true, description: 'Default payment method token' },
      { field: 'trial_days', type: 'number', required: false, description: 'Optional trial period in days' },
      { field: 'coupon_code', type: 'string', required: false, description: 'Discount code to apply' },
      { field: 'billing_address', type: 'AddressObject', required: true, description: 'Physical billing address for tax calc' },
    ],
    responseBody: [
      { field: 'id', type: 'string', description: 'Subscription ID (sub_*)' },
      { field: 'customer_id', type: 'string', description: 'Associated customer ID' },
      { field: 'status', type: "'active' | 'incomplete' | 'trialing'", description: 'Current lifecycle status' },
      { field: 'current_period_end', type: 'integer (timestamp)', description: 'Unix timestamp of renewal' },
      { field: 'tax_rate', type: 'number', description: 'Calculated tax percentage applied' },
    ],
    statusCodes: [
      { code: 201, description: 'Subscription created successfully' },
      { code: 400, description: 'Invalid payload or missing required fields' },
      { code: 402, description: 'Payment required or charge declined' },
    ],
  },
  {
    id: 'route-3',
    method: 'GET',
    path: '/v1/invoices/:id',
    summary: 'Retrieve invoice by ID',
    description: 'Fetches the full breakdown of line items, taxes, and payment status for an invoice.',
    requiresAuth: true,
    tags: ['Invoices'],
    params: [
      { name: 'id', type: 'string', required: true, description: 'Invoice identifier (inv_*)' },
      { name: 'expand', type: 'string', required: false, description: 'Fields to expand (e.g. customer, line_items)' },
    ],
    responseBody: [
      { field: 'id', type: 'string', description: 'Invoice unique identifier' },
      { field: 'amount_due', type: 'integer (cents)', description: 'Total payable in minor currency units' },
      { field: 'currency', type: 'string', description: 'Three-letter ISO currency code (usd, eur)' },
      { field: 'paid', type: 'boolean', description: 'Payment settlement status' },
      { field: 'formatted_total', type: 'string', description: 'Human-readable currency string ($49.00)' },
      { field: 'pdf_url', type: 'string (url)', description: 'Hosted download URL for customer invoice' },
    ],
    statusCodes: [
      { code: 200, description: 'Invoice found and returned' },
      { code: 404, description: 'Invoice ID does not exist' },
    ],
  },
  {
    id: 'route-4',
    method: 'PUT',
    path: '/v1/customers/:id/payment-methods',
    summary: 'Update default payment method',
    description: 'Replaces the primary payment instrument attached to a customer profile.',
    requiresAuth: true,
    tags: ['Customers'],
    params: [
      { name: 'id', type: 'string', required: true, description: 'Customer identifier (cus_*)' },
    ],
    requestBody: [
      { field: 'payment_method_id', type: 'string', required: true, description: 'New tokenized payment instrument' },
      { field: 'set_as_default', type: 'boolean', required: false, description: 'Whether to switch default fallback' },
      { field: 'verify_cvv', type: 'boolean', required: false, description: 'Trigger immediate $0 micro-auth' },
    ],
    responseBody: [
      { field: 'customer_id', type: 'string', description: 'Customer ID' },
      { field: 'default_source', type: 'string', description: 'New default payment token' },
      { field: 'updated_at', type: 'integer (timestamp)', description: 'Unix timestamp of change' },
    ],
    statusCodes: [
      { code: 200, description: 'Payment method updated' },
      { code: 400, description: 'Token validation failed' },
      { code: 404, description: 'Customer not found' },
    ],
  },
  {
    id: 'route-5',
    method: 'DELETE',
    path: '/v1/subscriptions/:id',
    summary: 'Cancel subscription immediately',
    description: 'Terminates an ongoing subscription and generates a prorated final invoice.',
    requiresAuth: true,
    tags: ['Subscriptions'],
    params: [
      { name: 'id', type: 'string', required: true, description: 'Subscription ID (sub_*)' },
      { name: 'prorate', type: 'boolean', required: false, description: 'Whether to refund unused service days' },
      { name: 'invoice_now', type: 'boolean', required: false, description: 'Generate invoice immediately' },
    ],
    responseBody: [
      { field: 'id', type: 'string', description: 'Cancelled subscription ID' },
      { field: 'status', type: 'string', description: 'Set to "canceled"' },
      { field: 'canceled_at', type: 'integer (timestamp)', description: 'Time of cancellation' },
    ],
    statusCodes: [
      { code: 200, description: 'Subscription successfully canceled' },
      { code: 404, description: 'Subscription ID not found' },
    ],
  },
  {
    id: 'route-6',
    method: 'GET',
    path: '/v1/health',
    summary: 'Health check probe',
    description: 'Public health probe used by load balancers and orchestrator uptime monitors.',
    requiresAuth: false,
    tags: ['System'],
    params: [],
    responseBody: [
      { field: 'status', type: 'string', description: '"ok" | "degraded"' },
      { field: 'uptime_seconds', type: 'number', description: 'Process runtime duration in seconds' },
      { field: 'version', type: 'string', description: 'Semantic version of deployed backend build' },
    ],
    statusCodes: [
      { code: 200, description: 'Service operational' },
      { code: 503, description: 'Database or dependent service unavailable' },
    ],
  },
];

export const mockDiffEntries: DiffEntry[] = [
  {
    id: 'diff-1',
    severity: 'breaking',
    method: 'GET',
    path: '/v1/customers/:id',
    description: "Required field 'email' removed from response payload",
    field: 'response.email',
    changeType: 'removed_field',
    timestamp: '12 minutes ago',
    suggestedFix: 'Restore "email" to CustomerResponse DTO or mark it as deprecated with a migration grace period.',
    oldSpec: `// Schema: CustomerResponse (v1.2.0)
{
  "id": "cus_9281a",
  "name": "Sarah Jenkins",
- "email": "sarah.j@example.com", // [REQUIRED]
  "tier": "enterprise",
  "created_at": 1709124000
}`,
    newSpec: `// Schema: CustomerResponse (v1.3.0-rc1)
{
  "id": "cus_9281a",
  "name": "Sarah Jenkins",
+ // Missing "email" field — causes undefined runtime errors in web/mobile clients
  "tier": "enterprise",
  "created_at": 1709124000
}`,
  },
  {
    id: 'diff-2',
    severity: 'breaking',
    method: 'POST',
    path: '/v1/subscriptions',
    description: "New required field 'billing_address' added to request body without default value",
    field: 'request.body.billing_address',
    changeType: 'required_added',
    timestamp: '18 minutes ago',
    suggestedFix: 'Mark "billing_address" as optional in request validation or provide fallback to profile address.',
    oldSpec: `// Schema: CreateSubscriptionRequest (v1.2.0)
{
  "customer_id": "cus_9281a",
  "plan_id": "plan_pro_monthly",
  "payment_method_id": "pm_card_visa"
}`,
    newSpec: `// Schema: CreateSubscriptionRequest (v1.3.0-rc1)
{
  "customer_id": "cus_9281a",
  "plan_id": "plan_pro_monthly",
  "payment_method_id": "pm_card_visa",
+ "billing_address": {               // [REQUIRED - NEW]
+   "line1": "100 Market St",        // Breaks older SDK clients sending 3 arguments
+   "postal_code": "94105",
+   "country": "US"
+ }
}`,
  },
  {
    id: 'diff-3',
    severity: 'non-breaking',
    method: 'POST',
    path: '/v1/subscriptions',
    description: "New optional field 'tax_rate' and 'trial_days' added to response & request",
    field: 'request.body.trial_days & response.tax_rate',
    changeType: 'optional_added',
    timestamp: '25 minutes ago',
    suggestedFix: 'Backward compatible. No client mitigation needed.',
    oldSpec: `// Response before
{
  "id": "sub_4810a",
  "customer_id": "cus_9281a",
  "status": "active"
}`,
    newSpec: `// Response after
{
  "id": "sub_4810a",
  "customer_id": "cus_9281a",
  "status": "active",
+ "tax_rate": 0.0825,                // [OPTIONAL] Added for tax calculation
+ "current_period_end": 1740657600
}`,
  },
  {
    id: 'diff-4',
    severity: 'non-breaking',
    method: 'GET',
    path: '/v1/invoices/:id',
    description: "New convenience field 'formatted_total' added to invoice object",
    field: 'response.formatted_total',
    changeType: 'optional_added',
    timestamp: '1 hour ago',
    suggestedFix: 'Additive change. Existing consumers ignore extra keys safely.',
    oldSpec: `// Schema: Invoice (v1.2.0)
{
  "id": "inv_10283",
  "amount_due": 4900,
  "currency": "usd"
}`,
    newSpec: `// Schema: Invoice (v1.3.0-rc1)
{
  "id": "inv_10283",
  "amount_due": 4900,
  "currency": "usd",
+ "formatted_total": "$49.00"        // [OPTIONAL] Convenience helper
}`,
  },
];

export const mockActivityEvents: ActivityEvent[] = [
  {
    id: 'act-1',
    timestamp: '2026-08-18T10:45:00Z',
    relativeTime: '12 minutes ago',
    title: 'Drift detected — issue #12 opened',
    description: 'Contract analyzer found 2 breaking changes between git commit c9f4d1e and published v1.2.0 contract. Automated triage issue #12 created.',
    type: 'drift',
    severity: 'critical',
    issueNumber: 12,
    issueUrl: 'https://github.com/acme/billing-service/issues/12',
    commitHash: 'c9f4d1e',
    commitUrl: 'https://github.com/acme/billing-service/commit/c9f4d1e',
    actor: {
      name: 'contracta-bot',
      avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60',
    },
  },
  {
    id: 'act-2',
    timestamp: '2026-08-18T10:30:00Z',
    relativeTime: '27 minutes ago',
    title: 'GitHub Actions PR #84 check failed',
    description: 'PR #84 ("feat: update subscription payload validation") triggered CI contract test. Blocked merge due to breaking change on POST /v1/subscriptions.',
    type: 'pr_check',
    severity: 'warning',
    issueNumber: 84,
    issueUrl: 'https://github.com/acme/billing-service/pull/84',
    commitHash: '8b31ea9',
    commitUrl: 'https://github.com/acme/billing-service/commit/8b31ea9',
    actor: {
      name: 'sarah-dev',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60',
    },
  },
  {
    id: 'act-3',
    timestamp: '2026-08-18T09:15:00Z',
    relativeTime: '2 hours ago',
    title: 'OpenAPI Spec v1.2.0 synced from main',
    description: 'Successfully parsed 6 route handlers and generated contract baseline with 0 warnings.',
    type: 'sync',
    severity: 'success',
    commitHash: '4a19df2',
    commitUrl: 'https://github.com/acme/billing-service/commit/4a19df2',
    actor: {
      name: 'alex-lead',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=60',
    },
  },
  {
    id: 'act-4',
    timestamp: '2026-08-17T16:00:00Z',
    relativeTime: 'Yesterday at 4:00 PM',
    title: 'Repository connected to Contracta',
    description: 'Configured automated webhook monitoring for push events to branches `main` and `staging`.',
    type: 'check',
    severity: 'info',
    actor: {
      name: 'alex-lead',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=60',
    },
  },
];

export const mockOpenApiSpec: OpenApiMockSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Acme Billing Service API',
    version: '1.2.0',
    description: 'Contract generated automatically by Contracta from source route definitions.',
  },
  paths: {
    '/v1/subscriptions': {
      get: {
        summary: 'List active subscriptions',
        operationId: 'listSubscriptions',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'trialing', 'canceled'] } },
        ],
        responses: {
          '200': {
            description: 'A list of subscriptions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    object: { type: 'string', example: 'list' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Subscription' } },
                    has_more: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create subscription',
        operationId: 'createSubscription',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['customer_id', 'plan_id', 'payment_method_id'],
                properties: {
                  customer_id: { type: 'string' },
                  plan_id: { type: 'string' },
                  payment_method_id: { type: 'string' },
                  trial_days: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Subscription created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    status: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/v1/invoices/{id}': {
      get: {
        summary: 'Retrieve invoice by ID',
        operationId: 'getInvoiceById',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Invoice object',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    amount_due: { type: 'integer' },
                    currency: { type: 'string' },
                    paid: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/v1/health': {
      get: {
        summary: 'Health check probe',
        operationId: 'healthCheck',
        security: [],
        responses: {
          '200': {
            description: 'Health status OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    uptime_seconds: { type: 'number' },
                    version: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
