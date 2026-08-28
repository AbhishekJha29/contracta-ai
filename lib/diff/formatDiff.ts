import { DiffEntry } from './types';

/**
 * Formats an array of DiffEntry objects into a structured, readable Markdown document.
 * Groups by severity (breaking changes first) and produces clean GitHub-compatible markdown tables.
 */
export function formatDiff(diffs: DiffEntry[]): string {
  if (!diffs || diffs.length === 0) {
    return [
      '## 📋 OpenAPI Contract Diff Summary',
      '',
      '> ✅ **No API contract changes detected.** The specification is fully backwards-compatible.',
    ].join('\n');
  }

  const breaking = diffs.filter((d) => d.severity === 'breaking');
  const nonBreaking = diffs.filter((d) => d.severity === 'non-breaking');

  const lines: string[] = [];

  lines.push('## 📋 OpenAPI Contract Diff Summary');
  lines.push('');

  // Summary badge line
  if (breaking.length > 0) {
    lines.push(
      `> 🚨 **${breaking.length} Breaking Change${breaking.length === 1 ? '' : 's'}** detected | ℹ️ **${nonBreaking.length} Non-Breaking Change${nonBreaking.length === 1 ? '' : 's'}**`
    );
  } else {
    lines.push(
      `> ✅ **No Breaking Changes** | ℹ️ **${nonBreaking.length} Non-Breaking Change${nonBreaking.length === 1 ? '' : 's'}**`
    );
  }
  lines.push('');

  // Section 1: Breaking Changes (always first)
  if (breaking.length > 0) {
    lines.push(`### 🚨 Breaking Changes (${breaking.length})`);
    lines.push('');
    lines.push('| Method | Path | Change Type | Description |');
    lines.push('| :--- | :--- | :--- | :--- |');

    for (const entry of breaking) {
      const method = `\`${entry.method}\``;
      const path = `\`${entry.path}\``;
      const type = `\`${entry.changeType}\``;
      const desc = escapeMarkdownTable(entry.description);
      lines.push(`| ${method} | ${path} | ${type} | ${desc} |`);
    }
    lines.push('');
  }

  // Section 2: Non-Breaking Changes
  if (nonBreaking.length > 0) {
    lines.push(`### ✨ Non-Breaking Changes (${nonBreaking.length})`);
    lines.push('');
    lines.push('| Method | Path | Change Type | Description |');
    lines.push('| :--- | :--- | :--- | :--- |');

    for (const entry of nonBreaking) {
      const method = `\`${entry.method}\``;
      const path = `\`${entry.path}\``;
      const type = `\`${entry.changeType}\``;
      const desc = escapeMarkdownTable(entry.description);
      lines.push(`| ${method} | ${path} | ${type} | ${desc} |`);
    }
    lines.push('');
  }

  // Section 3: Recommendations / Guidance if breaking changes detected
  if (breaking.length > 0) {
    lines.push('---');
    lines.push('### ⚠️ Impact & Remediation Guidance');
    lines.push('');
    lines.push('- **Backwards Compatibility**: Existing client applications calling these endpoints may fail at runtime.');
    lines.push('- **Recommended Actions**:');
    lines.push('  1. Restore removed required fields or endpoints with deprecation notices.');
    lines.push('  2. Provide default values for newly added required parameters.');
    lines.push('  3. If breaking changes are intentional, consider incrementing the major API version.');
  }

  return lines.join('\n');
}

/**
 * Escapes pipe characters so markdown table cells don't break.
 */
function escapeMarkdownTable(text: string): string {
  if (!text) return '';
  return text.replace(/\|/g, '\\|');
}
