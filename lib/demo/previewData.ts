/**
 * Static Preview Mock Data for Contracta Landing Page
 * 
 * Illustrative, zero-network mock data modeling realistic output from sample Express APIs.
 * Purely client-side representation matching the real Contract and Drift views.
 */

export interface PreviewRoute {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  summary: string;
  description: string;
  requiresAuth: boolean;
  tag: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
  requestBody?: { field: string; type: string; required: boolean; description: string }[];
  responseBody?: { field: string; type: string; description: string }[];
  statusCodes: { code: number; description: string }[];
}

export interface PreviewDiff {
  id: string;
  severity: 'breaking' | 'non-breaking';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  changeType: string;
  description: string;
  suggestedFix: string;
  timestamp: string;
  oldSpec: string;
  newSpec: string;
}

export const previewRoutes: PreviewRoute[] = [
  {
    id: 'route-1',
    method: 'GET',
    path: '/api/users',
    summary: 'List registered users',
    description: 'Retrieves a paginated collection of user accounts for the current workspace.',
    requiresAuth: true,
    tag: 'Users',
    params: [
      { name: 'limit', type: 'integer', required: false, description: 'Number of results to return (max 100)' },
      { name: 'starting_after', type: 'string', required: false, description: 'Cursor token for pagination' },
    ],
    responseBody: [
      { field: 'data', type: 'Array<User>', description: 'List of user objects' },
      { field: 'has_more', type: 'boolean', description: 'Whether additional pages exist' },
      { field: 'total_count', type: 'integer', description: 'Total matched records' },
    ],
    statusCodes: [
      { code: 200, description: 'Success' },
      { code: 401, description: 'Unauthorized' },
    ],
  },
  {
    id: 'route-2',
    method: 'POST',
    path: '/api/users',
    summary: 'Create new user account',
    description: 'Provisions a new user profile with email verification dispatch.',
    requiresAuth: true,
    tag: 'Users',
    requestBody: [
      { field: 'email', type: 'string', required: true, description: 'User primary email address' },
      { field: 'name', type: 'string', required: true, description: 'Full legal name' },
      { field: 'role', type: "'admin' | 'member'", required: false, description: 'Access tier (default: member)' },
    ],
    responseBody: [
      { field: 'id', type: 'string (uuid)', description: 'Unique user identifier' },
      { field: 'email', type: 'string', description: 'Validated email address' },
      { field: 'created_at', type: 'integer (timestamp)', description: 'Unix timestamp of creation' },
    ],
    statusCodes: [
      { code: 201, description: 'User created' },
      { code: 400, description: 'Invalid schema payload' },
      { code: 409, description: 'Email already exists' },
    ],
  },
  {
    id: 'route-3',
    method: 'GET',
    path: '/api/users/{id}',
    summary: 'Retrieve user by ID',
    description: 'Fetches detailed profile information for a specific user ID.',
    requiresAuth: true,
    tag: 'Users',
    params: [
      { name: 'id', type: 'string (uuid)', required: true, description: 'Unique user UUID identifier' },
    ],
    responseBody: [
      { field: 'id', type: 'string (uuid)', description: 'User UUID' },
      { field: 'name', type: 'string', description: 'User full name' },
      { field: 'email', type: 'string', description: 'Primary email address' },
      { field: 'role', type: 'string', description: 'User role permission' },
    ],
    statusCodes: [
      { code: 200, description: 'User profile found' },
      { code: 404, description: 'User ID not found' },
    ],
  },
  {
    id: 'route-4',
    method: 'PUT',
    path: '/api/users/{id}',
    summary: 'Update user profile metadata',
    description: 'Updates mutable profile fields like bio, avatar, and notification settings.',
    requiresAuth: true,
    tag: 'Users',
    params: [
      { name: 'id', type: 'string (uuid)', required: true, description: 'User identifier' },
    ],
    requestBody: [
      { field: 'name', type: 'string', required: false, description: 'Updated display name' },
      { field: 'bio', type: 'string', required: false, description: 'User profile biography' },
    ],
    responseBody: [
      { field: 'id', type: 'string', description: 'User identifier' },
      { field: 'updated_at', type: 'integer', description: 'Timestamp of update' },
    ],
    statusCodes: [
      { code: 200, description: 'Profile updated' },
      { code: 400, description: 'Validation failed' },
      { code: 404, description: 'User not found' },
    ],
  },
  {
    id: 'route-5',
    method: 'GET',
    path: '/api/health',
    summary: 'System health probe',
    description: 'Zero-auth health probe for load balancers and orchestrator uptime checks.',
    requiresAuth: false,
    tag: 'System',
    responseBody: [
      { field: 'status', type: "'ok' | 'degraded'", description: 'Service health state' },
      { field: 'uptime_seconds', type: 'number', description: 'Process runtime duration in seconds' },
      { field: 'version', type: 'string', description: 'Semantic version of deployed build' },
    ],
    statusCodes: [
      { code: 200, description: 'Operational' },
      { code: 503, description: 'Service unavailable' },
    ],
  },
];

export const previewDiffs: PreviewDiff[] = [
  {
    id: 'diff-1',
    severity: 'breaking',
    method: 'GET',
    path: '/api/users/{id}',
    changeType: 'removed_field',
    description: "Required field 'email' removed from response payload.",
    suggestedFix: 'Restore "email" in UserResponse DTO or mark it deprecated before removing to avoid breaking mobile/web clients.',
    timestamp: 'Just now',
    oldSpec: `// Schema: UserResponse (Baseline v3.0)
{
  "id": "usr_9481a",
  "name": "Sarah Jenkins",
- "email": "sarah.j@example.com", // [REQUIRED]
  "role": "member"
}`,
    newSpec: `// Schema: UserResponse (Proposed Head AST)
{
  "id": "usr_9481a",
  "name": "Sarah Jenkins",
+ // Missing "email" property causes TypeError in client parsers
  "role": "member"
}`,
  },
  {
    id: 'diff-2',
    severity: 'non-breaking',
    method: 'POST',
    path: '/api/users',
    changeType: 'optional_added',
    description: "New optional field 'bio' added to user request & response schemas.",
    suggestedFix: 'Backward-compatible additive update. Existing API consumers safely ignore extra properties.',
    timestamp: '2 mins ago',
    oldSpec: `// Schema: CreateUserRequest (Baseline v3.0)
{
  "email": "alex@example.com",
  "name": "Alex Rivera"
}`,
    newSpec: `// Schema: CreateUserRequest (Proposed Head AST)
{
  "email": "alex@example.com",
  "name": "Alex Rivera",
+ "bio": "Staff Infrastructure Engineer" // [OPTIONAL FIELD ADDED]
}`,
  },
];
