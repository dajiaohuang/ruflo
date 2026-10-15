import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { executeUpgrade } from '../src/init/executor.js';
import { generateMemoryHelper, generateSessionManager } from '../src/init/helpers-generator.js';

const workdir = mkdtempSync(join(tmpdir(), 'issue-4198-upgrade-'));
const helpersDir = join(workdir, '.claude', 'helpers');

function seedStaleCompanions(): void {
  mkdirSync(helpersDir, { recursive: true });
  writeFileSync(join(helpersDir, 'session.cjs'), '// stale session companion');
  writeFileSync(join(helpersDir, 'memory.cjs'), '// stale memory companion');
}

afterEach(() => rmSync(workdir, { recursive: true, force: true }));

describe('issue #4198 — upgrade refreshes CommonJS companions', () => {
  it('replaces existing companion files with current generated helpers', async () => {
    seedStaleCompanions();

    const result = await executeUpgrade(workdir);

    expect(result.success).toBe(true);
    expect(result.updated).toContain('.claude/helpers/session.cjs');
    expect(result.updated).toContain('.claude/helpers/memory.cjs');
    expect(readFileSync(join(helpersDir, 'session.cjs'), 'utf8')).toBe(generateSessionManager());
    expect(readFileSync(join(helpersDir, 'memory.cjs'), 'utf8')).toBe(generateMemoryHelper());
  });

  it('does not create an id-less current session when intelligence records context', () => {
    const dataDir = join(workdir, '.claude-flow', 'data');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'ranked-context.json'), JSON.stringify({
      entries: [{ id: 'p1', words: ['cobalt', 'quartz'], summary: 'cobalt quartz pattern' }],
    }));

    execFileSync(process.execPath, [
      '-e',
      `require(${JSON.stringify(fileURLToPath(new URL('../.claude/helpers/intelligence.cjs', import.meta.url)))}).getContext('cobalt quartz')`,
    ], { cwd: workdir, env: { ...process.env, CLAUDE_PROJECT_DIR: workdir } });

    expect(existsSync(join(workdir, '.claude-flow', 'sessions', 'current.json'))).toBe(false);
  });
});
