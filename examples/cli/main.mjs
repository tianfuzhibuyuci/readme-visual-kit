import {readFile} from 'node:fs/promises';
const input = process.argv[2];
if (!input) { console.error('Usage: node main.mjs file.md'); process.exit(1); }
try {
  const markdown = await readFile(input, 'utf8');
  const links = [...markdown.matchAll(/\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g)].map(match => match[1]);
  const unique = [...new Set(links)];
  console.log(JSON.stringify(unique, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
