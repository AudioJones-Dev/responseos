import { createRequire } from 'node:module';
import path from 'node:path';
const load = createRequire(path.resolve('.security-tools/matcher/package.json'));
const expand = load('brace-expansion').expand;
const fill = load('fill-range');
const picomatch = load('picomatch');
export const scan = picomatch.scan;
export const makeRe = picomatch.makeRe;

const maxOutput = 100000;
const maxCharacters = 4000000;
function expansionBudget(pattern) {
  const stack = [{ count: 1, length: 0, alternatives: 0, longest: 0 }];
  let closings = 0;
  for (let i = 0; i < pattern.length; i++) {
    const frame = stack.at(-1);
    const char = pattern[i];
    if (char === '\\') {
      frame.length += 2;
      i++;
    } else if (char === '{') {
      if (stack.length > 256) throw new RangeError('Adapter nesting budget exceeded');
      stack.push({ count: 1, length: 0, alternatives: 0, longest: 0 });
    } else if (char === '}' && stack.length > 1) {
      const group = stack.pop();
      const parent = stack.at(-1);
      parent.count *= group.alternatives + group.count;
      parent.length += Math.max(group.longest, group.length) + 2;
    } else if (char === ',' && stack.length > 1) {
      frame.alternatives += frame.count;
      frame.longest = Math.max(frame.longest, frame.length);
      frame.count = 1;
      frame.length = 0;
    } else {
      frame.length++;
      if (char === '}' && ++closings > 1000) throw new RangeError('Adapter rewrite budget exceeded');
    }
    if (frame.count > maxOutput || frame.alternatives > maxOutput) throw new RangeError('Adapter output budget exceeded');
  }
  const count = stack.reduce((product, frame) => product * (frame.count + frame.alternatives), 1);
  const length = stack.reduce((sum, frame) => sum + Math.max(frame.length, frame.longest) + 2, 0);
  if (count > maxOutput || count * length > maxCharacters) throw new RangeError('Adapter expansion budget exceeded');
}
export const braces = (pattern) => {
  if (!pattern.includes('{') || !pattern.includes('}')) return [pattern];
  if (pattern.length > 65536) throw new SyntaxError(`Input length (${pattern.length}), exceeds max characters (65536)`);
  let prefix = '__responseos_literal_';
  while (pattern.includes(prefix)) prefix += '_';
  const literals = [];
  const token = (value) => {
    const key = `${prefix}${literals.length}__`;
    literals.push([key, value]);
    return key;
  };
  let prepared = '';
  const dollar = [];
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '\\') {
      prepared += char + (pattern[++i] ?? '');
      continue;
    }
    if (char === '[') {
      let literal = char;
      let depth = 1;
      while (++i < pattern.length && depth > 0) {
        literal += pattern[i];
        if (pattern[i] === '\\') literal += pattern[++i] ?? '';
        else if (pattern[i] === '[') depth++;
        else if (pattern[i] === ']') depth--;
      }
      if (depth === 0) i--;
      prepared += token(literal);
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      let literal = '';
      while (++i < pattern.length && pattern[i] !== char) {
        literal += pattern[i];
        if (pattern[i] === '\\') literal += pattern[++i] ?? '';
      }
      prepared += token(literal);
      continue;
    }
    if (char === '{') {
      const isDollar = dollar.at(-1) === true || pattern[i - 1] === '$';
      const range = !isDollar && /^\{(-?\d+|[a-zA-Z])\.\.(-?\d+|[a-zA-Z])(?:\.\.(-?\d+))?\}/.exec(pattern.slice(i));
      if (range) {
        const [, start, end, step] = range;
        if (step === undefined && /^-?\d+$/.test(start) && /^-?\d+$/.test(end) && Number(end) - Number(start) >= 1000) {
          throw new RangeError('expanded array length exceeds range limit. Use options.rangeLimit to increase or disable the limit.');
        }
        if (Math.abs(Number(end) - Number(start)) > 100000) throw new RangeError('Adapter range budget exceeded');
        const values = fill(start, end, step);
        if (values.length) {
          const members = values.map(value => token(String(value)));
          prepared += members.length === 1 ? members[0] : `{${members.join(',')}}`;
          i += range[0].length - 1;
          continue;
        }
      }
      dollar.push(isDollar);
      if (dollar.length > 256) throw new RangeError('Adapter nesting budget exceeded');
    } else if (char === '}') {
      dollar.pop();
    }
    prepared += char;
  }
  expansionBudget(prepared);
  const replacements = new Map(literals);
  const matcher = new RegExp(prefix + '[0-9]+__', 'g');
  return [...new Set(expand(prepared).map(value => value.replace(matcher, key => replacements.get(key))))];
};
