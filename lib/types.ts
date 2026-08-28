export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export interface SchemaField {
  field: string;
  type: string;
  required?: boolean;
  description?: string;
  example?: string | number | boolean;
}

export interface RouteParam {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

export interface Route {
  id?: string;
  method: HttpMethod | string;
  path: string;
  params?: RouteParam[];
  requiresAuth: boolean;
  summary?: string;
  description?: string;
  tags?: string[];
  requestBody?: SchemaField[];
  responseBody?: SchemaField[];
  statusCodes?: { code: number; description: string }[];
}

export type DiffSeverity = 'breaking' | 'non-breaking';

export interface DiffEntry {
  id?: string;
  severity: DiffSeverity;
  method: HttpMethod | string;
  path: string;
  description: string;
  field?: string;
  changeType?: 'removed_field' | 'type_mismatch' | 'required_added' | 'optional_added' | 'auth_changed' | 'endpoint_removed' | 'status_code_changed';
  oldSpec?: string;
  newSpec?: string;
  oldValue?: unknown;
  newValue?: unknown;
  timestamp?: string;
  suggestedFix?: string;
}

export interface DiffCardProps {
  entry: DiffEntry;
}

export interface Repo {
  id: string;
  name: string;
  githubUrl: string;
  lastChecked: string;
  status: 'clean' | 'drift-detected';
  branch?: string;
  commit?: string;
  openIssuesCount?: number;
  breakingChangesCount?: number;
  totalRoutes?: number;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  relativeTime: string;
  title: string;
  description: string;
  type: 'drift' | 'sync' | 'check' | 'alert' | 'pr_check';
  severity?: 'critical' | 'warning' | 'info' | 'success';
  issueNumber?: number;
  issueUrl?: string;
  commitHash?: string;
  commitUrl?: string;
  actor?: {
    name: string;
    avatar?: string;
  };
}

export interface OpenApiMockSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  paths: Record<string, Record<string, unknown>>;
}
