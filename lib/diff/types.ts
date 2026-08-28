export type DiffSeverity = 'breaking' | 'non-breaking';

export type DiffChangeType =
  | 'endpoint-removed'
  | 'endpoint-added'
  | 'required-field-removed'
  | 'field-removed'
  | 'field-type-changed'
  | 'required-field-added'
  | 'field-added'
  | 'field-modified'
  | 'auth-added'
  | 'auth-removed'
  | 'param-removed'
  | 'param-added'
  | 'response-status-removed'
  | 'response-status-added';

export interface DiffEntry {
  id?: string;
  severity: 'breaking' | 'non-breaking';
  method: string;
  path: string;
  changeType: string; // e.g. 'endpoint-removed', 'required-field-removed', 'field-type-changed', 'auth-removed', 'field-added', 'endpoint-added'
  description: string; // human-readable summary
  oldValue?: unknown;
  newValue?: unknown;
  oldSpec?: string;
  newSpec?: string;
  timestamp?: string;
  suggestedFix?: string;
}
