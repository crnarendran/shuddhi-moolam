#!/usr/bin/env node
// SM-68: Provider-neutral CI & deploy runner for Shuddhi-Moolam.
// Both `.github/workflows/*.yml` and `cloudbuild.yaml` delegate here so
// switching `CI_PROVIDER` between `github` and `cloudbuild` never changes
// pipeline steps or environment resolution.
//
// Usage:
//   node scripts/ci/run.mjs deploy <dev|staging|main> [--dry-run]
//   node scripts/ci/run.mjs sync-docs <dev|staging|main|prod> [--dry-run]

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

export const PROJECT_ID = 'sai-shuddhi-moolam';
export const DEPLOY_BRANCHES = ['dev', 'staging', 'main'];
export const SYNC_DOCS_BRANCHES = ['dev', 'staging', 'main', 'prod'];
export const PORTAL_DISPATCH_URL =
  'https://api.github.com/repos/crnarendran/docs-portal/dispatches';

export const CLOUD_FUNCTIONS = [
  'driveWebhook',
  'processPendingPdf',
  'helloWorld',
  'registerWatch',
  'renewWatch',
  'chatEndpoint',
  'priceReviewAlert',
  'guidanceAlert',
  'clearTabs',
  'createInvitation',
  'acceptInvitation',
  'resendInvitation',
  'revokeInvitation',
  'setUserPlan',
  'listUserPlans',
  'seedEnvData',
  'probeExtraction',
  'reprocessPendingPdf',
  'backfillSheetFromHistory',
  'manualUpsert',
];

const HOSTING_BY_BRANCH = {
  main: 'hosting:sai-shuddhi-moolam',
  staging: 'hosting:sai-shuddhi-moolam-staging',
  dev: 'hosting:sai-shuddhi-moolam-dev',
};

const SUFFIX_BY_BRANCH = {
  main: '',
  staging: '_staging',
  dev: '_dev',
};

/**
 * Return true when executing under Google Cloud Build.
 * @param {NodeJS.ProcessEnv} env - Environment map to inspect.
 * @returns {boolean} Whether Cloud Build ADC mode is active.
 */
export function inCloudBuild(env = process.env) {
  return env.CI_PROVIDER === 'cloudbuild' || Boolean(env.BUILD_ID);
}

/**
 * Compute the full deployment plan for `deploy <branch>`.
 * @param {string} branch - Target git branch (`dev`, `staging`, or `main`).
 * @param {NodeJS.ProcessEnv} env - Environment map to inspect.
 * @returns {object} Planned suffix, hosting target, functions, and command.
 */
export function planDeploy(branch, env = process.env) {
  const cleanBranch = String(branch || '').trim();
  if (!DEPLOY_BRANCHES.includes(cleanBranch)) {
    throw new Error(
      `Invalid deploy branch "${branch}" (must be dev, staging, or main)`
    );
  }

  const suffix = SUFFIX_BY_BRANCH[cleanBranch];
  const hosting = HOSTING_BY_BRANCH[cleanBranch];
  const functions = CLOUD_FUNCTIONS.map((name) => `functions:${name}${suffix}`);
  const onlyTarget = [...functions, 'firestore', hosting].join(',');
  const cloudBuild = inCloudBuild(env);
  const authMode = cloudBuild ? 'adc' : 'service-account-file';
  const firebaseBin = cloudBuild ? 'firebase' : 'npx';
  const firebaseArgs = cloudBuild
    ? ['deploy', '--only', onlyTarget, '--project', PROJECT_ID, '--force']
    : [
        'firebase-tools',
        'deploy',
        '--only',
        onlyTarget,
        '--project',
        PROJECT_ID,
        '--force',
      ];

  return {
    branch: cleanBranch,
    suffix,
    hosting,
    functions,
    onlyTarget,
    cloudBuild,
    authMode,
    firebaseBin,
    firebaseArgs,
  };
}

/**
 * Compute the docs-portal sync plan for `sync-docs <branch>`.
 * @param {string} branch - Branch name (`dev`, `staging`, `main`, or `prod`).
 * @param {NodeJS.ProcessEnv} env - Environment map to inspect.
 * @returns {object} Planned projectId, env, secretEnv, portalRef, and dispatch.
 */
