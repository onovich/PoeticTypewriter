import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const api = path.join(root, 'api');
const target = process.argv[2];
const checkOnly = process.argv.includes('--check');

function run(script, args, cwd = root) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed: ${path.basename(script)} ${args[0]}`);
}

function main() {
  if (!['staging', 'production'].includes(target)) throw new Error('Choose staging or production.');
  const config = JSON.parse(readFileSync(path.join(api, 'wrangler.cloudflare.jsonc'), 'utf8'));
  const selected = { ...config, ...config.env[target] };
  delete selected.env;
  delete selected.$schema;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID || selected.d1_databases[0].database_id;
  if (!checkOnly && (!/^[a-f0-9-]{36}$/i.test(databaseId) || databaseId.startsWith('00000000-'))) {
    throw new Error('Set CLOUDFLARE_D1_DATABASE_ID to the real database ID for this environment.');
  }
  const secret = process.env.RUN_TOKEN_SECRET;
  if (!checkOnly && (!secret || secret.length < 32)) {
    throw new Error('Provide the persistent RUN_TOKEN_SECRET for this environment (at least 32 characters).');
  }
  selected.main = path.join(api, selected.main);
  selected.assets.directory = path.resolve(api, selected.assets.directory);
  selected.d1_databases[0] = {
    ...selected.d1_databases[0], database_id: databaseId, migrations_dir: path.join(api, 'migrations'),
  };
  const local = path.join(root, '.local');
  mkdirSync(local, { recursive: true });
  const configPath = path.join(local, `cloudflare-${target}.json`);
  const secretsPath = path.join(local, `cloudflare-${target}.secrets.json`);
  writeFileSync(configPath, JSON.stringify(selected, null, 2) + '\n');
  const wrangler = path.join(api, 'node_modules/wrangler/bin/wrangler.js');
  run(path.join(root, 'node_modules/vite/bin/vite.js'), ['build', '--mode', 'cloudflare']);
  run(wrangler, ['deploy', '--config', configPath, '--dry-run'], api);
  if (checkOnly) return;
  try {
    writeFileSync(secretsPath, JSON.stringify({ RUN_TOKEN_SECRET: secret }), { mode: 0o600 });
    run(wrangler, ['d1', 'migrations', 'apply', 'DB', '--config', configPath, '--remote'], api);
    run(wrangler, ['deploy', '--config', configPath, '--secrets-file', secretsPath], api);
  } finally {
    rmSync(secretsPath, { force: true });
  }
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
