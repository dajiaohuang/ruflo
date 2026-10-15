/**
 * CommonJS companion helpers that `hook-handler.cjs` requires but that are not
 * in the signed critical set (#3555).
 *
 * They are CommonJS, so they ship as `.cjs`: a `.js` copy cannot load in a
 * `"type":"module"` project. Installs made before the rename have only the
 * `.js` copies, which the refreshed hook-handler no longer requires, so the
 * refresh writes missing `.cjs` companions from the CLI's own compiled
 * generators (the trust root; no external file to verify). Upgrade can also
 * refresh existing companions from those generators. Stale `.js` copies are
 * left in place and ignored.
 */
import * as fs from 'fs';
import * as path from 'path';

export const COMMONJS_COMPANION_HELPERS = ['session.cjs', 'memory.cjs'] as const;

export async function ensureCommonJsCompanions(
  helpersDir: string,
  refresh = false,
): Promise<Array<(typeof COMMONJS_COMPANION_HELPERS)[number]>> {
  const targets = COMMONJS_COMPANION_HELPERS.filter(
    (name) => refresh || !fs.existsSync(path.join(helpersDir, name)),
  );
  if (targets.length === 0) return [];
  const gen = await import('./helpers-generator.js');
  const content: Record<(typeof COMMONJS_COMPANION_HELPERS)[number], () => string> = {
    'session.cjs': gen.generateSessionManager,
    'memory.cjs': gen.generateMemoryHelper,
  };
  const written: Array<(typeof COMMONJS_COMPANION_HELPERS)[number]> = [];
  for (const name of targets) {
    fs.writeFileSync(path.join(helpersDir, name), content[name](), { encoding: 'utf-8', mode: 0o755 });
    written.push(name);
  }
  return written;
}
