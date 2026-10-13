export function expandedPatterns() {
  const atoms = ['{site,admin}', '{site,}', '{,site}', '{site,site}', '{site}', '{}', '{{site,admin}}', '${site,admin}', '"{site,admin}"', "'{site,admin}'", '`{site,admin}`', '{1..3}', '{01..03}', '{3..1}', '{1..3..2}', '{-2..2}', '{a..Z}', '{Z..a}', '{a..e..2}', '{1..1}', '{1..3..0}', '{1..1000}', '{1..1001}', '{1001..1}', '{0..1000..2}', '{1..1001..2}', '{site,"admin"}', '{site,"admin,other"}', '{site,"{admin,other}"}', '{site,\'admin\'}', '{site,admin', 'site,admin}', '{1...3}', '{1..x}', '{x..3}', '\\{site,admin\\}', '[{site,admin}]', '[{1..3}]', '\\"{site,admin}\\"', '{site,admin}\\', '{__responseos_literal_0__,site}', '{site,admin}{1..3}', '{,site}/{,admin}', '{site,{admin,other}}', '{site,{admin,"other"}}', '"{1..1001}"', '${1..1001}', '{site,${1..1001}}'];
  const cases = atoms.flatMap(atom => [`apps/${atom}`, `apps/${atom}/`, `apps/${atom}/*`, `./apps/${atom}`]);
  const nestedAtoms = atoms.filter(atom => !atom.includes('1000') && !atom.includes('1001'));
  for (const left of nestedAtoms) {
    for (const right of ['site', 'admin', '{site,admin}', '"{site,admin}"', '{1..3}']) cases.push(`apps/{${left},${right}}`);
  }
  return [...new Set(cases)];
}