export function planSyncDocs(branch, env = process.env) {
  const docsTarget = String(env.DOCS_TARGET || '').trim();
  if (docsTarget && docsTarget !== 'staging' && docsTarget !== 'prod') {
    throw new Error(
      `Invalid DOCS_TARGET "${docsTarget}" (must be staging or prod)`
    );
  }

  const fallbackBranch = env.GITHUB_REF_NAME || env.BRANCH_NAME || 'staging';
  const cleanBranch = String(
    branch !== undefined && branch !== '' ? branch : fallbackBranch
  ).trim();
  if (!SYNC_DOCS_BRANCHES.includes(cleanBranch)) {
    throw new Error(
      `Invalid sync-docs branch "${cleanBranch}" (must be dev, staging, main, or prod)`
    );
  }

  const isProd = docsTarget === 'prod' || cleanBranch === 'prod';
  const projectId = isProd ? 'docs-portal-prod' : 'docs-portal-staging';
  const syncEnv = isProd ? 'staging' : cleanBranch === 'dev' ? 'dev' : 'staging';
  const secretEnv = isProd
    ? 'FIREBASE_SERVICE_ACCOUNT_DOCS_PORTAL_PROD'
    : 'FIREBASE_SERVICE_ACCOUNT_DOCS_PORTAL_STAGING';
  const portalRef = isProd
    ? 'main'
    : cleanBranch === 'dev'
      ? 'dev'
      : 'staging';

  const dispatchToken = String(
    env.GH_TOKEN || env.DOCS_PORTAL_DISPATCH_TOKEN || ''
  ).trim();
  const dispatchPayload = {
    event_type: 'docs-updated',
    client_payload: {
      project: 'shuddhi-moolam',
      ref: portalRef,
    },
  };

  return {
    branch: cleanBranch,
    docsTarget,
    projectId,
    env: syncEnv,
    secretEnv,
    portalRef,
    hasDispatchToken: Boolean(dispatchToken),
    dispatchUrl: PORTAL_DISPATCH_URL,
    dispatchPayload,
  };
}

/**
 * Execute or dry-run a child process command.
 * @param {string} cmd - Executable name.
 * @param {string[]} args - Argument list.
 * @param {object} options - Execution options (`cwd`, `env`, `dryRun`, `label`).
 * @returns {void}
 */
export function runCmd(
  cmd,
  args,
  { cwd = ROOT, env = process.env, dryRun = false, label = null } = {}
) {
  const display = label || `${cmd} ${args.join(' ')}`;
  if (dryRun) {
    console.log(`[dry-run] (${path.relative(ROOT, cwd) || '.'}) ${display}`);
    return;
  }

  console.log(`[ci/run] (${path.relative(ROOT, cwd) || '.'}) ${display}`);
  const useShell =
    process.platform === 'win32' && ['npm', 'npx', 'firebase'].includes(cmd);
  const res = spawnSync(cmd, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: useShell,
    windowsHide: true,
  });

  if (res.error) {
    const err = new Error(
      `[ci/run] Failed to start ${cmd}: ${res.error.message}`
    );
    err.exitCode = 1;
    throw err;
  }
  if (res.status !== 0) {
    const exitCode = res.status ?? 1;
    const err = new Error(
      `[ci/run] Command failed (${exitCode}): ${display}`
    );
    err.exitCode = exitCode;
    throw err;
  }
}

/**
 * Rewrite `process.env.APP_ENV || 'dev'` to the deploy branch literal in
 * `functions/src/index.ts` and `functions/src/config.ts`.
 * @param {string} branch - Deploy branch name.
 * @param {string} functionsDir - Path to `functions/`.
 * @returns {void}
 */
export function rewriteAppEnv(
  branch,
  functionsDir = path.join(ROOT, 'functions')
) {
  const targets = [
    path.join(functionsDir, 'src', 'index.ts'),
    path.join(functionsDir, 'src', 'config.ts'),
  ];
  const literal = `('${branch}' as string)`;
  const updates = [];

  for (const filePath of targets) {
    const src = fs.readFileSync(filePath, 'utf8');
    const next = src.replaceAll("process.env.APP_ENV || 'dev'", literal);
    if (next === src) {
      throw new Error(
        `Expected "process.env.APP_ENV || 'dev'" in ${filePath}`
      );
    }
    updates.push({ filePath, next });
  }

  for (const { filePath, next } of updates) {
    fs.writeFileSync(filePath, next, 'utf8');
  }
}

