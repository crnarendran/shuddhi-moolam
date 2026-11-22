#!/usr/bin/env node
// SM-68: Turn `infra/cloudbuild/triggers.yaml` into idempotent
// `gcloud builds triggers create` commands for `sai-shuddhi-moolam`.
//
// Dry run by default (prints exact gcloud commands and executes nothing).
// Pass `--apply` during the Cloud Build walkthrough to describe-first, create
// missing triggers, and immediately export + import with `disabled: true` so
// every trigger is created disabled.
//
// Zero external dependencies (safe to run without root `node_modules`).

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);

/**
 * Parse a scalar YAML token into string, boolean, or number.
 * @param {string} raw - Trimmed YAML value token.
 * @returns {string|boolean|number} Parsed scalar value.
 */
function parseYamlScalar(raw) {
  const s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    return s.slice(1, -1);
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

/**
 * Strip inline `#` comments outside single/double quotes.
 * @param {string} line - Raw line text.
 * @returns {string} Line text without trailing comments.
 */
function stripYamlComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === quote && line[i - 1] !== '\\') quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

/**
 * Parse the YAML subset used by `infra/cloudbuild/triggers.yaml` without
 * external dependencies.
 * @param {string} raw - Raw YAML document text.
 * @returns {object} Parsed top-level YAML object.
 */
export function parseTriggersYaml(raw) {
  const tokens = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const cleaned = stripYamlComment(rawLine);
    if (!cleaned.trim()) continue;
    const indent = cleaned.search(/\S/);
    tokens.push({ indent, text: cleaned.trim() });
  }

  let idx = 0;

  function parseBlock(minIndent) {
    if (idx >= tokens.length) return {};
    if (tokens[idx].text.startsWith('- ')) {
      return parseList(tokens[idx].indent);
    }
    return parseMap(minIndent);
  }

  function parseList(listIndent) {
    const arr = [];
    while (idx < tokens.length) {
      const tok = tokens[idx];
      if (tok.indent < listIndent || !tok.text.startsWith('- ')) break;
      if (tok.indent > listIndent) {
        throw new Error(`Unexpected list indentation near: ${tok.text}`);
      }
      const afterDash = tok.text.slice(2).trim();
      idx += 1;

      const kvMatch = afterDash.match(/^([A-Za-z0-9_.-]+):(.*)$/);
      if (kvMatch) {
        const obj = {};
        const key = kvMatch[1];
        const rest = kvMatch[2].trim();
        if (rest) {
          obj[key] = parseYamlScalar(rest);
        } else if (idx < tokens.length && tokens[idx].indent > listIndent) {
          obj[key] = parseBlock(tokens[idx].indent);
        } else {
          obj[key] = {};
        }

        if (idx < tokens.length && tokens[idx].indent > listIndent) {
          const extra = parseMap(tokens[idx].indent);
          Object.assign(obj, extra);
        }
        arr.push(obj);
      } else {
        arr.push(parseYamlScalar(afterDash));
      }
    }
    return arr;
  }

  function parseMap(mapIndent) {
    const obj = {};
    while (idx < tokens.length) {
      const tok = tokens[idx];
      if (tok.indent < mapIndent || tok.text.startsWith('- ')) break;
      const kvMatch = tok.text.match(/^([A-Za-z0-9_.-]+):(.*)$/);
      if (!kvMatch) {
        throw new Error(`Expected key:value YAML entry near: ${tok.text}`);
      }
      const key = kvMatch[1];
      const rest = kvMatch[2].trim();
      idx += 1;

      if (rest) {
        obj[key] = parseYamlScalar(rest);
      } else if (idx < tokens.length && tokens[idx].indent > tok.indent) {
        obj[key] = parseBlock(tokens[idx].indent);
      } else if (
        idx < tokens.length &&
        tokens[idx].indent === tok.indent &&
        tokens[idx].text.startsWith('- ')
      ) {
        obj[key] = parseList(tokens[idx].indent);
      } else {
        obj[key] = {};
      }
    }
    return obj;
  }

  if (tokens.length === 0) return {};
  return parseBlock(tokens[0].indent);
}

