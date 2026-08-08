import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  backendDir,
  createBackendChildEnv,
  ensureLocalBackendEnv,
  getComposeProject,
  getLocalDatabasePort,
  rootDir,
} from './local-env.mjs';

function run(command, args, options = {}) {
  const { cwd = rootDir, env = process.env, quiet = false } = options;

  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      windowsHide: true,
    });
    let output = '';

    if (quiet) {
      child.stdout.on('data', (chunk) => {
        output += chunk;
      });
      child.stderr.on('data', (chunk) => {
        output += chunk;
      });
    }

    child.on('error', (error) => rejectRun(error));
    child.on('close', (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }

      rejectRun(
        new Error(
          `${command} ${args.join(' ')} exited with code ${code}.${
            output ? ` ${output.trim()}` : ''
          }`,
        ),
      );
    });
  });
}

function runNpm(args, options) {
  if (process.platform === 'win32') {
    return run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd', ...args], options);
  }

  return run('npm', args, options);
}

function composeArgs(project, args) {
  return ['compose', ...(project ? ['--project-name', project] : []), ...args];
}

async function waitForMySql(project, composeEnv) {
  const deadline = Date.now() + 60_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      await run(
        'docker',
        composeArgs(project, [
          'exec',
          '-T',
          'mysql',
          'mysqladmin',
          'ping',
          '--silent',
          '-h',
          '127.0.0.1',
          '-ucitypulse',
          '-pcitypulse',
        ]),
        { env: composeEnv, quiet: true },
      );
      console.log('Local MySQL is ready.');
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
    }
  }

  throw new Error(
    `Local MySQL did not become ready within 60 seconds.${
      lastError ? ` ${lastError.message}` : ''
    }`,
  );
}

export async function bootstrapLocal() {
  if (!existsSync(join(rootDir, 'node_modules'))) {
    throw new Error('Dependencies are not installed. Run npm install from the repository root first.');
  }

  const env = ensureLocalBackendEnv();
  const mysqlPort = getLocalDatabasePort(env);
  const project = getComposeProject();
  const composeEnv = {
    ...process.env,
    CITYPULSE_MYSQL_PORT: mysqlPort,
  };
  const backendEnv = createBackendChildEnv(env);

  console.log('Starting local MySQL with Docker Compose...');
  await run('docker', composeArgs(project, ['up', '-d', 'mysql']), {
    env: composeEnv,
  });
  await waitForMySql(project, composeEnv);

  await runNpm(['run', 'prisma:generate'], {
    cwd: backendDir,
    env: backendEnv,
  });
  await runNpm(['run', 'prisma:migrate:deploy'], {
    cwd: backendDir,
    env: backendEnv,
  });
  await runNpm(['run', 'prisma:seed'], {
    cwd: backendDir,
    env: backendEnv,
  });

  return { env, backendEnv };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  bootstrapLocal().catch((error) => {
    console.error(`Local bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  });
}
