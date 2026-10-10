import path from 'node:path';
import { createRequire } from 'node:module';
const tiny = createRequire(path.resolve('package.json'))('tinyglobby');
export const globSync = (pattern, options) => {
  const absolute = path.isAbsolute(pattern);
  const dynamic = tiny.isDynamicPattern(pattern);
  const base = pattern.endsWith('/**') ? pattern.slice(0,-3) : null;
  return tiny.globSync(pattern, {...options, expandDirectories:false, absolute})
    .map(p => p.replace(/\/$/, ''))
    .filter(p => base === null || p !== base)
    .map(p => !dynamic && pattern.endsWith('/') ? p + '/' : p);
};