/**
 * Parse CLI arguments for `scripts/ci/create-triggers.mjs`.
 * @param {string[]} argv - CLI arguments.
 * @returns {object} Normalized options and resolved GCP resource names.
 */
export function parseCliArgs(argv = process.argv.slice(2)) {
  const opts = {
    project: 'sai-shuddhi-moolam',
    region: 'europe-west6',
    connection: 'github',
    repository: 'crnarendran-shuddhi-moolam',
    serviceAccount: null,
    branch: 'dev',
    config: path.join(ROOT, 'infra', 'cloudbuild', 'triggers.yaml'),
    apply: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${a}`);
      i += 1;
      return argv[i];
    };
    const eqVal = (prefix) =>
      a.startsWith(`${prefix}=`) ? a.slice(prefix.length + 1) : null;

    if (a === '--apply') opts.apply = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--project') opts.project = next();
    else if (eqVal('--project') !== null) opts.project = eqVal('--project');
    else if (a === '--region') opts.region = next();
    else if (eqVal('--region') !== null) opts.region = eqVal('--region');
    else if (a === '--connection') opts.connection = next();
    else if (eqVal('--connection') !== null) {
      opts.connection = eqVal('--connection');
    } else if (a === '--repository') opts.repository = next();
    else if (eqVal('--repository') !== null) {
      opts.repository = eqVal('--repository');
    } else if (a === '--service-account') opts.serviceAccount = next();
    else if (eqVal('--service-account') !== null) {
      opts.serviceAccount = eqVal('--service-account');
    } else if (a === '--branch') opts.branch = next();
    else if (eqVal('--branch') !== null) opts.branch = eqVal('--branch');
    else if (a === '--config') opts.config = path.resolve(next());
    else if (eqVal('--config') !== null) {
      opts.config = path.resolve(eqVal('--config'));
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }

  const rawSa =
    opts.serviceAccount ||
    `sm-ci-builder@${opts.project}.iam.gserviceaccount.com`;
  const saPrefix = `projects/${opts.project}/serviceAccounts/`;
  const saEmail = rawSa.startsWith('projects/')
    ? rawSa.split('/serviceAccounts/')[1] || rawSa
    : rawSa;
  const saResource = rawSa.startsWith('projects/')
    ? rawSa
    : `${saPrefix}${saEmail}`;
  const repoResource = opts.repository.startsWith('projects/')
    ? opts.repository
    : `projects/${opts.project}/locations/${opts.region}/connections/${opts.connection}/repositories/${opts.repository}`;

  return {
    ...opts,
    saEmail,
    saResource,
    repoResource,
  };
}

/**
 * Load and parse `triggers[]` from a Cloud Build triggers YAML file.
 * @param {string} filePath - Path to `triggers.yaml`.
 * @returns {object[]} Parsed trigger specifications.
 */
export function loadTriggersYaml(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = parseTriggersYaml(raw);
  if (!parsed || !Array.isArray(parsed.triggers)) {
    throw new Error(`No triggers[] array found in ${filePath}`);
  }
  return parsed.triggers;
}

function formatSubstitutions(subs = {}) {
  return Object.entries(subs)
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
}

/**
 * Quote a CLI token when it contains spaces or shell metacharacters.
 * @param {string} tool - Executable name.
 * @param {string[]} args - Argument array.
 * @returns {string} Formatted shell command string.
 */
export function formatShellCommand(tool, args) {
  const quote = (tok) =>
    /^[A-Za-z0-9_./:@=+-]+$/.test(tok)
      ? tok
      : `'${String(tok).replace(/'/g, "'\\''")}'`;
  return [tool, ...args].map(quote).join(' ');
}

/**
 * Build deterministic `describe` + `create` gcloud plans from trigger specs.
 * @param {object[]} triggers - Parsed trigger specs from `triggers.yaml`.
 * @param {object} opts - Resolved CLI options.
 * @returns {object[]} Trigger action items.
 */
