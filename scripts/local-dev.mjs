import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backendDir, rootDir } from './local-env.mjs';
import { bootstrapLocal } from './local-bootstrap.mjs';

const frontendDir = `${rootDir}/apps/frontend`;
const schedulerPath = `${rootDir}/scripts/dev-scheduler.mjs`;

function start(command, args, options) {
  return spawn(command, args, {
    ...options,
    stdio: 'inherit',
    windowsHide: true,
  });
}

function startNpm(args, options) {
  if (process.platform === 'win32') {
    return start(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd', ...args], options);
  }

  return start('npm', args, options);
}

function stop(child) {
  if (!child.pid || child.exitCode !== null) {
    return Promise.resolve();
  }

  if (process.platform !== 'win32') {
    child.kill('SIGTERM');
    return Promise.resolve();
  }

  return new Promise((resolveStop) => {
    const taskkill = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    taskkill.on('close', () => resolveStop());
    taskkill.on('error', () => resolveStop());
  });
}

export async function startLocalDevelopment() {
  const { backendEnv } = await bootstrapLocal();
  const children = [
    startNpm(['run', 'start:dev'], {
      cwd: backendDir,
      env: backendEnv,
    }),
    startNpm(['run', 'dev'], {
      cwd: frontendDir,
      env: process.env,
    }),
    start(process.execPath, [schedulerPath], {
      cwd: rootDir,
      env: backendEnv,
    }),
  ];
  let stopping = false;

  const shutdown = async (exitCode) => {
    if (stopping) {
      return;
    }
    stopping = true;
    await Promise.all(children.map((child) => stop(child)));
    process.exitCode = exitCode;
  };

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      void shutdown(0);
    });
  }

  for (const child of children) {
    child.on('exit', (code, signal) => {
      if (!stopping) {
        console.error(
          `A local development process exited unexpectedly (${signal ?? code ?? 'unknown'}).`,
        );
        void shutdown(code === 0 ? 1 : code ?? 1);
      }
    });
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  startLocalDevelopment().catch((error) => {
    console.error(`Local development failed: ${error.message}`);
    process.exitCode = 1;
  });
}
