import { execFileSync } from 'node:child_process';

const prefixCache = new Map<string, string>();

/** Prefix of the project root relative to the git repository root, with a trailing slash. */
export function gitPrefix(root: string): string {
  const cached = prefixCache.get(root);
  if (cached !== undefined) return cached;
  try {
    const raw = execFileSync('git', ['rev-parse', '--show-prefix'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const prefix = raw ? `${raw.replace(/\/$/, '')}/` : '';
    prefixCache.set(root, prefix);
    return prefix;
  } catch {
    prefixCache.set(root, '');
    return '';
  }
}

/** Convert a project-relative path to a git-repository-relative path. */
export function repoPath(root: string, rel: string): string {
  return `${gitPrefix(root)}${rel.replace(/^\/+/, '')}`;
}

/** Convert a git-repository-relative path to a project-relative path when possible. */
export function projectPath(root: string, rel: string): string {
  const prefix = gitPrefix(root);
  const clean = rel.replace(/^\/+/, '');
  return prefix && clean.startsWith(prefix) ? clean.slice(prefix.length) : clean;
}

export function isGitRepo(root: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
