import { Page, APIResponse, BrowserContext, ConsoleMessage, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export type ManifestEntry = {
  timestamp: string;
  type: string;
  testName?: string;
  message?: string;
  file?: string;
  details?: Record<string, unknown>;
};

export type ArtifactContext = {
  runId: string;
  artifactRoot: string;
  logsDir: string;
  manifestsDir: string;
  snapshotsDir: string;
  appendManifest: (entry: Omit<ManifestEntry, 'timestamp'>) => void;
  appendRunLog: (message: string) => void;
  writeLogArtifact: (fileName: string, data: unknown) => void;
  writeSnapshotArtifact: (fileName: string, data: unknown) => void;
  writeRootArtifact: (fileName: string, data: unknown) => void;
};

export function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, '_');
}

function writeJsonFile(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function ensureArtifactDirs(artifactRoot: string) {
  fs.mkdirSync(path.join(artifactRoot, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(artifactRoot, 'manifests'), { recursive: true });
  fs.mkdirSync(path.join(artifactRoot, 'snapshots'), { recursive: true });
}

function getManifestPath(artifactRoot: string) {
  return path.join(artifactRoot, 'manifests', 'manifest.json');
}

function getRunLogPath(artifactRoot: string) {
  return path.join(artifactRoot, 'logs', 'run.log');
}

export function appendManifest(
  artifactRoot: string,
  entry: Omit<ManifestEntry, 'timestamp'>
) {
  ensureArtifactDirs(artifactRoot);

  const manifestPath = getManifestPath(artifactRoot);

  const existing: ManifestEntry[] = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    : [];

  existing.push({
    timestamp: new Date().toISOString(),
    ...entry,
  });

  writeJsonFile(manifestPath, existing);
}

export function appendRunLog(artifactRoot: string, message: string) {
  ensureArtifactDirs(artifactRoot);
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(getRunLogPath(artifactRoot), line, 'utf-8');
}

export function createArtifactContext(suiteName: string): ArtifactContext {
  const safeSuiteName = sanitizeFileName(suiteName);
  const runId = `${safeSuiteName}-${Date.now()}`;
  const artifactRoot = path.join(process.cwd(), 'artifacts', 'playwright', runId);
  const logsDir = path.join(artifactRoot, 'logs');
  const manifestsDir = path.join(artifactRoot, 'manifests');
  const snapshotsDir = path.join(artifactRoot, 'snapshots');

  ensureArtifactDirs(artifactRoot);

  writeJsonFile(path.join(artifactRoot, 'run-info.json'), {
    runId,
    suite: suiteName,
    framework: 'Playwright',
    startedAt: new Date().toISOString(),
    artifactFolders: {
      logs: 'logs/',
      manifests: 'manifests/',
      snapshots: 'snapshots/',
    },
  });

  appendRunLog(artifactRoot, `Initialized artifact context for ${suiteName}`);

  appendManifest(artifactRoot, {
    type: 'run_start',
    message: `Started ${suiteName}`,
    details: { runId, suiteName },
  });

  return {
    runId,
    artifactRoot,
    logsDir,
    manifestsDir,
    snapshotsDir,
    appendManifest: (entry: Omit<ManifestEntry, 'timestamp'>) =>
      appendManifest(artifactRoot, entry),
    appendRunLog: (message: string) => appendRunLog(artifactRoot, message),
    writeLogArtifact: (fileName: string, data: unknown) =>
      writeJsonFile(path.join(logsDir, fileName), data),
    writeSnapshotArtifact: (fileName: string, data: unknown) =>
      writeJsonFile(path.join(snapshotsDir, fileName), data),
    writeRootArtifact: (fileName: string, data: unknown) =>
      writeJsonFile(path.join(artifactRoot, fileName), data),
  };
}

export function finalizeArtifactContext(
  artifactRoot: string,
  suiteName: string,
  runId: string
) {
  appendManifest(artifactRoot, {
    type: 'run_end',
    message: `Completed ${suiteName}`,
    details: { runId, suiteName },
  });

  appendRunLog(artifactRoot, `Completed ${suiteName}`);
}

export async function saveScreenshot(
  artifactRoot: string,
  page: Page,
  fileName: string,
  testName: string,
  message: string
) {
  const screenshotPath = path.join(artifactRoot, 'snapshots', fileName);

  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  });

  appendManifest(artifactRoot, {
    type: 'screenshot',
    testName,
    file: `snapshots/${fileName}`,
    message,
  });

  appendRunLog(artifactRoot, `Saved screenshot snapshots/${fileName}`);
}

