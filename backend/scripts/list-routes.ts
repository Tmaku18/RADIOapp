/**
 * Scan Nest controller sources and write a route inventory for auth-matrix e2e.
 *
 * Usage (from backend/):
 *   npx ts-node -r tsconfig-paths/register scripts/list-routes.ts
 */
import * as fs from 'fs';
import * as path from 'path';

export type RouteInventoryEntry = {
  method: string;
  path: string;
  controller: string;
  handler: string;
  public: boolean;
  roles: string[];
  file: string;
};

const SRC = path.resolve(__dirname, '..', 'src');
const OUT = path.resolve(__dirname, '..', 'test', 'route-inventory.json');

const HTTP_DECORATORS = ['Get', 'Post', 'Put', 'Patch', 'Delete', 'Options', 'Head', 'All'];

function walk(dir: string, acc: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (ent.name.endsWith('.controller.ts')) acc.push(full);
  }
  return acc;
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

function parseControllerPrefix(src: string): string {
  const m = src.match(/@Controller\(\s*(?:'([^']*)'|"([^"]*)")?\s*\)/);
  if (!m) return '';
  return (m[1] ?? m[2] ?? '').replace(/^\//, '').replace(/\/$/, '');
}

function joinPath(prefix: string, route: string): string {
  const p = prefix.replace(/^\//, '').replace(/\/$/, '');
  const r = (route || '').replace(/^\//, '');
  if (!p && !r) return '/api';
  if (!p) return `/api/${r}`;
  if (!r) return `/api/${p}`;
  return `/api/${p}/${r}`.replace(/\/+/g, '/');
}

function extractRoles(decoratorBlock: string): string[] {
  const m = decoratorBlock.match(/@Roles\(\s*([^)]*)\)/);
  if (!m) return [];
  return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
}

function classLevelMeta(chunk: string): { public: boolean; roles: string[] } {
  // Decorators immediately preceding `export class` / `class X`.
  const classMatch = chunk.match(
    /((?:@[A-Za-z][A-Za-z0-9_]*\([^)]*\)\s*)*)export\s+class\s+\w+/,
  );
  const block = classMatch?.[1] ?? '';
  return {
    public: /@Public\s*\(/.test(block),
    roles: extractRoles(block),
  };
}

function parseControllerChunk(
  chunk: string,
  filePath: string,
): RouteInventoryEntry[] {
  const rel = path.relative(SRC, filePath);
  const prefix = parseControllerPrefix(chunk);
  const classMeta = classLevelMeta(chunk);
  const entries: RouteInventoryEntry[] = [];
  const methodRe =
    /((?:@[A-Za-z][A-Za-z0-9_]*\([^)]*\)\s*)+)(async\s+)?([A-Za-z0-9_]+)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = methodRe.exec(chunk)) !== null) {
    const decoratorBlock = match[1];
    const handler = match[3];
    if (handler === 'constructor') continue;

    let httpMethod: string | null = null;
    let routePath = '';
    for (const verb of HTTP_DECORATORS) {
      const re = new RegExp(
        `@${verb}\\(\\s*(?:'([^']*)'|"([^"]*)")?\\s*\\)`,
      );
      const hm = decoratorBlock.match(re);
      if (hm) {
        httpMethod = verb.toUpperCase();
        routePath = hm[1] ?? hm[2] ?? '';
        break;
      }
    }
    if (!httpMethod) continue;

    const methodPublic = /@Public\s*\(/.test(decoratorBlock);
    const methodRoles = extractRoles(decoratorBlock);
    entries.push({
      method: httpMethod,
      path: joinPath(prefix, routePath),
      controller: path.basename(filePath, '.ts'),
      handler,
      public: methodPublic || classMeta.public,
      roles: methodRoles.length > 0 ? methodRoles : classMeta.roles,
      file: rel,
    });
  }
  return entries;
}

function parseFile(filePath: string): RouteInventoryEntry[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const src = stripComments(raw);
  const parts = src.split(/@Controller\(/);
  if (parts.length < 2) return [];
  const rebuilt: RouteInventoryEntry[] = [];
  for (let i = 1; i < parts.length; i++) {
    rebuilt.push(...parseControllerChunk(`@Controller(${parts[i]}`, filePath));
  }
  return rebuilt;
}

export function buildRouteInventory(): RouteInventoryEntry[] {
  const files = walk(SRC);
  const all = files.flatMap(parseFile);
  // Deduplicate method+path+handler
  const seen = new Set<string>();
  return all.filter((e) => {
    const key = `${e.method} ${e.path} ${e.handler}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function main() {
  const routes = buildRouteInventory().sort((a, b) =>
    `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`),
  );
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: routes.length,
        routes,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote ${routes.length} routes → ${path.relative(process.cwd(), OUT)}`);
}

if (require.main === module) {
  main();
}