export function buildTriggerPlan(triggers, opts) {
  const items = [];

  for (const trig of triggers) {
    if (!trig || !trig.name) throw new Error('Trigger entry is missing name');
    const buildConfig = trig.filename || 'cloudbuild.yaml';
    const subs = formatSubstitutions(trig.substitutions || {});
    const pushBranch = trig.repositoryEventConfig?.push?.branch;
    const prBranch = trig.repositoryEventConfig?.pullRequest?.branch;
    const disabled = trig.disabled === undefined ? true : Boolean(trig.disabled);

    let createArgs;
    let kind;
    if (pushBranch) {
      kind = 'github-push';
      createArgs = [
        'builds',
        'triggers',
        'create',
        'github',
        `--project=${opts.project}`,
        `--region=${opts.region}`,
        `--name=${trig.name}`,
        ...(trig.description ? [`--description=${trig.description}`] : []),
        `--repository=${opts.repoResource}`,
        `--branch-pattern=${pushBranch}`,
        `--build-config=${buildConfig}`,
        ...(Array.isArray(trig.includedFiles) && trig.includedFiles.length
          ? [`--included-files=${trig.includedFiles.join(',')}`]
          : []),
        ...(Array.isArray(trig.ignoredFiles) && trig.ignoredFiles.length
          ? [`--ignored-files=${trig.ignoredFiles.join(',')}`]
          : []),
        ...(subs ? [`--substitutions=${subs}`] : []),
        `--service-account=${opts.saResource}`,
      ];
    } else if (prBranch) {
      kind = 'github-pr';
      const commentControl =
        trig.repositoryEventConfig?.pullRequest?.commentControl ||
        'COMMENTS_ENABLED_FOR_EXTERNAL_CONTRIBUTORS_ONLY';
      createArgs = [
        'builds',
        'triggers',
        'create',
        'github',
        `--project=${opts.project}`,
        `--region=${opts.region}`,
        `--name=${trig.name}`,
        ...(trig.description ? [`--description=${trig.description}`] : []),
        `--repository=${opts.repoResource}`,
        `--pull-request-pattern=${prBranch}`,
        `--comment-control=${commentControl}`,
        `--build-config=${buildConfig}`,
        ...(Array.isArray(trig.includedFiles) && trig.includedFiles.length
          ? [`--included-files=${trig.includedFiles.join(',')}`]
          : []),
        ...(Array.isArray(trig.ignoredFiles) && trig.ignoredFiles.length
          ? [`--ignored-files=${trig.ignoredFiles.join(',')}`]
          : []),
        ...(subs ? [`--substitutions=${subs}`] : []),
        `--service-account=${opts.saResource}`,
      ];
    } else {
      kind = 'manual';
      createArgs = [
        'builds',
        'triggers',
        'create',
        'manual',
        `--project=${opts.project}`,
        `--region=${opts.region}`,
        `--name=${trig.name}`,
        ...(trig.description ? [`--description=${trig.description}`] : []),
        `--repository=${opts.repoResource}`,
        `--branch=${opts.branch}`,
        `--build-config=${buildConfig}`,
        ...(subs ? [`--substitutions=${subs}`] : []),
        `--service-account=${opts.saResource}`,
      ];
    }

    const describeArgs = [
      'builds',
      'triggers',
      'describe',
      trig.name,
      `--project=${opts.project}`,
      `--region=${opts.region}`,
      '--format=json',
    ];

    items.push({
      name: trig.name,
      kind,
      disabled,
      describeArgs,
      createArgs,
    });
  }

  return items;
}

