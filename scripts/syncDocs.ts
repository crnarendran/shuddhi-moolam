/**
 * Syncs this repo's own documentation into the shared docs-portal's Firestore
 * `portal_docs`/`portal_docs_dev` collection, tagged `project:
 * 'shuddhi-moolam'`, so it appears in the portal under /shuddhi-moolam/...
 * alongside other projects' docs — without the portal itself ever needing to
 * know this repo exists or being redeployed when these docs change (a
 * redeploy is only needed the first time a brand-new page's route must be
 * generated; see knowledge/infrastructure.md).
 *
 * Run: npm run sync:docs -- --env=staging [--project-id=docs-portal-prod]
 * Requires GOOGLE_APPLICATION_CREDENTIALS pointing at a service account with
 * Firestore write access to the target docs-portal-* project.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import matter from 'gray-matter';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const repoRoot = path.join(__dirname, '..');

const PROJECT = 'shuddhi-moolam';

interface SourceDoc {
  slug: string;
  absPath: string;
  section: string;
  category: string;
}

// Everything this repo wants visible in the portal, explicitly listed rather
// than walked — this repo mixes docs with agent config/skill files that aren't
// meant to be portal content, so an allowlist of roots is safer than "sync
// every .md file we find."
const sources: SourceDoc[] = [];

if (fs.existsSync(path.join(repoRoot, 'README.md'))) {
  sources.push({ slug: 'readme', absPath: path.join(repoRoot, 'README.md'), section: 'User Guides', category: 'Onboarding' });
}
if (fs.existsSync(path.join(repoRoot, 'AGENTS.md'))) {
  sources.push({ slug: 'agents', absPath: path.join(repoRoot, 'AGENTS.md'), section: 'Development', category: 'Framework' });
}

const walkMd = (dir: string, section: string, category: string) => {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) continue;
    if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
    const baseName = file.replace(/\.mdx?$/, '');
    const relDir = path.relative(repoRoot, dir).replace(/\\/g, '/');
    sources.push({ slug: `${relDir}/${baseName}`, absPath: filepath, section, category });
  }
};

// Section/category here mirror sanjeev-ai's portal taxonomy (User Guides /
// Specs / Development / Support). These are per-root DEFAULTS; a file whose
// own frontmatter sets `section`/`category` overrides them (used where a
// folder splits across sections — e.g. docs/ holds both User Guides and a
// Support runbook; knowledge/ holds both an Operations map and a Spec).
walkMd(path.join(repoRoot, 'docs'), 'User Guides', 'Onboarding');
walkMd(path.join(repoRoot, 'knowledge'), 'Development', 'Operations');
walkMd(path.join(repoRoot, 'knowledge', 'adr'), 'Development', 'Architecture Decisions');
walkMd(path.join(repoRoot, 'planning', 'backlog'), 'Development', 'Planning');
walkMd(path.join(repoRoot, 'planning', 'archive'), 'Development', 'Changelog');

// .agents/skills/<name>/SKILL.md — slug drops the .agents/ prefix and the
// redundant /SKILL.md filename in favor of the skill's own directory name.
const skillsDir = path.join(repoRoot, '.agents', 'skills');
if (fs.existsSync(skillsDir)) {
  for (const skillName of fs.readdirSync(skillsDir)) {
    const skillPath = path.join(skillsDir, skillName, 'SKILL.md');
    if (fs.existsSync(skillPath)) {
      sources.push({ slug: `skills/${skillName}`, absPath: skillPath, section: 'Development', category: 'Framework' });
    }
  }
}

// Prefer frontmatter title; fall back to the first Markdown H1; fall back to
// the slug. Keeps the portal readable regardless of which files have titles.
const deriveTitle = (data: Record<string, unknown>, content: string, slug: string): string => {
  if (typeof data.title === 'string' && data.title) return data.title;
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  if (typeof data.name === 'string' && data.name) return data.name;
  return slug;
};

const syncDocs = async () => {
  const envArg = process.argv.find(arg => arg.startsWith('--env='));
  const targetEnv = envArg ? envArg.split('=')[1] : 'staging';
  const collectionName = targetEnv === 'dev' ? 'portal_docs_dev' : 'portal_docs';

  const projectIdArg = process.argv.find(arg => arg.startsWith('--project-id='));
  const firebaseProjectId = projectIdArg ? projectIdArg.split('=')[1] : 'docs-portal-staging';

  initializeApp({ projectId: firebaseProjectId });
  const db = getFirestore();

  console.log(`Syncing ${sources.length} Shuddhi-Moolam docs to ${firebaseProjectId}/${collectionName} (env=${targetEnv})...`);

  let count = 0;
  const syncedIds = new Set<string>();

  for (const source of sources) {
    const fileContents = fs.readFileSync(source.absPath, 'utf8');
    const { data, content } = matter(fileContents);

    const docId = `${PROJECT}_${source.slug.replace(/\//g, '_')}`;
    syncedIds.add(docId);
    
    const docRef = db.collection(collectionName).doc(docId);

    await docRef.set({
      slug: source.slug,
      project: PROJECT,
      meta: {
        title: deriveTitle(data, content, source.slug),
        section: String(data.section || source.section),
        category: String(data.category || source.category),
        requiresLogin: data.requiresLogin === true || data.requiresLogin === 'true',
        isInternal: data.isInternal === true || data.isInternal === 'true',
        ...data,
      },
      content,
      env: targetEnv,
      updatedAt: FieldValue.serverTimestamp(),
    });

    count++;
  }

  console.log(`Checking for stale documents to prune...`);
  const snapshot = await db.collection(collectionName).where('project', '==', PROJECT).get();
  let pruneCount = 0;
  const batch = db.batch();
  for (const doc of snapshot.docs) {
    if (!syncedIds.has(doc.id)) {
      batch.delete(doc.ref);
      pruneCount++;
      console.log(`Pruning stale doc: ${doc.id}`);
    }
  }
  
  if (pruneCount > 0) {
    await batch.commit();
    console.log(`Successfully pruned ${pruneCount} stale documents.`);
  }

  console.log(`Successfully synced ${count} Shuddhi-Moolam docs to '${collectionName}'.`);
};

syncDocs().catch(err => {
  console.error(err);
  process.exit(1);
});
