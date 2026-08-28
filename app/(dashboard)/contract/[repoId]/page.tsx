'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/topbar';
import { MethodBadge } from '@/components/method-badge';
import { JsonSchemaViewer } from '@/components/json-schema-viewer';
import { mockRoutes, mockOpenApiSpec } from '@/lib/mock-data';
import { Route } from '@/lib/types';
import {
  Search,
  Lock,
  Globe,
  ChevronDown,
  ChevronUp,
  FileCode,
  Copy,
  Check,
  Code,
  Sparkles,
  SlidersHorizontal,
  X,
  RefreshCw,
  AlertCircle,
  FolderGit2,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import { OpenAPIObject, PathItemObject, OperationObject } from 'openapi3-ts/oas30';

interface DisplayRoute {
  id: string;
  path: string;
  method: string;
  summary?: string;
  description?: string;
  requiresAuth?: boolean;
  tags?: string[];
  params?: { name: string; type: string; required?: boolean; description?: string }[];
  requestBody?: { field: string; type: string; required: boolean; description?: string }[];
  responseBody?: { field: string; type: string; required: boolean; description?: string }[];
  statusCodes?: { code: number; description: string }[];
}

/**
 * Transforms an OpenAPI 3.0 document into DisplayRoute items for the Contract viewer UI.
 */
function openApiToDisplayRoutes(spec: OpenAPIObject): DisplayRoute[] {
  const routes: DisplayRoute[] = [];
  const paths = spec.paths || {};

  const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const;

  let routeCounter = 0;
  for (const [pathKey, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;

    for (const method of httpMethods) {
      const operation = (pathItem as any)[method] as OperationObject | undefined;
      if (!operation) continue;

      routeCounter++;
      const id = `route-${routeCounter}-${method}-${pathKey.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Extract parameters
      const params: DisplayRoute['params'] = [];
      const rawParams = [...(pathItem.parameters || []), ...(operation.parameters || [])];
      for (const p of rawParams as any[]) {
        if (p && p.name) {
          params.push({
            name: p.name,
            type: p.schema?.type || (p.in === 'path' ? 'string' : 'string'),
            required: p.required || p.in === 'path',
            description: p.description || `${p.in} parameter`,
          });
        }
      }

      // Extract request body properties
      const requestBodyFields: DisplayRoute['requestBody'] = [];
      const reqContent = operation.requestBody as any;
      const jsonSchema = reqContent?.content?.['application/json']?.schema;
      if (jsonSchema?.properties) {
        const requiredSet = new Set(jsonSchema.required || []);
        for (const [propName, propSchema] of Object.entries(jsonSchema.properties as Record<string, any>)) {
          requestBodyFields.push({
            field: propName,
            type: propSchema.type || 'string',
            required: requiredSet.has(propName),
            description: propSchema.description,
          });
        }
      }

      // Extract response status codes
      const statusCodes: DisplayRoute['statusCodes'] = [];
      if (operation.responses) {
        for (const [code, resp] of Object.entries(operation.responses)) {
          statusCodes.push({
            code: parseInt(code, 10) || 200,
            description: (resp as any)?.description || 'Response',
          });
        }
      }

      const requiresAuth = Boolean(
        (operation.security && operation.security.length > 0) ||
        (spec.security && spec.security.length > 0)
      );

      routes.push({
        id,
        path: pathKey,
        method: method.toUpperCase(),
        summary: operation.summary || `${method.toUpperCase()} ${pathKey}`,
        description: operation.description,
        requiresAuth,
        tags: operation.tags || [],
        params: params.length > 0 ? params : undefined,
        requestBody: requestBodyFields.length > 0 ? requestBodyFields : undefined,
        statusCodes: statusCodes.length > 0 ? statusCodes : undefined,
      });
    }
  }

  return routes;
}

function convertMockRoutesToDisplayRoutes(mockList: Route[]): DisplayRoute[] {
  return mockList.map((r, idx) => ({
    id: r.id ?? `mock-route-${idx + 1}-${String(r.method).toLowerCase()}-${r.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
    path: r.path,
    method: String(r.method).toUpperCase(),
    summary: r.summary,
    description: r.description,
    requiresAuth: r.requiresAuth,
    tags: r.tags,
    params: r.params?.map((p) => ({
      name: p.name,
      type: p.type,
      required: p.required,
      description: p.description,
    })),
    requestBody: r.requestBody?.map((f) => ({
      field: f.field,
      type: f.type,
      required: Boolean(f.required),
      description: f.description,
    })),
    responseBody: r.responseBody?.map((f) => ({
      field: f.field,
      type: f.type,
      required: Boolean(f.required),
      description: f.description,
    })),
    statusCodes: r.statusCodes,
  }));
}

const mockDisplayRoutes: DisplayRoute[] = convertMockRoutesToDisplayRoutes(mockRoutes);

export default function ContractPage({
  params,
}: {
  params: Promise<{ repoId: string }>;
}) {
  const resolvedParams = use(params);
  const repoId = resolvedParams.repoId || 'demo';

  const isDemo = repoId === 'demo';

  // State
  const [loading, setLoading] = useState(!isDemo);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoData, setRepoData] = useState<any>(null);
  const [activeSpec, setActiveSpec] = useState<OpenAPIObject | null>(
    isDemo ? (mockOpenApiSpec as unknown as OpenAPIObject) : null
  );
  const [routes, setRoutes] = useState<DisplayRoute[]>(isDemo ? mockDisplayRoutes : []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({});
  const [showOpenApiModal, setShowOpenApiModal] = useState(false);
  const [copiedSpec, setCopiedSpec] = useState(false);

  // Load Repository & Baseline
  const loadRepo = async (autoAnalyzeIfEmpty = true) => {
    if (isDemo) {
      setActiveSpec(mockOpenApiSpec as unknown as OpenAPIObject);
      setRoutes(mockDisplayRoutes);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/repos/${repoId}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`Repository "${repoId}" was not found or is not connected to your account.`);
        }
        if (res.status === 401 || res.status === 403) {
          throw new Error(`Access denied: You do not have permission to view repository "${repoId}".`);
        }
        throw new Error(`Failed to load repository details (${res.status})`);
      }
      const data = await res.json();
      setRepoData(data.repo);

      const latestBaseline = data.repo?.baselines?.[0];
      if (latestBaseline && latestBaseline.specJson) {
        const spec = latestBaseline.specJson as OpenAPIObject;
        setActiveSpec(spec);
        const parsedRoutes = openApiToDisplayRoutes(spec);
        setRoutes(parsedRoutes);
        // Expand first route by default
        if (parsedRoutes[0]?.id) {
          setExpandedRoutes({ [parsedRoutes[0].id]: true });
        }
      } else if (autoAnalyzeIfEmpty) {
        // No baseline exists yet -> trigger auto analysis
        await triggerAnalysis();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred loading repository.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger Remote Ingestion & AST Analysis via Background Job Queue (Phase 9)
  const triggerAnalysis = async () => {
    if (isDemo) return;

    try {
      setAnalyzing(true);
      setError(null);

      // Snapshot the current baseline version before enqueuing
      const baselineBeforeTrigger = repoData?.baselines?.[0];
      const initialVersion = baselineBeforeTrigger?.version ?? 0;

      const res = await fetch(`/api/repos/${repoId}/analyze`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to enqueue repository analysis');
      }

      console.log('[Contract UI] Enqueued background analysis job:', data.jobId);

      // Poll /api/repos/${repoId}/status every 2 seconds until a new baseline is detected
      const maxPollAttempts = 40; // 40 * 2000ms = 80 seconds timeout
      let attempts = 0;
      let completed = false;

      while (attempts < maxPollAttempts && !completed) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;

        try {
          const statusRes = await fetch(`/api/repos/${repoId}/status`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            const latestBaseline = statusData.latestBaseline;

            // Check if a new baseline was persisted with a higher version
            if (latestBaseline && latestBaseline.version > initialVersion) {
              completed = true;
              const spec = latestBaseline.specJson as OpenAPIObject;
              setActiveSpec(spec);
              const parsedRoutes = openApiToDisplayRoutes(spec);
              setRoutes(parsedRoutes);

              // Update repoData in local state
              setRepoData((prev: any) => ({
                ...prev,
                baselines: [latestBaseline, ...(prev?.baselines || [])],
              }));

              if (parsedRoutes[0]?.id) {
                setExpandedRoutes({ [parsedRoutes[0].id]: true });
              }
              break;
            }
          }
        } catch {
          // Ignore intermittent network glitch during polling
        }
      }

      if (!completed) {
        throw new Error(
          'Background analysis is taking longer than expected. Please ensure the worker process ("npm run worker") is running in a separate terminal.'
        );
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete AST route analysis.');
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    loadRepo();
  }, [repoId]);

  const toggleRoute = (id: string) => {
    setExpandedRoutes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    routes.forEach((r) => {
      if (r.id) all[r.id] = true;
    });
    setExpandedRoutes(all);
  };

  const collapseAll = () => {
    setExpandedRoutes({});
  };

  const filteredRoutes = routes.filter((r) => {
    const matchesSearch =
      r.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.summary && r.summary.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesMethod =
      selectedMethod === 'ALL' || r.method.toUpperCase() === selectedMethod;
    return matchesSearch && matchesMethod;
  });

  const methodsList = ['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  const copySpec = () => {
    if (activeSpec) {
      navigator.clipboard.writeText(JSON.stringify(activeSpec, null, 2));
      setCopiedSpec(true);
      setTimeout(() => setCopiedSpec(false), 2000);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar currentSection="contract" repoId={repoId} />

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Loading / Analyzing Banner */}
        {analyzing && (
          <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/30 text-cyan-200 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
              <div>
                <p className="text-sm font-semibold">Analyzing Repository Source AST (Background Worker)...</p>
                <p className="text-xs text-cyan-300/80">
                  Job enqueued in background queue. Worker is downloading tarball archive, inspecting TypeScript route handlers, and compiling OpenAPI 3.0 specification.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-1 bg-cyan-900/50 rounded text-cyan-300">Phase 9 Queue</span>
          </div>
        )}

        {/* Full error state if repo cannot be loaded */}
        {!loading && error && !repoData && !isDemo && (
          <div className="p-12 text-center rounded-2xl border border-zinc-800 bg-zinc-950 space-y-4 max-w-lg mx-auto my-8">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-white">Repository Not Accessible</h2>
              <p className="text-xs text-rose-300/90 leading-relaxed font-mono">{error}</p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <Link
                href="/"
                className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg transition-all"
              >
                Return to Dashboard
              </Link>
              <Link
                href="/contract/demo"
                className="px-4 py-2 text-xs font-mono text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg transition-colors"
              >
                View Demo Workspace
              </Link>
            </div>
          </div>
        )}

        {/* Error Alert for transient errors */}
        {error && repoData && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold">Analysis Notice</p>
              <p className="text-xs text-rose-300/90 leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={() => triggerAnalysis()}
                className="mt-2 text-xs font-mono font-medium text-rose-300 hover:text-white underline cursor-pointer"
              >
                Try re-scanning repository &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {repoData ? `${repoData.owner}/${repoData.name}` : 'API Living Contract'}
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                {activeSpec?.openapi ? `OpenAPI ${activeSpec.openapi}` : 'OpenAPI 3.0'}
              </span>
              {repoData?.baselines?.[0] && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
                  v{repoData.baselines[0].version}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              {routes.length > 0
                ? `Verified route contracts automatically extracted from codebase AST (${routes.length} active routes detected).`
                : 'No route contracts detected yet in this repository.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isDemo && (
              <button
                type="button"
                onClick={() => triggerAnalysis()}
                disabled={analyzing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 border border-cyan-500/30 rounded-lg transition-all shadow-sm cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
                <span>{analyzing ? 'Checking Drift...' : 'Re-check for drift'}</span>
              </button>
            )}

            {activeSpec && (
              <button
                type="button"
                onClick={() => setShowOpenApiModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-800/60 rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                <Code className="w-3.5 h-3.5 text-cyan-400" />
                <span>View OpenAPI JSON</span>
              </button>
            )}

            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1.5 text-xs font-mono text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1.5 text-xs font-mono text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              Collapse
            </button>
          </div>
        </div>

        {/* Search and Method Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-800/80">
          {/* Search bar */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter routes by path or description (e.g. /api/users)..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-hidden focus:border-zinc-700 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* HTTP Method Pills */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {methodsList.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedMethod(m)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                  selectedMethod === m
                    ? 'bg-zinc-200 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="p-16 text-center rounded-xl border border-zinc-800 bg-zinc-950 space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
            <p className="text-sm font-medium text-zinc-300">Loading API Contract Baseline...</p>
            <p className="text-xs text-zinc-500">Fetching stored OpenAPI specification from database.</p>
          </div>
        )}

        {/* Empty Routes / No Routes Discovered State */}
        {!loading && routes.length === 0 && (
          <div className="p-12 text-center rounded-xl border border-zinc-800 bg-zinc-950 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-sm font-semibold text-white">No Express Route Handlers Discovered</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Contracta scanned the repository AST but did not find any Express route declarations (e.g.{' '}
                <code className="text-cyan-400 font-mono">router.get()</code>, <code className="text-cyan-400 font-mono">app.post()</code>).
              </p>
            </div>
            {!isDemo && (
              <button
                type="button"
                onClick={() => triggerAnalysis()}
                disabled={analyzing}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-lg shadow-md cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
                <span>Re-run AST Scan</span>
              </button>
            )}
          </div>
        )}

        {/* Filtered Empty State */}
        {!loading && routes.length > 0 && filteredRoutes.length === 0 && (
          <div className="p-12 text-center rounded-xl border border-zinc-800 bg-zinc-950 space-y-2">
            <SlidersHorizontal className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-medium text-zinc-300">No route contracts match your filter</p>
            <p className="text-xs text-zinc-500">Try searching for a different endpoint or clearing the method filter.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedMethod('ALL');
              }}
              className="mt-2 text-xs font-mono text-cyan-400 hover:underline"
            >
              Reset filters
            </button>
          </div>
        )}

        {/* Routes List */}
        {!loading && (
          <div className="space-y-3">
            {filteredRoutes.map((route) => {
              const isExpanded = route.id ? expandedRoutes[route.id] : false;

              return (
                <div
                  key={route.id || route.path}
                  className="rounded-xl border border-zinc-800/90 bg-zinc-950/80 hover:border-zinc-700/80 transition-all overflow-hidden shadow-sm"
                >
                  {/* Collapsible Header */}
                  <div
                    onClick={() => route.id && toggleRoute(route.id)}
                    className="p-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-zinc-900/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-wrap sm:flex-nowrap">
                      <MethodBadge method={route.method} size="md" />

                      <span className="font-mono text-sm font-semibold text-white tracking-tight truncate">
                        {route.path}
                      </span>

                      {route.summary && (
                        <span className="hidden md:inline text-xs text-zinc-400 truncate max-w-xs font-sans">
                          — {route.summary}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {/* Auth requirement indicator */}
                      {route.requiresAuth ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 bg-zinc-900 text-amber-300/90 border border-amber-500/20 rounded">
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span className="hidden sm:inline">Auth Required</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded">
                          <Globe className="w-3 h-3 text-zinc-500" />
                          <span className="hidden sm:inline">Public</span>
                        </span>
                      )}

                      {/* Tag pill */}
                      {route.tags && route.tags[0] && (
                        <span className="hidden lg:inline-block text-[10px] font-mono px-2 py-0.5 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded">
                          {route.tags[0]}
                        </span>
                      )}

                      <div className="p-1 text-zinc-400 hover:text-white transition-colors">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Body Details */}
                  {isExpanded && (
                    <div className="p-4 border-t border-zinc-850 bg-zinc-900/20 space-y-4">
                      {route.description && (
                        <div className="text-xs text-zinc-300 font-sans leading-relaxed">
                          {route.description}
                        </div>
                      )}

                      {/* Path / Query Params */}
                      {route.params && route.params.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1">
                            <span>Route Parameters</span>
                            <span className="text-[10px] text-zinc-500">({route.params.length})</span>
                          </div>
                          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2.5 space-y-1.5">
                            {route.params.map((p, idx) => (
                              <div
                                key={idx}
                                className="flex flex-wrap items-center justify-between text-xs gap-2 py-1 border-b border-zinc-900 last:border-0"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-cyan-300 font-medium">
                                    {p.name}
                                  </span>
                                  <span className="font-mono text-[10px] px-1.5 py-0.2 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded">
                                    {p.type}
                                  </span>
                                  {p.required && (
                                    <span className="text-[10px] font-mono text-rose-400 font-medium">
                                      required
                                    </span>
                                  )}
                                </div>
                                {p.description && (
                                  <span className="text-[11px] text-zinc-400">{p.description}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Request & Response Schemas */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Request Body */}
                        <div className="space-y-1.5">
                          <JsonSchemaViewer
                            fields={route.requestBody}
                            title="Request Payload Schema"
                            isResponse={false}
                          />
                        </div>

                        {/* Response Body */}
                        <div className="space-y-1.5">
                          <JsonSchemaViewer
                            fields={route.responseBody}
                            title="200 Response Payload Schema"
                            isResponse={true}
                          />
                        </div>
                      </div>

                      {/* Status Codes */}
                      {route.statusCodes && route.statusCodes.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap pt-1 text-xs font-mono">
                          <span className="text-zinc-500 text-[11px] uppercase tracking-wider">
                            HTTP Responses:
                          </span>
                          {route.statusCodes.map((s, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-0.5 rounded border text-[11px] flex items-center gap-1 ${
                                s.code >= 200 && s.code < 300
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                  : s.code >= 400 && s.code < 500
                                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                              }`}
                              title={s.description}
                            >
                              <span className="font-bold">{s.code}</span>
                              <span className="text-[10px] text-zinc-400">— {s.description}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* OpenAPI Spec Modal */}
      {showOpenApiModal && activeSpec && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-sm text-white">Generated OpenAPI 3.0 Spec (AST Engine)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copySpec}
                  className="px-2.5 py-1 text-xs font-mono text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedSpec ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSpec ? 'Copied' : 'Copy Spec'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowOpenApiModal(false)}
                  className="p-1 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-md cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto font-mono text-xs text-zinc-300 bg-zinc-950 leading-relaxed">
              <pre>
                <code>{JSON.stringify(activeSpec, null, 2)}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
