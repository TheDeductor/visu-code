import path from 'node:path';
import { spawn } from 'node:child_process';
import { findProjectRoot } from '../core/paths.js';

export const EXIT_OK = 0;
export const EXIT_VALIDATION = 1;
export const EXIT_USAGE = 2;
export const EXIT_ENV = 3;
export const EXIT_STRICT_WARNINGS = 4;

export class CliError extends Error {
  readonly exitCode: number;
  readonly hint?: string;

  constructor(message: string, exitCode = EXIT_VALIDATION, hint?: string) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
    this.hint = hint;
  }
}

const colorEnabled = (): boolean => Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && process.env.TERM !== 'dumb';

function wrap(code: string, text: string): string {
  return colorEnabled() ? `\u001b[${code}m${text}\u001b[0m` : text;
}

export const ui = {
  bold: (text: string): string => wrap('1', text),
  dim: (text: string): string => wrap('2', text),
  red: (text: string): string => wrap('31', text),
  green: (text: string): string => wrap('32', text),
  yellow: (text: string): string => wrap('33', text),
  blue: (text: string): string => wrap('34', text),
  cyan: (text: string): string => wrap('36', text),
};

export function out(text = ''): void {
  process.stdout.write(`${text}\n`);
}

export function err(text: string): void {
  process.stderr.write(`${text}\n`);
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function projectRoot(explicit?: string): string {
  if (explicit) {
    const abs = path.resolve(explicit);
    return abs;
  }
  const found = findProjectRoot(process.cwd());
  if (found) return found;
  throw new CliError('No .vibemap/ folder found here or in any parent directory.', EXIT_ENV, 'Run `vibemap init` or pass --root <project>.');
}

export function requireRoot(explicit?: string): string {
  const root = projectRoot(explicit);
  return root;
}

export function openBrowser(url: string): void {
  try {
    if (process.platform === 'win32') {
      const child = spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' });
      child.unref();
    } else if (process.platform === 'darwin') {
      const child = spawn('open', [url], { detached: true, stdio: 'ignore' });
      child.unref();
    } else {
      const child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
      child.unref();
    }
  } catch {
    // Opening a browser is best-effort; the URL is printed anyway.
  }
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function relativePath(root: string, abs: string): string {
  return path.relative(root, abs).replace(/\\/g, '/');
}

export function handleCliError(error: unknown): number {
  if (error instanceof CliError) {
    err(ui.red(`✖ ${error.message}`));
    if (error.hint) err(ui.dim(`  ${error.hint}`));
    return error.exitCode;
  }
  const anyError = error as { name?: string; message?: string; issues?: string[] };
  if (anyError?.name === 'OpsError') {
    err(ui.red(`✖ ${anyError.message}`));
    for (const issue of anyError.issues ?? []) err(ui.dim(`  ${issue}`));
    return EXIT_VALIDATION;
  }
  if (anyError?.name === 'MapValidationError') {
    err(ui.red(`✖ ${anyError.message}`));
    for (const issue of anyError.issues ?? []) err(ui.dim(`  ${JSON.stringify(issue)}`));
    return EXIT_VALIDATION;
  }
  if (anyError?.name === 'ProjectError') {
    err(ui.red(`✖ ${anyError.message}`));
    return EXIT_ENV;
  }
  if (anyError?.name === 'RevisionConflictError') {
    err(ui.red('✖ The map changed since it was loaded. Re-run the command with the latest content.'));
    return EXIT_VALIDATION;
  }
  err(ui.red(`✖ ${anyError?.message ?? String(error)}`));
  if (process.env.VIBEMAP_DEBUG) err(String((error as Error)?.stack ?? ''));
  return EXIT_VALIDATION;
}
