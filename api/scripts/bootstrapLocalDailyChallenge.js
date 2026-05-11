import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createDailyChallengeSeedSql, generateDailyChallengeSet } from '../src/challengeGeneration.js';

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const options = {
    count: 100,
    date: getTodayIsoDate(),
    skipMigrate: false,
    target: 'local',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--date') {
      options.date = argv[index + 1] ?? options.date;
      index += 1;
      continue;
    }

    if (arg === '--count') {
      options.count = Number.parseInt(argv[index + 1] ?? '', 10) || options.count;
      index += 1;
      continue;
    }

    if (arg === '--skip-migrate') {
      options.skipMigrate = true;
      continue;
    }

    if (arg === '--remote') {
      options.target = 'remote';
      continue;
    }

    if (arg === '--local') {
      options.target = 'local';
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function getNpxCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

function runOrThrow(command, args) {
  const isWindows = process.platform === 'win32';
  const executable = isWindows ? 'cmd.exe' : command;
  const executableArgs = isWindows ? ['/d', '/s', '/c', [command, ...args].join(' ')] : args;
  const result = spawnSync(executable, executableArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    if (result.error) {
      throw result.error;
    }

    throw new Error(`Command failed: ${executable} ${executableArgs.join(' ')}`);
  }
}

function writeSqlFile(challengeSet) {
  const sql = createDailyChallengeSeedSql(challengeSet);
  const outputDirectory = path.resolve(process.cwd(), '../.local/challenges');
  const outputPath = path.join(outputDirectory, `${challengeSet.challengeDate}.sql`);

  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(outputPath, sql, 'utf8');

  return outputPath;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const challengeSet = generateDailyChallengeSet(options.date, options.count);
  const sqlPath = writeSqlFile(challengeSet);
  const npxCommand = getNpxCommand();
  const targetFlag = options.target === 'remote' ? '--remote' : '--local';
  const targetLabel = options.target === 'remote' ? 'remote' : 'local';

  console.log(`Prepared ${targetLabel} challenge SQL: ${sqlPath}`);

  if (!options.skipMigrate) {
    console.log(`Applying ${targetLabel} D1 migrations...`);
    runOrThrow(npxCommand, ['--yes', 'wrangler', 'd1', 'migrations', 'apply', 'poetic-typewriter', targetFlag]);
  }

  console.log(`Seeding ${targetLabel} D1 with daily challenge...`);
  runOrThrow(npxCommand, ['--yes', 'wrangler', 'd1', 'execute', 'poetic-typewriter', targetFlag, '--file', sqlPath]);

  console.log(`${options.target === 'remote' ? 'Remote' : 'Local'} daily challenge ready: ${challengeSet.challengeId}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}