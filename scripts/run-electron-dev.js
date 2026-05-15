const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

const electronBinary = require('electron');
const vitePackageJson = require.resolve('vite/package.json');
const viteCli = path.join(path.dirname(vitePackageJson), 'bin', 'vite.js');
const DEFAULT_DEV_PORT = 5173;
const MAX_PORT_SCAN = 20;
const SERVER_READY_TIMEOUT_MS = 30000;

function canConnect(port, host) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(250);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

function canListen(port, host) {
  return new Promise((resolve) => {
    const tester = net.createServer();

    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });

    tester.listen(port, host);
  });
}

async function isPortAvailable(port) {
  const localhostBusy =
    // eslint-disable-next-line no-await-in-loop
    (await canConnect(port, '127.0.0.1')) ||
    // eslint-disable-next-line no-await-in-loop
    (await canConnect(port, '::1'));

  if (localhostBusy) {
    return false;
  }

  const ipv4Available =
    // eslint-disable-next-line no-await-in-loop
    await canListen(port, '127.0.0.1');
  const ipv6Available =
    // eslint-disable-next-line no-await-in-loop
    await canListen(port, '::1');

  return ipv4Available && ipv6Available;
}

async function findAvailablePort(startPort) {
  for (let offset = 0; offset < MAX_PORT_SCAN; offset += 1) {
    const port = startPort + offset;
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available dev port found between ${startPort} and ${startPort + MAX_PORT_SCAN - 1}.`);
}

function waitForServer(url) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on('error', () => {
        if (Date.now() - startedAt >= SERVER_READY_TIMEOUT_MS) {
          reject(new Error(`Timed out waiting for dev server at ${url}`));
          return;
        }

        setTimeout(attempt, 250);
      });
    };

    attempt();
  });
}

async function main() {
  const port = await findAvailablePort(DEFAULT_DEV_PORT);
  const rendererUrl = `http://localhost:${port}`;
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    MASJID_RENDERER_DEV_PORT: String(port),
    MASJID_RENDERER_DEV_URL: rendererUrl
  };

  delete env.ELECTRON_RUN_AS_NODE;

  console.log(`[electron:dev] Starting Vite on ${rendererUrl}`);

  const viteProcess = spawn(process.execPath, [viteCli, '--port', String(port), '--strictPort'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env
  });

  let electronProcess = null;
  let shuttingDown = false;

  const shutdown = (exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;

    if (electronProcess && !electronProcess.killed) {
      electronProcess.kill();
    }

    if (!viteProcess.killed) {
      viteProcess.kill();
    }

    setTimeout(() => process.exit(exitCode), 250);
  };

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  viteProcess.on('exit', (code) => {
    if (shuttingDown) return;

    if (electronProcess && !electronProcess.killed) {
      console.error(`[electron:dev] Vite exited unexpectedly with code ${code ?? 'unknown'}.`);
      shutdown(typeof code === 'number' ? code : 1);
      return;
    }

    process.exit(typeof code === 'number' ? code : 1);
  });

  await waitForServer(rendererUrl);

  console.log(`[electron:dev] Launching Electron using ${rendererUrl}`);

  electronProcess = spawn(electronBinary, ['.'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env
  });

  electronProcess.on('exit', (code, signal) => {
    if (signal) {
      shutdown(1);
      return;
    }

    shutdown(typeof code === 'number' ? code : 0);
  });
}

main().catch((error) => {
  console.error('[electron:dev] Failed to start development environment:', error);
  process.exit(1);
});
