import { spawnSync } from 'node:child_process';
const cases = [
  { name: 'ordinary alternatives', kind: 'ordinary', reject: false },
  { name: 'moderate nested braces', kind: 'moderate', reject: false },
  { name: 'deep nesting', kind: 'depth', reject: true },
  { name: 'Cartesian expansion', kind: 'product', reject: true },
  { name: 'long sequence of alternatives', kind: 'chain', reject: true },
  { name: 'large reverse range', kind: 'range', reject: true },
  { name: 'oversized input', kind: 'length', reject: true },
  { name: 'malformed rewrite chain', kind: 'rewrite', reject: true },
];
const results = cases.map(test => {
  const code = `
    import { braces } from './scripts/security/braces-matcher-experiment.mjs';
    const patterns = {
      ordinary: 'apps/{site,admin}',
      moderate: '{'.repeat(16) + 'a,b' + '}'.repeat(16),
      depth: '{'.repeat(3000) + 'a,b' + '}'.repeat(3000),
      product: '{a,b}'.repeat(25),
      chain: '{a,b}'.repeat(1500),
      range: 'apps/{1000000..1}',
      length: 'a'.repeat(70000) + '{b,c}',
      rewrite: '{a}' + '}'.repeat(10000) + ',z}',
    };
    const started = performance.now();
    try { const value = braces(patterns[${JSON.stringify(test.kind)}]); console.log(JSON.stringify({ rejected: false, count: value.length, elapsedMs: performance.now() - started })); }
    catch (error) { console.log(JSON.stringify({ rejected: true, error: error.name, message: error.message, elapsedMs: performance.now() - started })); }
  `;
  const child = spawnSync(process.execPath, ['--max-old-space-size=128', '--input-type=module', '--eval', code], { timeout: 5000, maxBuffer: 65536, windowsHide: true, encoding: 'utf8' });
  let result;
  try { result = JSON.parse(child.stdout.trim()); } catch { result = { rejected: false, error: child.error?.code || child.signal || child.stderr.slice(0,300) }; }
  return { name: test.name, expectedRejection: test.reject, ...result, exit: child.status, pass: child.status === 0 && result.rejected === test.reject && (!test.reject || ['RangeError','SyntaxError'].includes(result.error)) };
});
console.log(JSON.stringify({node:process.version,platform:process.platform,timeoutMs:5000,heapMiB:128,results},null,2));
process.exitCode = results.every(result => result.pass) ? 0 : 1;
