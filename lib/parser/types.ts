export interface RequestBodyField {
  field: string;
  type: string;
  required: boolean;
}

export interface ParsedRoute {
  method: string;
  path: string;
  params?: Record<string, string>;
  requiresAuth: boolean;
  requestBody?: RequestBodyField[];
}
