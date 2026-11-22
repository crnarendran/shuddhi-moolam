import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');
const DEPLOY_WF = path.join(WORKFLOWS_DIR, 'deploy.yml');
const SYNC_WF = path.join(WORKFLOWS_DIR, 'sync-docs.yml');
const COPY_WF = path.join(WORKFLOWS_DIR, 'copy-historical.yml');
const RUNNER_SCRIPT = path.join(ROOT, 'scripts', 'ci', 'run.mjs');
const CREATE_TRIGGERS = path.join(ROOT, 'scripts', 'ci', 'create-triggers.mjs');
const CLOUDBUILD_PATH = path.join(ROOT, 'cloudbuild.yaml');
const TRIGGERS_PATH = path.join(ROOT, 'infra', 'cloudbuild', 'triggers.yaml');

const EXPECTED_IF = "if: vars.CI_PROVIDER != 'cloudbuild'";
const EXPECTED_FUNCS = [
  'driveWebhook',
  'processPendingPdf',
  'helloWorld',
  'registerWatch',
  'renewWatch',
  'chatEndpoint',
  'priceReviewAlert',
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

interface CmdResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

interface ParsedTrigger {
  name: string;
  workflow?: string;
  filename?: string;
  disabled?: boolean;
  repositoryEventConfig?: {
    push?: { branch?: string };
    pullRequest?: { branch?: string; commentControl?: string };
  };
  includedFiles?: string[];
  substitutions?: Record<string, string>;
}

interface RunnerCall {
  args: string[];
  importedDisabled?: boolean;
}

interface ApplyStubReport {
  missingCalls: RunnerCall[];
  existingCalls: RunnerCall[];
  missingLogs: string[];
  existingLogs: string[];
  prArgs: string[];
}

interface TempKeyReport {
  okResult: string;
  okPath: string;
  okExistedDuring: boolean;
  okExistedAfter: boolean;
  okMode: number;
  okBaseEnv: string | undefined;
  okGacMatches: boolean;
  rejError: string;
  rejExistedDuring: boolean;
  rejExistedAfter: boolean;
  cmdExitCode: number | null;
  cmdExistedDuring: boolean;
  cmdExistedAfter: boolean;
  spawnErrCode: number | null;
  spawnErrMsg: string;
}

interface RewriteReport {
  indexNext: string;
  configNext: string;
  missingConfigErr: string;
  missingIndexErr: string;
}

interface DispatchReport {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: {
    event_type: string;
    client_payload: {
      project: string;
      ref: string;
    };
  };
  errMsg: string;
  errExitCode: number | null;
}

/**
 * Executes `scripts/ci/run.mjs` with the given arguments and environment.
 * @param {string[]} args - CLI arguments to pass to `run.mjs`.
 * @param {Record<string, string>} extraEnv - Environment overrides.
 * @returns {CmdResult} Process exit status, stdout, and stderr.
 */
function runRunner(
  args: string[],
  extraEnv: Record<string, string> = {}
): CmdResult {
  const res = spawnSync(process.execPath, [RUNNER_SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
  return {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
  };
}

/**
 * Executes `scripts/ci/run.mjs` in `--dry-run` mode.
 * @param {string[]} args - CLI arguments prior to `--dry-run`.
 * @param {Record<string, string>} extraEnv - Environment overrides.
 * @returns {CmdResult} Process exit status, stdout, and stderr.
 */
function runDry(
  args: string[],
  extraEnv: Record<string, string> = {}
): CmdResult {
  return runRunner([...args, '--dry-run'], extraEnv);
}

/**
 * Executes an inline ES module snippet under Node to test `.mjs` exports.
 * @param {string} code - ES module source code to evaluate.
 * @returns {CmdResult} Process exit status, stdout, and stderr.
 */
function runEsmEval(code: string): CmdResult {
  const res = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', code],
    {
      cwd: ROOT,
      encoding: 'utf8',
    }
  );
  return {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
  };
}

/**
 * Extracts `on.push.paths` list items from `.github/workflows/sync-docs.yml`.
 * @param {string} raw - Raw YAML text of `sync-docs.yml`.
 * @returns {string[]} Path filter strings configured for push triggers.
 */
function extractSyncDocsPaths(raw: string): string[] {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  let inPaths = false;
  let pathsIndent = -1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = line.search(/\S/);
    if (trimmed === 'paths:') {
      inPaths = true;
      pathsIndent = indent;
      continue;
    }
    if (inPaths) {
      if (indent <= pathsIndent && !trimmed.startsWith('-')) {
        inPaths = false;
        continue;
      }
      const match = trimmed.match(/^-\s+['"]?([^'"]+)['"]?$/);
      if (match && match[1]) {
        out.push(match[1]);
      }
    }
  }
  return out;
}

describe('SM-68 Cloud Build fallback CI and neutral wrappers', () => {
  test('GitHub workflow wrappers gate on CI_PROVIDER and delegate', () => {
    const deployRaw = fs.readFileSync(DEPLOY_WF, 'utf8');
    expect(deployRaw).toContain('name: Deploy Cloud Functions');
    expect(deployRaw).toContain(EXPECTED_IF);
    expect(deployRaw).toContain('node scripts/ci/run.mjs deploy');
    expect(deployRaw).toContain(
      'FIREBASE_SERVICE_ACCOUNT_SAI_SHUDDHI_MOOLAM'
    );

    const syncRaw = fs.readFileSync(SYNC_WF, 'utf8');
    expect(syncRaw).toContain(EXPECTED_IF);
    expect(syncRaw).toContain('node scripts/ci/run.mjs sync-docs');
    expect(syncRaw).toContain('DOCS_TARGET');
    expect(syncRaw).toContain('FIREBASE_SERVICE_ACCOUNT_DOCS_PORTAL_STAGING');
    expect(syncRaw).toContain('FIREBASE_SERVICE_ACCOUNT_DOCS_PORTAL_PROD');
    expect(syncRaw).toContain('GITHUB_EVENT_NAME');
    expect(syncRaw).toContain('DOCS_PORTAL_DISPATCH_TOKEN');

    const copyRaw = fs.readFileSync(COPY_WF, 'utf8');
    expect(copyRaw).not.toContain('CI_PROVIDER');
    expect(copyRaw).toContain('copyHistorical.mjs');
  });

  test('triggers.yaml defines 4 disabled triggers with workflow parity', () => {
    expect(fs.existsSync(TRIGGERS_PATH)).toBe(true);
    const modUrl = new URL(
      `file:///${CREATE_TRIGGERS.replace(/\\/g, '/')}`
    ).href;
    const trigPathJson = JSON.stringify(TRIGGERS_PATH);
    const res = runEsmEval(
      [
        `import { loadTriggersYaml } from ${JSON.stringify(modUrl)};`,
        `const triggers = loadTriggersYaml(${trigPathJson});`,
        'console.log(JSON.stringify(triggers));',
      ].join('\n')
    );
    expect(res.status).toBe(0);
    const triggers = JSON.parse(res.stdout) as ParsedTrigger[];
    expect(triggers).toHaveLength(4);

    const byName = new Map<string, ParsedTrigger>(
      triggers.map((t) => [t.name, t])
    );

    expect([...byName.keys()]).toEqual([
      'shuddhi-moolam-deploy-dev',
      'shuddhi-moolam-deploy-staging',
      'shuddhi-moolam-deploy-prod',
      'shuddhi-moolam-sync-docs',
    ]);

    for (const trig of triggers) {
      expect(trig.disabled).toBe(true);
      expect(trig.filename).toBe('cloudbuild.yaml');
    }

    const deployDev = byName.get('shuddhi-moolam-deploy-dev');
    expect(deployDev?.repositoryEventConfig?.push?.branch).toBe('^dev$');
    expect(deployDev?.substitutions).toEqual({
      _TARGET: 'deploy',
      _BRANCH: 'dev',
    });

    const deployStg = byName.get('shuddhi-moolam-deploy-staging');
    expect(deployStg?.repositoryEventConfig?.push?.branch).toBe('^staging$');
    expect(deployStg?.substitutions).toEqual({
      _TARGET: 'deploy',
      _BRANCH: 'staging',
    });

    const deployProd = byName.get('shuddhi-moolam-deploy-prod');
    expect(deployProd?.repositoryEventConfig?.push?.branch).toBe('^main$');
    expect(deployProd?.substitutions).toEqual({
      _TARGET: 'deploy',
      _BRANCH: 'main',
    });

    const syncTrig = byName.get('shuddhi-moolam-sync-docs');
    expect(syncTrig?.repositoryEventConfig?.push?.branch).toBe(
      '^(dev|staging)$'
    );
    expect(syncTrig?.substitutions).toEqual({ _TARGET: 'sync-docs' });

    const wfPaths = extractSyncDocsPaths(fs.readFileSync(SYNC_WF, 'utf8'));
    expect(wfPaths.length).toBeGreaterThanOrEqual(8);
    const included = syncTrig?.includedFiles || [];
    for (const p of wfPaths) {
      expect(included).toContain(p);
    }
    expect(included).toContain('scripts/ci/**');
    expect(included).toContain('cloudbuild.yaml');
  });

  test('cloudbuild.yaml configures shared image, logging, secrets, run', () => {
    expect(fs.existsSync(CLOUDBUILD_PATH)).toBe(true);
    const cb = fs.readFileSync(CLOUDBUILD_PATH, 'utf8');

    expect(cb).toContain(
      'europe-west6-docker.pkg.dev/swarm-ops/ci/swarm-ci:latest'
    );
    expect(cb).toContain('logging: CLOUD_LOGGING_ONLY');
    expect(cb).toContain('CI_PROVIDER=cloudbuild');
    expect(cb).toContain('timeout: 1800s');
    expect(cb).toContain('FIREBASE_SERVICE_ACCOUNT_DOCS_PORTAL_STAGING');
    expect(cb).toContain('node scripts/ci/run.mjs deploy');
    expect(cb).toContain('node scripts/ci/run.mjs sync-docs');

    // Pitfall guards: separate -euo and pipefail items; no unescaped ${X:-Y}.
    expect(cb).not.toMatch(/^\s*- -\w*o \w+\s*$/m);
    expect(cb).toMatch(/^\s*- -euo\s*$\r?\n^\s*- pipefail\s*$/m);
    expect(cb).not.toMatch(/\$\{[A-Za-z0-9_]+:-/);
  });

  test('run.mjs --dry-run plans deploy for dev, staging, and main', () => {
    expect(fs.existsSync(RUNNER_SCRIPT)).toBe(true);

    const cases: Array<{
      branch: string;
      suffix: string;
      hosting: string;
    }> = [
      {
        branch: 'dev',
        suffix: '_dev',
        hosting: 'hosting:sai-shuddhi-moolam-dev',
      },
      {
        branch: 'staging',
        suffix: '_staging',
        hosting: 'hosting:sai-shuddhi-moolam-staging',
      },
      { branch: 'main', suffix: '', hosting: 'hosting:sai-shuddhi-moolam' },
    ];

    for (const c of cases) {
      const gh = runDry(['deploy', c.branch], {
        CI_PROVIDER: '',
        BUILD_ID: '',
        FIREBASE_SERVICE_ACCOUNT_SAI_SHUDDHI_MOOLAM: 'dummy-sa',
      });
      expect(gh.status).toBe(0);
      expect(gh.stdout).toContain('npm install');
      expect(gh.stdout).toContain('npm run lint');
      expect(gh.stdout).toContain(`('${c.branch}' as string)`);
      expect(gh.stdout).toContain('npm run build');
      expect(gh.stdout).toContain('npm test');
      expect(gh.stdout).toContain('npm ci');
      expect(gh.stdout).toContain(`npm run build -- --mode ${c.branch}`);
      expect(gh.stdout).toContain('npx firebase-tools deploy --only ');
      expect(gh.stdout).toContain(`--project sai-shuddhi-moolam --force`);
      expect(gh.stdout).toContain(`,firestore,${c.hosting}`);
      expect(gh.stdout.toLowerCase()).toContain('temp');

      for (const fnName of EXPECTED_FUNCS) {
        expect(gh.stdout).toContain(`functions:${fnName}${c.suffix}`);
      }

      const cb = runDry(['deploy', c.branch], {
        CI_PROVIDER: 'cloudbuild',
        BUILD_ID: 'cb-123',
        FIREBASE_SERVICE_ACCOUNT_SAI_SHUDDHI_MOOLAM: '',
      });
      expect(cb.status).toBe(0);
      expect(cb.stdout).toContain('ADC');
      expect(cb.stdout).not.toContain('npx firebase-tools');
      expect(cb.stdout).toContain('firebase deploy --only ');
      expect(cb.stdout).toContain(`,firestore,${c.hosting}`);
    }

    const bad = runDry(['deploy', 'prod']);
    expect(bad.status).not.toBe(0);
  });

  test('run.mjs skips GitHub deploy when deploy secret is absent', () => {
    const res = runRunner(['deploy', 'dev'], {
      CI_PROVIDER: '',
      BUILD_ID: '',
      FIREBASE_SERVICE_ACCOUNT_SAI_SHUDDHI_MOOLAM: '',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      'Missing FIREBASE_SERVICE_ACCOUNT_SAI_SHUDDHI_MOOLAM secret.' +
        ' Skipping deployment.'
    );
  });

  test('run.mjs --dry-run plans sync-docs for dev, staging, and prod', () => {
    const dispatchUrl =
      'https://api.github.com/repos/crnarendran/docs-portal/dispatches';
    const tok1 = 'gh_tok_secret_1';
    const tok2 = 'gh_tok_secret_2';
    const tok3 = 'gh_tok_secret_3';

    const devRes = runDry(['sync-docs', 'dev'], {
      DOCS_TARGET: '',
      GH_TOKEN: tok1,
    });
    expect(devRes.status).toBe(0);
    expect(devRes.stdout).toContain('npm install');
    expect(devRes.stdout).toContain(
      'npm run sync:docs -- --env=dev --project-id=docs-portal-staging'
    );
    expect(devRes.stdout).toContain(
      'FIREBASE_SERVICE_ACCOUNT_DOCS_PORTAL_STAGING'
    );
    expect(devRes.stdout).toContain(dispatchUrl);
    expect(devRes.stdout).toContain('"project":"shuddhi-moolam"');
    expect(devRes.stdout).toContain('"ref":"dev"');
    expect(devRes.stdout).not.toContain('gh api');
    expect(devRes.stdout).not.toContain(tok1);

    const stgRes = runDry(['sync-docs', 'staging'], {
      DOCS_TARGET: '',
      DOCS_PORTAL_DISPATCH_TOKEN: tok2,
      GH_TOKEN: '',
    });
    expect(stgRes.status).toBe(0);
    expect(stgRes.stdout).toContain(
      'npm run sync:docs -- --env=staging --project-id=docs-portal-staging'
    );
    expect(stgRes.stdout).toContain('"ref":"staging"');
    expect(stgRes.stdout).not.toContain(tok2);

    const prodRes = runDry(['sync-docs', 'prod'], {
      DOCS_TARGET: '',
      GH_TOKEN: tok3,
    });
    expect(prodRes.status).toBe(0);
    expect(prodRes.stdout).toContain(
      'npm run sync:docs -- --env=staging --project-id=docs-portal-prod'
    );
    expect(prodRes.stdout).toContain(
      'FIREBASE_SERVICE_ACCOUNT_DOCS_PORTAL_PROD'
    );
    expect(prodRes.stdout).toContain('"ref":"main"');
    expect(prodRes.stdout).not.toContain(tok3);

    const targetProd = runDry(['sync-docs', 'staging'], {
      DOCS_TARGET: 'prod',
      GH_TOKEN: '',
      DOCS_PORTAL_DISPATCH_TOKEN: '',
    });
    expect(targetProd.status).toBe(0);
    expect(targetProd.stdout).toContain('--project-id=docs-portal-prod');
    expect(targetProd.stdout).toContain('Skipping portal rebuild');
  });

  test('run.mjs sync-docs missing-secret handling respects provider', () => {
    const sentinel = 'DO_NOT_LEAK_TOKEN_8812';
    const cbMissing = runRunner(['sync-docs', 'staging'], {
      CI_PROVIDER: 'cloudbuild',
      BUILD_ID: 'cb-99',
      FIREBASE_SERVICE_ACCOUNT_DOCS_PORTAL_STAGING: '',
      GH_TOKEN: sentinel,
    });
    expect(cbMissing.status).toBe(1);
    expect(cbMissing.stderr).toContain(
      'FIREBASE_SERVICE_ACCOUNT_DOCS_PORTAL_STAGING'
    );
    expect(cbMissing.stdout + cbMissing.stderr).not.toContain(sentinel);

    const ghPushMissing = runRunner(['sync-docs', 'dev'], {
      CI_PROVIDER: '',
      BUILD_ID: '',
      GITHUB_EVENT_NAME: 'push',
      FIREBASE_SERVICE_ACCOUNT_DOCS_PORTAL_STAGING: '',
    });
    expect(ghPushMissing.status).toBe(0);
    expect(ghPushMissing.stdout).toContain('Skipping');

    const ghManualMissing = runRunner(['sync-docs', 'dev'], {
      CI_PROVIDER: '',
      BUILD_ID: '',
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      FIREBASE_SERVICE_ACCOUNT_DOCS_PORTAL_STAGING: '',
    });
    expect(ghManualMissing.status).toBe(1);
    expect(ghManualMissing.stderr).toContain(
      'FIREBASE_SERVICE_ACCOUNT_DOCS_PORTAL_STAGING'
    );
  });

  test('create-triggers.mjs dry-run and applyTriggerPlan behavior', () => {
    expect(fs.existsSync(CREATE_TRIGGERS)).toBe(true);
    const dry = spawnSync(process.execPath, [CREATE_TRIGGERS], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(dry.status).toBe(0);
    expect(dry.stdout).toContain('sai-shuddhi-moolam');
    expect(dry.stdout).toContain('europe-west6');
    expect(dry.stdout).toContain('crnarendran-shuddhi-moolam');
    expect(dry.stdout).toContain(
      'sm-ci-builder@sai-shuddhi-moolam.iam.gserviceaccount.com'
    );
    expect(dry.stdout).toContain('shuddhi-moolam-deploy-dev');
    expect(dry.stdout).toContain('shuddhi-moolam-deploy-staging');
    expect(dry.stdout).toContain('shuddhi-moolam-deploy-prod');
    expect(dry.stdout).toContain('shuddhi-moolam-sync-docs');

    const modUrl = new URL(
      `file:///${CREATE_TRIGGERS.replace(/\\/g, '/')}`
    ).href;
    const evalCode = [
      "import fs from 'node:fs';",
      `import { applyTriggerPlan, buildTriggerPlan, parseCliArgs } from ` +
        `${JSON.stringify(modUrl)};`,
      'const opts = parseCliArgs([]);',
      'const trig = [{',
      "  name: 'sm-test-trig',",
      "  filename: 'cloudbuild.yaml',",
      '  disabled: true,',
      "  repositoryEventConfig: { push: { branch: '^dev$' } },",
      "  substitutions: { _TARGET: 'deploy', _BRANCH: 'dev' }",
      '}];',
      'const plan = buildTriggerPlan(trig, opts);',
      'const missingCalls = [];',
      'const missingLogs = [];',
      'let describeCount = 0;',
      'applyTriggerPlan(plan, opts, (args) => {',
      '  const call = { args };',
      "  if (args[2] === 'describe') {",
      '    describeCount += 1;',
      '    missingCalls.push(call);',
      '    if (describeCount === 1) {',
      '      return { status: 1, stdout: "", stderr: "" };',
      '    }',
      '    return {',
      '      status: 0,',
      '      stdout: JSON.stringify({',
      '        name: "sm-test-trig",',
      '        disabled: false,',
      '      }),',
      '      stderr: ""',
      '    };',
      '  }',
      "  if (args[2] === 'import') {",
      '    const src = args.find((a) => a.startsWith("--source="));',
      '    const file = src ? src.slice("--source=".length) : "";',
      '    const payload = JSON.parse(fs.readFileSync(file, "utf8"));',
      '    call.importedDisabled = payload.disabled;',
      '  }',
      '  missingCalls.push(call);',
      '  return { status: 0, stdout: "", stderr: "" };',
      '}, (m) => missingLogs.push(m));',
      'const existingCalls = [];',
      'const existingLogs = [];',
      'applyTriggerPlan(plan, opts, (args) => {',
      '  existingCalls.push({ args });',
      '  return { status: 0, stdout: "{}", stderr: "" };',
      '}, (m) => existingLogs.push(m));',
      'const prPlan = buildTriggerPlan([{',
      "  name: 'sm-pr-test',",
      '  disabled: true,',
      "  repositoryEventConfig: { pullRequest: { branch: '^main$' } }",
      '}], opts);',
      'console.log(JSON.stringify({',
      '  missingCalls,',
      '  existingCalls,',
      '  missingLogs,',
      '  existingLogs,',
      '  prArgs: prPlan[0].createArgs',
      '}));',
    ].join('\n');

    const evalRes = runEsmEval(evalCode);
    expect(evalRes.status).toBe(0);
    const report = JSON.parse(evalRes.stdout) as ApplyStubReport;

    expect(report.existingCalls).toHaveLength(1);
    expect(report.existingCalls[0].args[2]).toBe('describe');
    expect(report.existingLogs[0]).toContain('already exists');

    expect(report.missingCalls).toHaveLength(4);
    expect(report.missingCalls[0].args[2]).toBe('describe');
    expect(report.missingCalls[1].args[2]).toBe('create');
    expect(report.missingCalls[2].args[2]).toBe('describe');
    expect(report.missingCalls[3].args[2]).toBe('import');
    expect(report.missingCalls[3].importedDisabled).toBe(true);

    expect(report.prArgs).toContain(
      '--comment-control=COMMENTS_ENABLED_FOR_EXTERNAL_CONTRIBUTORS_ONLY'
    );
    expect(os.tmpdir().length).toBeGreaterThan(0);
  });

  test(
    'withTempKeyFile creates 0600 sa.json and cleans up on return and error',
    () => {
      const modUrl = new URL(
        `file:///${RUNNER_SCRIPT.replace(/\\/g, '/')}`
      ).href;
      const evalCode = [
        "import fs from 'node:fs';",
        "import os from 'node:os';",
        "import path from 'node:path';",
        `import { runCmd, withTempKeyFile } from ${JSON.stringify(modUrl)};`,
        'const secret = JSON.stringify({ type: "service_account" });',
        'let okPath = "";',
        'let okExistedDuring = false;',
        'let okMode = 0;',
        'let okBaseEnv;',
        'let okGacMatches = false;',
        'const okResult = await withTempKeyFile(',
        '  secret,',
        '  async (credEnv) => {',
        '    okPath = credEnv.GOOGLE_APPLICATION_CREDENTIALS;',
        '    okExistedDuring = fs.existsSync(okPath);',
        '    okMode = fs.statSync(okPath).mode & 0o777;',
        '    okBaseEnv = credEnv.SM_BASE_ENV;',
        '    const tmpRoot = path.resolve(os.tmpdir());',
        '    okGacMatches = path.basename(okPath) === "sa.json" &&',
        '      path.dirname(path.dirname(okPath)) === tmpRoot;',
        '    await Promise.resolve();',
        '    return "ok-value";',
        '  },',
        '  { SM_BASE_ENV: "keep" }',
        ');',
        'const okExistedAfter = fs.existsSync(path.dirname(okPath));',
        'let rejPath = "";',
        'let rejExistedDuring = false;',
        'let rejError = "";',
        'try {',
        '  await withTempKeyFile(secret, async (credEnv) => {',
        '    rejPath = credEnv.GOOGLE_APPLICATION_CREDENTIALS;',
        '    rejExistedDuring = fs.existsSync(rejPath);',
        '    await Promise.resolve();',
        '    throw new Error("async rejection");',
        '  });',
        '} catch (err) {',
        '  rejError = err instanceof Error ? err.message : String(err);',
        '}',
        'const rejExistedAfter = fs.existsSync(path.dirname(rejPath));',
        'let cmdPath = "";',
        'let cmdExistedDuring = false;',
        'let cmdExitCode = null;',
        'try {',
        '  await withTempKeyFile(secret, (credEnv) => {',
        '    cmdPath = credEnv.GOOGLE_APPLICATION_CREDENTIALS;',
        '    cmdExistedDuring = fs.existsSync(cmdPath);',
        '    runCmd(process.execPath, ["-e", "process.exit(3)"], {',
        '      dryRun: false,',
        '    });',
        '  });',
        '} catch (err) {',
        '  cmdExitCode = err && typeof err.exitCode === "number"',
        '    ? err.exitCode',
        '    : null;',
        '}',
        'const cmdExistedAfter = fs.existsSync(path.dirname(cmdPath));',
        'let spawnErrCode = null;',
        'let spawnErrMsg = "";',
        'try {',
        '  runCmd("sm_nonexistent_binary_9911", [], { dryRun: false });',
        '} catch (err) {',
        '  spawnErrMsg = err instanceof Error ? err.message : String(err);',
        '  spawnErrCode = err && typeof err.exitCode === "number"',
        '    ? err.exitCode',
        '    : null;',
        '}',
        'console.log("__REPORT__" + JSON.stringify({',
        '  okResult,',
        '  okPath,',
        '  okExistedDuring,',
        '  okExistedAfter,',
        '  okMode,',
        '  okBaseEnv,',
        '  okGacMatches,',
        '  rejError,',
        '  rejExistedDuring,',
        '  rejExistedAfter,',
        '  cmdExitCode,',
        '  cmdExistedDuring,',
        '  cmdExistedAfter,',
        '  spawnErrCode,',
        '  spawnErrMsg,',
        '}));',
      ].join('\n');

      const res = runEsmEval(evalCode);
      expect(res.status).toBe(0);
      const line = res.stdout
        .split(/\r?\n/)
        .find((l) => l.startsWith('__REPORT__'));
      expect(line).toBeDefined();
      const report = JSON.parse(
        (line || '').slice('__REPORT__'.length)
      ) as TempKeyReport;

      expect(report.okResult).toBe('ok-value');
      expect(report.okExistedDuring).toBe(true);
      expect(report.okExistedAfter).toBe(false);
      expect(report.okBaseEnv).toBe('keep');
      expect(report.okGacMatches).toBe(true);
      if (process.platform !== 'win32') {
        expect(report.okMode).toBe(0o600);
      }

      expect(report.rejError).toBe('async rejection');
      expect(report.rejExistedDuring).toBe(true);
      expect(report.rejExistedAfter).toBe(false);

      expect(report.cmdExitCode).toBe(3);
      expect(report.cmdExistedDuring).toBe(true);
      expect(report.cmdExistedAfter).toBe(false);

      expect(report.spawnErrCode).toBe(1);
      expect(report.spawnErrMsg).toContain('Failed to start');
    }
  );

  test(
    'rewriteAppEnv updates fixtures and throws when APP_ENV is absent',
    () => {
      const modUrl = new URL(
        `file:///${RUNNER_SCRIPT.replace(/\\/g, '/')}`
      ).href;
      const evalCode = [
        "import fs from 'node:fs';",
        "import os from 'node:os';",
        "import path from 'node:path';",
        `import { rewriteAppEnv } from ${JSON.stringify(modUrl)};`,
        'const tmpFuncs = fs.mkdtempSync(',
        '  path.join(os.tmpdir(), "sm-ci-rw-")',
        ');',
        'const srcDir = path.join(tmpFuncs, "src");',
        'fs.mkdirSync(srcDir, { recursive: true });',
        'const indexFile = path.join(srcDir, "index.ts");',
        'const configFile = path.join(srcDir, "config.ts");',
        'const valid = "const e = process.env.APP_ENV || \'dev\';\\n";',
        'const fixed = "const e = \'hardcoded\';\\n";',
        'try {',
        '  fs.writeFileSync(indexFile, valid, "utf8");',
        '  fs.writeFileSync(configFile, valid, "utf8");',
        '  rewriteAppEnv("staging", tmpFuncs);',
        '  const indexNext = fs.readFileSync(indexFile, "utf8");',
        '  const configNext = fs.readFileSync(configFile, "utf8");',
        '  fs.writeFileSync(indexFile, valid, "utf8");',
        '  fs.writeFileSync(configFile, fixed, "utf8");',
        '  let missingConfigErr = "";',
        '  try {',
        '    rewriteAppEnv("main", tmpFuncs);',
        '  } catch (err) {',
        '    missingConfigErr = err instanceof Error',
        '      ? err.message',
        '      : String(err);',
        '  }',
        '  fs.writeFileSync(indexFile, fixed, "utf8");',
        '  fs.writeFileSync(configFile, valid, "utf8");',
        '  let missingIndexErr = "";',
        '  try {',
        '    rewriteAppEnv("main", tmpFuncs);',
        '  } catch (err) {',
        '    missingIndexErr = err instanceof Error',
        '      ? err.message',
        '      : String(err);',
        '  }',
        '  console.log(JSON.stringify({',
        '    indexNext,',
        '    configNext,',
        '    missingConfigErr,',
        '    missingIndexErr,',
        '  }));',
        '} finally {',
        '  fs.rmSync(tmpFuncs, { recursive: true, force: true });',
        '}',
      ].join('\n');

      const res = runEsmEval(evalCode);
      expect(res.status).toBe(0);
      const report = JSON.parse(res.stdout) as RewriteReport;

      expect(report.indexNext).toContain("('staging' as string)");
      expect(report.indexNext).not.toContain("process.env.APP_ENV || 'dev'");
      expect(report.configNext).toContain("('staging' as string)");
      expect(report.configNext).not.toContain("process.env.APP_ENV || 'dev'");
      expect(report.missingConfigErr).toContain('config.ts');
      expect(report.missingIndexErr).toContain('index.ts');
    }
  );

  test(
    'triggerPortalRebuild posts dispatch and omits token on error',
    () => {
      const modUrl = new URL(
        `file:///${RUNNER_SCRIPT.replace(/\\/g, '/')}`
      ).href;
      const evalCode = [
        `import { triggerPortalRebuild } from ${JSON.stringify(modUrl)};`,
        'let capturedUrl = "";',
        'let capturedInit = null;',
        'const okFetch = async (url, init) => {',
        '  capturedUrl = url;',
        '  capturedInit = init;',
        '  return { ok: true, status: 204 };',
        '};',
        'await triggerPortalRebuild("staging", "tok-valid-123", okFetch);',
        'const secret = "TOP_SECRET_TOKEN_991";',
        'let errMsg = "";',
        'let errExitCode = null;',
        'const errFetch = async () => ({ ok: false, status: 401 });',
        'try {',
        '  await triggerPortalRebuild("main", secret, errFetch);',
        '} catch (err) {',
        '  errMsg = err instanceof Error ? err.message : String(err);',
        '  errExitCode = err && typeof err.exitCode === "number"',
        '    ? err.exitCode',
        '    : null;',
        '}',
        'console.log(JSON.stringify({',
        '  url: capturedUrl,',
        '  method: capturedInit.method,',
        '  headers: capturedInit.headers,',
        '  body: JSON.parse(capturedInit.body),',
        '  errMsg,',
        '  errExitCode,',
        '}));',
      ].join('\n');

      const res = runEsmEval(evalCode);
      expect(res.status).toBe(0);
      const report = JSON.parse(res.stdout) as DispatchReport;

      expect(report.url).toBe(
        'https://api.github.com/repos/crnarendran/docs-portal/dispatches'
      );
      expect(report.method).toBe('POST');
      expect(report.headers).toEqual({
        Authorization: 'Bearer tok-valid-123',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'shuddhi-moolam-ci',
      });
      expect(report.body).toEqual({
        event_type: 'docs-updated',
        client_payload: {
          project: 'shuddhi-moolam',
          ref: 'staging',
        },
      });
      expect(report.errExitCode).toBe(1);
      expect(report.errMsg).toContain('401');
      expect(report.errMsg).not.toContain('TOP_SECRET_TOKEN_991');
    }
  );
});