/**
 * Write a service-account JSON string to a mode-0600 temp file under
 * `os.tmpdir()`, await `fn` with `GOOGLE_APPLICATION_CREDENTIALS` set, and
 * remove the temporary directory in `finally`.
 * @param {string} secretJson - Raw service-account JSON text.
 * @param {Function} fn - Async or sync callback receiving credentialed env.
 * @param {NodeJS.ProcessEnv} env - Base environment variables.
 * @returns {Promise<*>} Return value resolved from `fn`.
 */
export async function withTempKeyFile(secretJson, fn, env = process.env) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-ci-sa-'));
  const saFile = path.join(tmpDir, 'sa.json');
  try {
    fs.writeFileSync(saFile, secretJson, { mode: 0o600 });
    return await fn({
      ...env,
      GOOGLE_APPLICATION_CREDENTIALS: saFile,
    });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}

/**
 * Trigger a `docs-portal` rebuild via GitHub `repository_dispatch`.
 * @param {string} portalRef - Target `docs-portal` ref (`dev`, `staging`, `main`).
 * @param {string} token - GitHub dispatch token (never logged).
 * @param {Function} fetchImpl - Fetch function (defaults to `globalThis.fetch`).
 * @returns {Promise<void>} Resolves on 2xx; throws with `exitCode = 1` on error.
 */
export async function triggerPortalRebuild(
  portalRef,
  token,
  fetchImpl = globalThis.fetch
) {
  const res = await fetchImpl(PORTAL_DISPATCH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'shuddhi-moolam-ci',
    },
    body: JSON.stringify({
      event_type: 'docs-updated',
      client_payload: {
        project: 'shuddhi-moolam',
        ref: portalRef,
      },
    }),
  });

  if (!res.ok) {
    const err = new Error(
      `[ci/run] Portal dispatch failed with HTTP ${res.status}`
    );
    err.exitCode = 1;
    throw err;
  }
}

/**
 * Execute or dry-run the full `deploy <branch>` pipeline.
 * @param {string} branch - Target git branch (`dev`, `staging`, or `main`).
 * @param {NodeJS.ProcessEnv} env - Environment variables.
 * @param {object} options - Execution options (`dryRun`, `root`).
 * @returns {Promise<number>} Exit code (`0` on success or skipped deployment).
 */
export async function runDeploy(
  branch,
  env = process.env,
  { dryRun = false, root = ROOT } = {}
) {
  const plan = planDeploy(branch, env);
  const deploySecret = String(
    env.FIREBASE_SERVICE_ACCOUNT_SAI_SHUDDHI_MOOLAM || ''
  ).trim();

  if (!plan.cloudBuild && !deploySecret && !dryRun) {
    console.log(
      'Missing FIREBASE_SERVICE_ACCOUNT_SAI_SHUDDHI_MOOLAM secret. ' +
        'Skipping deployment.'
    );
    return 0;
  }

  const functionsDir = path.join(root, 'functions');
  const dashboardDir = path.join(root, 'dashboard');

  runCmd('npm', ['install'], { cwd: functionsDir, env, dryRun });
  runCmd('npm', ['run', 'lint'], { cwd: functionsDir, env, dryRun });

  if (dryRun) {
    console.log(
      `[dry-run] rewrite process.env.APP_ENV || 'dev' -> ('${plan.branch}' as string) ` +
        'in functions/src/index.ts and functions/src/config.ts'
    );
  } else {
    rewriteAppEnv(plan.branch, functionsDir);
  }

  runCmd('npm', ['run', 'build'], { cwd: functionsDir, env, dryRun });
  runCmd('npm', ['test'], { cwd: functionsDir, env, dryRun });

  runCmd('npm', ['ci'], { cwd: dashboardDir, env, dryRun });
  runCmd('npm', ['run', 'build', '--', '--mode', plan.branch], {
    cwd: dashboardDir,
    env,
    dryRun,
  });

  if (plan.cloudBuild) {
    if (dryRun) {
      console.log(
        '[dry-run] auth: Cloud Build ADC ' +
          '(sm-ci-builder@sai-shuddhi-moolam.iam.gserviceaccount.com), no key file'
      );
    }
    runCmd(plan.firebaseBin, plan.firebaseArgs, { cwd: root, env, dryRun });
  } else if (dryRun) {
    console.log(
      '[dry-run] auth: write FIREBASE_SERVICE_ACCOUNT_SAI_SHUDDHI_MOOLAM to ' +
        'temp key file under os.tmpdir() -> GOOGLE_APPLICATION_CREDENTIALS'
    );
    runCmd(plan.firebaseBin, plan.firebaseArgs, { cwd: root, env, dryRun });
  } else {
    await withTempKeyFile(
      deploySecret,
      (credEnv) => {
        runCmd(plan.firebaseBin, plan.firebaseArgs, {
          cwd: root,
          env: credEnv,
          dryRun: false,
        });
      },
      env
    );
  }

  return 0;
}

