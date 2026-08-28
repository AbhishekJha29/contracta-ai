'use client';

import React, { useState } from 'react';
import { SchemaField } from '@/lib/types';
import { Check, Copy, Code2, Table2 } from 'lucide-react';

interface JsonSchemaViewerProps {
  fields?: SchemaField[];
  title?: string;
  isResponse?: boolean;
}

export function JsonSchemaViewer({
  fields = [],
  title = 'Schema',
  isResponse = false,
}: JsonSchemaViewerProps) {
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');
  const [copied, setCopied] = useState(false);

  // Generate a mock JSON representation from the fields
  const generateMockJson = () => {
    const obj: Record<string, unknown> = {};
    fields.forEach((f) => {
      if (f.type.includes('integer') || f.type.includes('number')) {
        obj[f.field] = f.example || 100;
      } else if (f.type.includes('boolean')) {
        obj[f.field] = f.example !== undefined ? f.example : true;
      } else if (f.type.includes('Array')) {
        obj[f.field] = ['...items'];
      } else if (f.type.includes('Object')) {
        obj[f.field] = { sample: 'value' };
      } else {
        obj[f.field] = f.example || `sample_${f.field}`;
      }
    });
    return JSON.stringify(obj, null, 2);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateMockJson());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!fields || fields.length === 0) {
    return (
      <div className="py-4 px-3 text-xs font-mono text-zinc-500 bg-zinc-950/40 rounded-lg border border-zinc-800/60 text-center">
        No payload body required for this operation.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 overflow-hidden text-xs">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/60 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            {title}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-zinc-800 text-zinc-400 rounded">
            {fields.length} {fields.length === 1 ? 'property' : 'properties'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                viewMode === 'tree'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Table2 className="w-3 h-3" />
              <span>Tree</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                viewMode === 'raw'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Code2 className="w-3 h-3" />
              <span>JSON</span>
            </button>
          </div>

          {/* Copy Button */}
          <button
            type="button"
            onClick={copyToClipboard}
            className="p-1 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded transition-colors"
            title="Copy sample JSON"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'tree' ? (
        <div className="divide-y divide-zinc-850 overflow-x-auto">
          {fields.map((item, idx) => (
            <div
              key={idx}
              className="p-3 hover:bg-zinc-900/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-2"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="font-mono font-semibold text-cyan-300 text-[12px]">
                  {item.field}
                </span>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[10px] px-1.5 py-0.2 bg-zinc-900 border border-zinc-700/80 text-zinc-300 rounded">
                    {item.type}
                  </span>

                  {!isResponse && (
                    item.required ? (
                      <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded">
                        required
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-500 px-1.5 py-0.2 bg-zinc-900 border border-zinc-800 rounded">
                        optional
                      </span>
                    )
                  )}
                </div>
              </div>

              {item.description && (
                <div className="text-zinc-400 text-[11px] md:text-right max-w-md font-sans">
                  {item.description}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3 bg-zinc-950 font-mono text-[11px] leading-relaxed text-zinc-300 overflow-x-auto">
          <pre>
            <code>{generateMockJson()}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
