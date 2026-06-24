import { test, expect, APIRequestContext, APIResponse } from '@playwright/test';
import fs from 'fs';
import path from 'path';

type MarketDataItem = {
  symbol: string;
  price: number;
  timestamp: string;
};

type InsightsResponse = {
  summary: string;
  signals: string[];
};

type ManifestEntry = {
  timestamp: string;
  type: string;
  message?: string;
  testName?: string;
  endpoint?: string;
  status?: number;
  durationMs?: number;
  file?: string;
  details?: Record<string, unknown>;
};

test.describe('API Validation Suite', () => {
  const baseURL = 'https://example.com';
  const suiteName = 'api-validation';
  const runId = `${suiteName}-${Date.now()}`;

  const artifactRoot = path.join(process.cwd(), 'artifacts', 'playwright', runId);
  const logsDir = path.join(artifactRoot, 'logs');
  const manifestsDir = path.join(artifactRoot, 'manifests');
  const snapshotsDir = path.join(artifactRoot, 'snapshots');
  const manifestPath = path.join(manifestsDir, 'manifest.json');
  const runLogPath = path.join(logsDir, 'run.log');

  function ensureArtifactDirs() {
    fs.mkdirSync(logsDir, { recursive: true });
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.mkdirSync(snapshotsDir, { recursive: true });
  }

  function sanitizeFileName(value: string) {
    return value.replace(/[^a-zA-Z0-9-_]/g, '_');
  }

  function writeJson(filePath: string, data: unknown) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  function appendRunLog(message: string) {
    ensureArtifactDirs();
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(runLogPath, line, 'utf-8');
  }

  function appendManifest(entry: Omit<ManifestEntry, 'timestamp'>) {
    ensureArtifactDirs();

    const existing: ManifestEntry[] = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
      : [];

    const nextEntry: ManifestEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };

    existing.push(nextEntry);
    writeJson(manifestPath, existing);

    const logParts = [
      entry.type,
      entry.testName ? `test=${entry.testName}` : null,
      entry.endpoint ? `endpoint=${entry.endpoint}` : null,
      entry.status !== undefined ? `status=${entry.status}` : null,
      entry.durationMs !== undefined ? `durationMs=${entry.durationMs}` : null,
      entry.message ? `message="${entry.message}"` : null,
      entry.file ? `file=${entry.file}` : null,
    ].filter(Boolean);

    appendRunLog(logParts.join(' | '));
  }

  function writeLogArtifact(fileName: string, data: unknown) {
    ensureArtifactDirs();
    writeJson(path.join(logsDir, fileName), data);
  }

  function writeSnapshotArtifact(fileName: string, data: unknown) {
    ensureArtifactDirs();
    writeJson(path.join(snapshotsDir, fileName), data);
  }

  async function safeReadResponseBody(response: APIResponse) {
    const contentType = response.headers()['content-type'] ?? '';

    try {
      if (contentType.includes('application/json')) {
        return {
          kind: 'json' as const,
          body: await response.json(),
        };
      }

      return {
        kind: 'text' as const,
        body: await response.text(),
      };
    } catch (error) {
      return {
        kind: 'unreadable' as const,
        body: null,
        error: error instanceof Error ? error.message : 'Unknown response parse error',
      };
    }
  }

  async function validateJsonContentType(response: APIResponse) {
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  }

  async function validateResponseTime(
    requestContext: APIRequestContext,
    endpoint: string,
    maxDurationMs: number,
    testName: string
  ) {
    appendRunLog(`Starting request for ${testName} at ${endpoint}`);

    const start = Date.now();
    const response = await requestContext.get(`${baseURL}${endpoint}`);
    const duration = Date.now() - start;

    expect(response.status()).toBe(200);
    expect(duration).toBeLessThan(maxDurationMs);

    const responseBody = await safeReadResponseBody(response);
    const responseFileName = `${sanitizeFileName(testName)}-${sanitizeFileName(endpoint)}-response.json`;

    writeLogArtifact(responseFileName, {
      capturedAt: new Date().toISOString(),
      endpoint,
      url: `${baseURL}${endpoint}`,
      method: 'GET',
      status: response.status(),
      ok: response.ok(),
      durationMs: duration,
      headers: response.headers(),
      bodyKind: responseBody.kind,
      body: responseBody.body,
      parseError: 'error' in responseBody ? responseBody.error : null,
    });

    appendManifest({
      type: 'api_response',
      testName,
      endpoint,
      status: response.status(),
      durationMs: duration,
      file: `logs/${responseFileName}`,
      details: {
        maxDurationMs,
        ok: response.ok(),
      },
    });

    return { response, duration };
  }

  test.beforeAll(async () => {
    ensureArtifactDirs();

    writeJson(path.join(artifactRoot, 'run-info.json'), {
      runId,
      suite: 'API Validation Suite',
      framework: 'Playwright',
      startedAt: new Date().toISOString(),
      baseURL,
      artifactFolders: {
        logs: 'logs/',
        manifests: 'manifests/',
        snapshots: 'snapshots/',
      },
    });

    appendRunLog(`Initialized artifact directories under ${artifactRoot}`);

    appendManifest({
      type: 'run_start',
      message: 'Started API validation suite',
      details: { runId, baseURL },
    });
  });

  test('validate market data endpoint returns valid structure and values', async ({ request }) => {
    const testName = 'market-data';
    const { response } = await validateResponseTime(
      request,
      '/api/market-data',
      2000,
      testName
    );

    await test.step('Validate status and content type', async () => {
      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);
      await validateJsonContentType(response);

      appendManifest({
        type: 'validation_step',
        testName,
        endpoint: '/api/market-data',
        message: 'Validated status and JSON content type',
      });
    });

    await test.step('Validate market data payload structure', async () => {
      const body = await response.json();

      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBeTruthy();
      expect(body.data.length).toBeGreaterThan(0);

      const firstItem = body.data[0] as MarketDataItem;

      expect(firstItem).toHaveProperty('symbol');
      expect(firstItem).toHaveProperty('price');
      expect(firstItem).toHaveProperty('timestamp');

      expect(typeof firstItem.symbol).toBe('string');
      expect(firstItem.symbol.length).toBeGreaterThan(0);

      expect(typeof firstItem.price).toBe('number');
      expect(firstItem.price).toBeGreaterThan(0);

      expect(typeof firstItem.timestamp).toBe('string');
      expect(new Date(firstItem.timestamp).toString()).not.toBe('Invalid Date');

      writeSnapshotArtifact('market-data-pretty.json', body);

      appendManifest({
        type: 'payload_snapshot',
        testName,
        endpoint: '/api/market-data',
        file: 'snapshots/market-data-pretty.json',
        details: {
          itemCount: body.data.length,
          firstSymbol: firstItem.symbol,
        },
      });
    });

    await test.step('Validate all market data entries contain required fields', async () => {
      const body = await response.json();

      for (const item of body.data as MarketDataItem[]) {
        expect(item.symbol).toBeTruthy();
        expect(typeof item.symbol).toBe('string');

        expect(typeof item.price).toBe('number');
        expect(item.price).toBeGreaterThan(0);

        expect(typeof item.timestamp).toBe('string');
      }

      appendManifest({
        type: 'validation_step',
        testName,
        endpoint: '/api/market-data',
        message: 'Validated all market data entries contain required fields',
        details: {
          validatedItems: body.data.length,
        },
      });
    });
  });

  test('validate AI insights endpoint returns summary and signal data', async ({ request }) => {
    const testName = 'ai-insights';
    const { response } = await validateResponseTime(
      request,
      '/api/ai-insights',
      2500,
      testName
    );

    await test.step('Validate status and content type', async () => {
      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);
      await validateJsonContentType(response);

      appendManifest({
        type: 'validation_step',
        testName,
        endpoint: '/api/ai-insights',
        message: 'Validated status and JSON content type',
      });
    });

    await test.step('Validate AI insights payload structure', async () => {
      const body = (await response.json()) as InsightsResponse;

      expect(body).toHaveProperty('summary');
      expect(body).toHaveProperty('signals');

      expect(typeof body.summary).toBe('string');
      expect(body.summary.length).toBeGreaterThan(20);

      expect(Array.isArray(body.signals)).toBeTruthy();

      writeSnapshotArtifact('ai-insights-pretty.json', body);

      appendManifest({
        type: 'payload_snapshot',
        testName,
        endpoint: '/api/ai-insights',
        file: 'snapshots/ai-insights-pretty.json',
        details: {
          signalCount: body.signals.length,
          summaryLength: body.summary.length,
        },
      });
    });

    await test.step('Validate signals array contains usable values', async () => {
      const body = (await response.json()) as InsightsResponse;

      for (const signal of body.signals) {
        expect(typeof signal).toBe('string');
        expect(signal.length).toBeGreaterThan(2);
      }

      appendManifest({
        type: 'validation_step',
        testName,
        endpoint: '/api/ai-insights',
        message: 'Validated all signals contain usable string values',
        details: {
          validatedSignals: body.signals.length,
        },
      });
    });
  });

  test('validate unauthorized endpoint access is blocked correctly', async ({ request }) => {
    const testName = 'unauthorized-access';
    const endpoint = '/api/admin/reports';
    const response = await request.get(`${baseURL}${endpoint}`);
    const responseBody = await safeReadResponseBody(response);

    writeLogArtifact('unauthorized-endpoint-response.json', {
      capturedAt: new Date().toISOString(),
      endpoint,
      url: `${baseURL}${endpoint}`,
      method: 'GET',
      status: response.status(),
      ok: response.ok(),
      headers: response.headers(),
      bodyKind: responseBody.kind,
      body: responseBody.body,
      parseError: 'error' in responseBody ? responseBody.error : null,
    });

    await test.step('Validate unauthorized access control', async () => {
      expect([401, 403]).toContain(response.status());

      appendManifest({
        type: 'security_validation',
        testName,
        endpoint,
        status: response.status(),
        file: 'logs/unauthorized-endpoint-response.json',
        message: 'Validated unauthorized endpoint is blocked',
      });
    });
  });

  test('validate invalid endpoint returns correct error response', async ({ request }) => {
    const testName = 'invalid-endpoint';
    const endpoint = '/api/non-existent-endpoint';
    const response = await request.get(`${baseURL}${endpoint}`);
    const responseBody = await safeReadResponseBody(response);

    writeLogArtifact('not-found-endpoint-response.json', {
      capturedAt: new Date().toISOString(),
      endpoint,
      url: `${baseURL}${endpoint}`,
      method: 'GET',
      status: response.status(),
      ok: response.ok(),
      headers: response.headers(),
      bodyKind: responseBody.kind,
      body: responseBody.body,
      parseError: 'error' in responseBody ? responseBody.error : null,
    });

    await test.step('Validate not found behaviour', async () => {
      expect(response.status()).toBe(404);

      appendManifest({
        type: 'negative_validation',
        testName,
        endpoint,
        status: response.status(),
        file: 'logs/not-found-endpoint-response.json',
        message: 'Validated invalid endpoint returns 404',
      });
    });
  });

  test.afterAll(async () => {
    appendManifest({
      type: 'run_end',
      message: 'Completed API validation suite',
      details: { runId },
    });

    appendRunLog('Finished API validation suite');
  });
});