function winCmdQuote(arg) {
  const s = String(arg);
  if (/^[A-Za-z0-9_./:@=+-]+$/.test(s)) return s;
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Run a `gcloud` CLI invocation via `spawnSync`.
 * @param {string[]} args - `gcloud` subcommand arguments.
 * @returns {{status: number, stdout: string, stderr: string}} Command result.
 */
export function defaultGcloudRunner(args) {
  if (process.platform === 'win32') {
    const line = ['gcloud', ...args.map(winCmdQuote)].join(' ');
    const r = spawnSync('cmd.exe', ['/d', '/s', '/c', `"${line}"`], {
      encoding: 'utf8',
      windowsVerbatimArguments: true,
      windowsHide: true,
    });
    return {
      status: r.status ?? 1,
      stdout: r.stdout || '',
      stderr: r.stderr || (r.error ? r.error.message : ''),
    };
  }
  const r = spawnSync('gcloud', args, { encoding: 'utf8', windowsHide: true });
  return {
    status: r.status ?? 1,
    stdout: r.stdout || '',
    stderr: r.stderr || (r.error ? r.error.message : ''),
  };
}

/**
 * Execute describe-first trigger creation, then immediately describe + import
 * with `disabled: true` so every new trigger is created disabled.
 * @param {object[]} plan - Items returned by `buildTriggerPlan`.
 * @param {object} opts - Resolved CLI options.
 * @param {Function} runner - Command runner `(args) => { status, stdout, stderr }`.
 * @param {Function} log - Logger function.
 * @returns {void}
 */
export function applyTriggerPlan(
  plan,
  opts,
  runner = defaultGcloudRunner,
  log = console.log
) {
  for (const item of plan) {
    const desc = runner(item.describeArgs);
    if (desc.status === 0) {
      log(
        `✓ trigger ${item.name} already exists in ${opts.project}/${opts.region} — skipping (not duplicated)`
      );
      continue;
    }

    const created = runner(item.createArgs);
    if (created.status !== 0) {
      throw new Error(
        `Failed to create trigger ${item.name}: ${String(
          created.stderr || created.stdout
        ).trim()}`
      );
    }
    log(`✓ created ${item.kind} trigger ${item.name}`);

    if (item.disabled) {
      const exported = runner(item.describeArgs);
      if (exported.status !== 0) {
        throw new Error(
          `Failed to describe newly created trigger ${item.name} for disabling: ${String(
            exported.stderr || exported.stdout
          ).trim()}`
        );
      }

      let triggerJson;
      try {
        triggerJson = JSON.parse(exported.stdout);
      } catch {
        throw new Error(
          `Failed to parse JSON from describe for trigger ${item.name}`
        );
      }

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-trigger-'));
      const tmpFile = path.join(tmpDir, `${item.name}.json`);
      try {
        fs.writeFileSync(
          tmpFile,
          JSON.stringify({ ...triggerJson, disabled: true }, null, 2),
          'utf8'
        );
        const imported = runner([
          'builds',
          'triggers',
          'import',
          `--source=${tmpFile}`,
          `--project=${opts.project}`,
          `--region=${opts.region}`,
        ]);
        if (imported.status !== 0) {
          throw new Error(
            `Failed to import disabled trigger ${item.name}: ${String(
              imported.stderr || imported.stdout
            ).trim()}`
          );
        }
        log(`✓ disabled trigger ${item.name} (disabled: true)`);
      } finally {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
          // Best-effort cleanup
        }
      }
    }
  }
}

function printUsage() {
  console.log(
    [
      'Usage: node scripts/ci/create-triggers.mjs [options] [--apply]',
      '  --project <id>           (default: sai-shuddhi-moolam)',
      '  --region <region>        (default: europe-west6)',
      '  --connection <name>      (default: github)',
      '  --repository <name|res>  (default: crnarendran-shuddhi-moolam)',
      '  --service-account <sa>   (default: sm-ci-builder@<project>.iam.gserviceaccount.com)',
      '  --branch <branch>        (default: dev)',
      '  --config <path>          (default: infra/cloudbuild/triggers.yaml)',
      '  --apply                  describe-first, create, and import disabled: true',
    ].join('\n')
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    const opts = parseCliArgs(process.argv.slice(2));
    if (opts.help) {
      printUsage();
      process.exit(0);
    }
    const triggers = loadTriggersYaml(opts.config);
    const plan = buildTriggerPlan(triggers, opts);
    if (!opts.apply) {
      console.log(
        `# Cloud Build triggers for ${opts.project} (${opts.region}) — DRY RUN`
      );
      for (const item of plan) {
        console.log(formatShellCommand('gcloud', item.createArgs));
        if (item.disabled) {
          console.log(
            `# then describe + import ${item.name} with disabled: true`
          );
        }
      }
      console.log(
        '# Dry run complete. Pass --apply to describe-first, create missing triggers, and mark disabled.'
      );
    } else {
      applyTriggerPlan(plan, opts);
    }
  } catch (err) {
    console.error(`✗ ${err.message || err}`);
    process.exit(1);
  }
}
