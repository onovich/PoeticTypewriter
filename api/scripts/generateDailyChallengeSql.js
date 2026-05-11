import fs from 'node:fs';
import path from 'node:path';
import { createDailyChallengeSeedSql, generateDailyChallengeSet } from '../src/challengeGeneration.js';

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const options = {
    count: 100,
    date: getTodayIsoDate(),
    out: null,
    preview: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--date') {
      options.date = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--count') {
      options.count = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }

    if (arg === '--out') {
      options.out = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--preview') {
      options.preview = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(options.count) || options.count <= 0) {
    throw new Error(`Invalid count: ${options.count}`);
  }

  return options;
}

function writeSqlOutput(outputPath, sql) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, sql, 'utf8');
}

function printSummary(challengeSet, outputPath) {
  console.log(`Challenge date: ${challengeSet.challengeDate}`);
  console.log(`Challenge id: ${challengeSet.challengeId}`);
  console.log(`Seed: ${challengeSet.seed}`);
  console.log(`Items: ${challengeSet.itemCount}`);
  console.log(`First item: ${challengeSet.items[0]?.text ?? 'n/a'}`);
  if (outputPath) {
    console.log(`Wrote SQL to: ${outputPath}`);
  }
}

function printPreview(challengeSet) {
  console.log(`Challenge date: ${challengeSet.challengeDate}`);
  console.log(`Challenge id: ${challengeSet.challengeId}`);
  console.log(`Seed: ${challengeSet.seed}`);
  console.log(`Items: ${challengeSet.itemCount}`);

  challengeSet.items.forEach((item) => {
    console.log(`${String(item.position).padStart(3, '0')} ${item.text}`);
  });
}

try {
  const options = parseArgs(process.argv.slice(2));
  const challengeSet = generateDailyChallengeSet(options.date, options.count);
  const sql = createDailyChallengeSeedSql(challengeSet);

  if (options.preview) {
    printPreview(challengeSet);
    process.exit(0);
  }

  if (options.out) {
    const outputPath = path.resolve(process.cwd(), options.out);
    writeSqlOutput(outputPath, sql);
    printSummary(challengeSet, outputPath);
  } else {
    process.stdout.write(sql);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}