export async function captureBrowserState(
  artifactRoot: string,
  page: Page,
  context: BrowserContext,
  testName: string,
  label: string
) {
  const storageState = await context.storageState();

  const localStorageEntries = await page.evaluate(() => {
    const values: Record<string, string> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) values[key] = window.localStorage.getItem(key) ?? '';
    }
    return values;
  });

  const sessionStorageEntries = await page.evaluate(() => {
    const values: Record<string, string> = {};
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key) values[key] = window.sessionStorage.getItem(key) ?? '';
    }
    return values;
  });

  const fileName = `${sanitizeFileName(testName)}-${sanitizeFileName(label)}-browser-state.json`;

  writeJsonFile(path.join(artifactRoot, 'snapshots', fileName), {
    capturedAt: new Date().toISOString(),
    label,
    url: page.url(),
    storageState,
    localStorage: localStorageEntries,
    sessionStorage: sessionStorageEntries,
  });

  appendManifest(artifactRoot, {
    type: 'browser_state',
    testName,
    file: `snapshots/${fileName}`,
    message: `Captured browser state for ${label}`,
    details: {
      url: page.url(),
      localStorageKeys: Object.keys(localStorageEntries),
      sessionStorageKeys: Object.keys(sessionStorageEntries),
    },
  });

  appendRunLog(artifactRoot, `Captured browser state snapshots/${fileName}`);
}

export async function captureApiResponse(
  artifactRoot: string,
  response: APIResponse,
  fileName: string,
  testName: string,
  label: string
) {
  let body: unknown = null;
  let parseMode: 'json' | 'text' | 'unreadable' = 'json';
  let parseError: string | null = null;

  try {
    const contentType = response.headers()['content-type'] ?? '';
    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      parseMode = 'text';
      body = await response.text();
    }
  } catch (error) {
    parseMode = 'unreadable';
    parseError = error instanceof Error ? error.message : 'Unknown parse error';
  }

  writeJsonFile(path.join(artifactRoot, 'logs', fileName), {
    capturedAt: new Date().toISOString(),
    label,
    url: response.url(),
    status: response.status(),
    ok: response.ok(),
    headers: response.headers(),
    parseMode,
    parseError,
    body,
  });

  appendManifest(artifactRoot, {
    type: 'api_snapshot',
    testName,
    file: `logs/${fileName}`,
    message: `Captured API response for ${label}`,
    details: {
      url: response.url(),
      status: response.status(),
      ok: response.ok(),
    },
  });

  appendRunLog(artifactRoot, `Captured API response logs/${fileName}`);

  return body;
}

export async function captureConsoleErrors(
  artifactRoot: string,
  page: Page,
  testName: string,
  label: string,
  action: () => Promise<void>
) {
  const consoleErrors: string[] = [];

  const listener = (message: ConsoleMessage) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  };

  page.on('console', listener);

  try {
    await action();
  } finally {
    page.off('console', listener);
  }

  const criticalErrors = consoleErrors.filter(
    error =>
      !error.includes('favicon') &&
      !error.toLowerCase().includes('warning')
  );

  const fileName = `${sanitizeFileName(testName)}-${sanitizeFileName(label)}-console-errors.json`;

  writeJsonFile(path.join(artifactRoot, 'logs', fileName), {
    capturedAt: new Date().toISOString(),
    label,
    allConsoleErrors: consoleErrors,
    criticalErrors,
  });

  appendManifest(artifactRoot, {
    type: 'console_capture',
    testName,
    file: `logs/${fileName}`,
    message: `Captured console output for ${label}`,
    details: {
      totalErrors: consoleErrors.length,
      criticalErrorCount: criticalErrors.length,
    },
  });

  appendRunLog(artifactRoot, `Captured console output logs/${fileName}`);

  expect(criticalErrors).toEqual([]);
}
