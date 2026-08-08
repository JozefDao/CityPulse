import { randomBytes } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));

export const rootDir = resolve(scriptsDir, '..');
export const backendDir = join(rootDir, 'apps', 'backend');
export const backendEnvPath = join(backendDir, '.env');
const backendEnvExamplePath = join(backendDir, '.env.example');

const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function parseEnv(content) {
  const values = {};

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function createSecret() {
  return randomBytes(48).toString('hex');
}

function setEnvValue(content, key, value) {
  const assignment = new RegExp(
    `^(\\s*(?:export\\s+)?${key}\\s*=).*?$`,
    'm',
  );

  if (assignment.test(content)) {
    return content.replace(assignment, `$1${value}`);
  }

  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const suffix = content.endsWith('\n') || content.endsWith('\r') ? '' : newline;
  return `${content}${suffix}${key}=${value}${newline}`;
}

function setEnvValueIfMissingOrBlank(content, key, value) {
  const values = parseEnv(content);
  return values[key]?.trim() ? content : setEnvValue(content, key, value);
}

function getRequestedPort() {
  const port = process.env.CITYPULSE_MYSQL_PORT?.trim();
  if (!port) {
    return undefined;
  }

  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('CITYPULSE_MYSQL_PORT must be an integer between 1 and 65535.');
  }

  return port;
}

export function getComposeProject() {
  const project = process.env.CITYPULSE_COMPOSE_PROJECT?.trim();
  if (!project) {
    return undefined;
  }

  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(project)) {
    throw new Error(
      'CITYPULSE_COMPOSE_PROJECT may contain only letters, numbers, underscores, and hyphens.',
    );
  }

  return project;
}

export function assertLocalDatabaseUrl(value) {
  if (!value?.trim()) {
    throw new Error(
      'apps/backend/.env must define DATABASE_URL before local bootstrap can continue.',
    );
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('apps/backend/.env has an invalid DATABASE_URL.');
  }

  if (url.protocol !== 'mysql:' || !localHosts.has(url.hostname.toLowerCase())) {
    throw new Error(
      'Refusing to bootstrap a non-local DATABASE_URL. Use localhost, 127.0.0.1, or ::1 for local development.',
    );
  }

  return url;
}

export function assertDevelopmentMode(nodeEnv, subject) {
  const normalized = nodeEnv?.trim().toLowerCase();
  if (!normalized || normalized === 'development') {
    return;
  }

  throw new Error(`${subject} only supports NODE_ENV=development.`);
}

export function getLocalDatabasePort(env) {
  const url = assertLocalDatabaseUrl(env.DATABASE_URL);
  const databasePort = url.port || '3306';
  const requestedPort = getRequestedPort();

  if (requestedPort && requestedPort !== databasePort) {
    throw new Error(
      'CITYPULSE_MYSQL_PORT does not match the port in apps/backend/.env DATABASE_URL.',
    );
  }

  return requestedPort ?? databasePort;
}

function createLocalEnvFile() {
  if (!existsSync(backendEnvExamplePath)) {
    throw new Error('Missing apps/backend/.env.example.');
  }

  const port = getRequestedPort() ?? '3306';
  const localValues = {
    NODE_ENV: 'development',
    PORT: '3001',
    CORS_ORIGIN: 'http://localhost:5173',
    DATABASE_URL: `mysql://citypulse:citypulse@localhost:${port}/citypulse`,
    JWT_ACCESS_SECRET: createSecret(),
    JWT_REFRESH_SECRET: createSecret(),
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    CLOUDINARY_URL: '',
    OPEN_METEO_TIMEOUT_MS: '5000',
    CRON_SECRET: createSecret(),
  };

  let content = readFileSync(backendEnvExamplePath, 'utf8');
  for (const [key, value] of Object.entries(localValues)) {
    content = setEnvValue(content, key, value);
  }

  writeFileSync(backendEnvPath, content, 'utf8');
  console.log('Created apps/backend/.env with local development values.');
}

function ensureExistingLocalEnv() {
  let content = readFileSync(backendEnvPath, 'utf8');
  const initialEnv = parseEnv(content);

  assertDevelopmentMode(initialEnv.NODE_ENV, 'Local bootstrap');

  assertLocalDatabaseUrl(initialEnv.DATABASE_URL);

  const generatedValues = {
    JWT_ACCESS_SECRET: createSecret(),
    JWT_REFRESH_SECRET: createSecret(),
    CRON_SECRET: createSecret(),
  };
  let changed = false;

  for (const [key, value] of Object.entries(generatedValues)) {
    const nextContent = setEnvValueIfMissingOrBlank(content, key, value);
    changed ||= nextContent !== content;
    content = nextContent;
  }

  if (changed) {
    writeFileSync(backendEnvPath, content, 'utf8');
    console.log('Added missing local JWT/cron secrets to apps/backend/.env.');
  }
}

export function ensureLocalBackendEnv() {
  if (!existsSync(backendEnvPath)) {
    createLocalEnvFile();
  } else {
    ensureExistingLocalEnv();
  }

  const env = parseEnv(readFileSync(backendEnvPath, 'utf8'));

  assertDevelopmentMode(env.NODE_ENV, 'Local bootstrap');

  assertLocalDatabaseUrl(env.DATABASE_URL);
  return env;
}

export function loadBackendEnv() {
  if (!existsSync(backendEnvPath)) {
    throw new Error('Missing apps/backend/.env. Run npm run bootstrap:local first.');
  }

  return parseEnv(readFileSync(backendEnvPath, 'utf8'));
}

export function createBackendChildEnv(env) {
  return {
    ...process.env,
    ...env,
    NODE_ENV: env.NODE_ENV?.trim() || 'development',
  };
}