/**
 * Execute or dry-run the `sync-docs <branch>` pipeline.
 * @param {string} branch - Target branch (`dev`, `staging`, `main`, or `prod`).
 * @param {NodeJS.ProcessEnv} env - Environment variables.
 * @param {object} options - Execution options (`dryRun`, `root`).
 * @returns {Promise<number>} Exit code (`0` on success or skipped sync).
 */
export async function runSyncDocs(
  branch,
  env = process.env,
  { dryRun = false, root = ROOT } = {}
) {
  const plan = planSyncDocs(branch, env);
  const secret = String(env[plan.secretEnv] || '').trim();

  if (!secret && !dryRun) {
    if (inCloudBuild(env)) {
      console.error(
        `Missing required secret ${plan.secretEnv} on Cloud Build.`
      );
      return 1;
    }
    if (env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
      console.error(
        `Missing required secret ${plan.secretEnv} for workflow_dispatch.`
      );
      return 1;
    }
    console.log(`Missing ${plan.secretEnv} secret. Skipping docs sync.`);
    return 0;
  }

  runCmd('npm', ['install'], { cwd: root, env, dryRun });

  const syncArgs = [
    'run',
    'sync:docs',
    '--',
    `--env=${plan.env}`,
    `--project-id=${plan.projectId}`,
  ];

  if (dryRun) {
    console.log(
      `[dry-run] auth: write ${plan.secretEnv} to temp key file under ` +
        'os.tmpdir() -> GOOGLE_APPLICATION_CREDENTIALS'
    );
    runCmd('npm', syncArgs, { cwd: root, env, dryRun: true });
  } else {
    await withTempKeyFile(
      secret,
      (credEnv) => {
        runCmd('npm', syncArgs, { cwd: root, env: credEnv, dryRun: false });
      },
      env
    );
  }

  const dispatchToken = String(
    env.GH_TOKEN || env.DOCS_PORTAL_DISPATCH_TOKEN || ''
  ).trim();
  if (!dispatchToken) {
    console.log(
      `${dryRun ? '[dry-run] ' : ''}Skipping portal rebuild: ` +
        'GH_TOKEN / DOCS_PORTAL_DISPATCH_TOKEN not set.'
    );
    return 0;
  }

  if (dryRun) {
    console.log(
      `[dry-run] POST ${plan.dispatchUrl} ` +
        `${JSON.stringify(plan.dispatchPayload)}`
    );
    return 0;
  }

  await triggerPortalRebuild(plan.portalRef, dispatchToken);
  return 0;
}

/**
 * Parse CLI arguments and execute the requested CI pipeline.
 * @returns {Promise<void>} Exits the process with the resolved exit code.
 */
async function main() {
  try {
    const rawArgs = process.argv.slice(2);
    const dryRun = rawArgs.includes('--dry-run');
    const positional = rawArgs.filter((a) => !a.startsWith('--'));
    const [target, branch] = positional;

    if (target === 'deploy') {
      const code = await runDeploy(branch, process.env, { dryRun });
      process.exit(code);
    }
    if (target === 'sync-docs') {
      const code = await runSyncDocs(branch, process.env, { dryRun });
      process.exit(code);
    }

    console.error(
      'Usage: node scripts/ci/run.mjs <deploy|sync-docs> <branch> [--dry-run]'
    );
    process.exit(2);
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    const exitCode =
      err && typeof err === 'object' && typeof err.exitCode === 'number'
        ? err.exitCode
        : 1;
    process.exit(exitCode);
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  void main();
}
