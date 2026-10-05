import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const localeRoot = path.join(sourceRoot, 'locale');
const sourceFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(html|ts)$/.test(entry.name)) sourceFiles.push(full);
  }
}

function flatten(value, prefix = '', result = new Set()) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) flatten(child, prefix ? `${prefix}.${key}` : key, result);
  } else if (prefix) result.add(prefix);
  return result;
}

walk(path.join(sourceRoot, 'app'));
const used = new Set();
const patterns = [
  /['"`]([\w-]+(?:\.[\w-]+)+)['"`]\s*\|\s*i18next/g,
  /(?:\.t|\.tr)\(\s*['"`]([\w-]+(?:\.[\w-]+)+)['"`]/g,
];

for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) used.add(match[1]);
  }
}

const localeFiles = fs.readdirSync(localeRoot).filter(name => name.endsWith('.translation.json'));
const english = flatten(JSON.parse(fs.readFileSync(path.join(localeRoot, 'en.translation.json'), 'utf8')));
const missingEnglish = [...used].filter(key => !english.has(key));

if (missingEnglish.length) {
  console.error(`en.translation.json: missing ${missingEnglish.length} fallback key(s)`);
  console.error(missingEnglish.join('\n'));
  process.exitCode = 1;
} else {
  const inherited = localeFiles
    .filter(filename => filename !== 'en.translation.json')
    .map(filename => {
      const keys = flatten(JSON.parse(fs.readFileSync(path.join(localeRoot, filename), 'utf8')));
      return [filename, [...used].filter(key => !keys.has(key)).length];
    })
    .filter(([, count]) => count > 0);
  console.log(`Translation audit passed: ${used.size} referenced keys resolve in every locale through en fallback.`);
  if (inherited.length) console.log(`Locale-specific fallback coverage: ${inherited.map(([name, count]) => `${name} (${count})`).join(', ')}.`);
}
