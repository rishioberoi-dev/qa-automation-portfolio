# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: playwright\api-validation.spec.ts >> API Validation Suite >> validate market data endpoint returns valid structure and values
- Location: playwright\api-validation.spec.ts:200:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 404
```

# Test source

```ts
  39  | 
  40  |   function ensureArtifactDirs() {
  41  |     fs.mkdirSync(logsDir, { recursive: true });
  42  |     fs.mkdirSync(manifestsDir, { recursive: true });
  43  |     fs.mkdirSync(snapshotsDir, { recursive: true });
  44  |   }
  45  | 
  46  |   function sanitizeFileName(value: string) {
  47  |     return value.replace(/[^a-zA-Z0-9-_]/g, '_');
  48  |   }
  49  | 
  50  |   function writeJson(filePath: string, data: unknown) {
  51  |     fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  52  |   }
  53  | 
  54  |   function appendRunLog(message: string) {
  55  |     ensureArtifactDirs();
  56  |     const line = `[${new Date().toISOString()}] ${message}\n`;
  57  |     fs.appendFileSync(runLogPath, line, 'utf-8');
  58  |   }
  59  | 
  60  |   function appendManifest(entry: Omit<ManifestEntry, 'timestamp'>) {
  61  |     ensureArtifactDirs();
  62  | 
  63  |     const existing: ManifestEntry[] = fs.existsSync(manifestPath)
  64  |       ? JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  65  |       : [];
  66  | 
  67  |     const nextEntry: ManifestEntry = {
  68  |       timestamp: new Date().toISOString(),
  69  |       ...entry,
  70  |     };
  71  | 
  72  |     existing.push(nextEntry);
  73  |     writeJson(manifestPath, existing);
  74  | 
  75  |     const logParts = [
  76  |       entry.type,
  77  |       entry.testName ? `test=${entry.testName}` : null,
  78  |       entry.endpoint ? `endpoint=${entry.endpoint}` : null,
  79  |       entry.status !== undefined ? `status=${entry.status}` : null,
  80  |       entry.durationMs !== undefined ? `durationMs=${entry.durationMs}` : null,
  81  |       entry.message ? `message="${entry.message}"` : null,
  82  |       entry.file ? `file=${entry.file}` : null,
  83  |     ].filter(Boolean);
  84  | 
  85  |     appendRunLog(logParts.join(' | '));
  86  |   }
  87  | 
  88  |   function writeLogArtifact(fileName: string, data: unknown) {
  89  |     ensureArtifactDirs();
  90  |     writeJson(path.join(logsDir, fileName), data);
  91  |   }
  92  | 
  93  |   function writeSnapshotArtifact(fileName: string, data: unknown) {
  94  |     ensureArtifactDirs();
  95  |     writeJson(path.join(snapshotsDir, fileName), data);
  96  |   }
  97  | 
  98  |   async function safeReadResponseBody(response: APIResponse) {
  99  |     const contentType = response.headers()['content-type'] ?? '';
  100 | 
  101 |     try {
  102 |       if (contentType.includes('application/json')) {
  103 |         return {
  104 |           kind: 'json' as const,
  105 |           body: await response.json(),
  106 |         };
  107 |       }
  108 | 
  109 |       return {
  110 |         kind: 'text' as const,
  111 |         body: await response.text(),
  112 |       };
  113 |     } catch (error) {
  114 |       return {
  115 |         kind: 'unreadable' as const,
  116 |         body: null,
  117 |         error: error instanceof Error ? error.message : 'Unknown response parse error',
  118 |       };
  119 |     }
  120 |   }
  121 | 
  122 |   async function validateJsonContentType(response: APIResponse) {
  123 |     const contentType = response.headers()['content-type'];
  124 |     expect(contentType).toContain('application/json');
  125 |   }
  126 | 
  127 |   async function validateResponseTime(
  128 |     requestContext: APIRequestContext,
  129 |     endpoint: string,
  130 |     maxDurationMs: number,
  131 |     testName: string
  132 |   ) {
  133 |     appendRunLog(`Starting request for ${testName} at ${endpoint}`);
  134 | 
  135 |     const start = Date.now();
  136 |     const response = await requestContext.get(`${baseURL}${endpoint}`);
  137 |     const duration = Date.now() - start;
  138 | 
> 139 |     expect(response.status()).toBe(200);
      |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  140 |     expect(duration).toBeLessThan(maxDurationMs);
  141 | 
  142 |     const responseBody = await safeReadResponseBody(response);
  143 |     const responseFileName = `${sanitizeFileName(testName)}-${sanitizeFileName(endpoint)}-response.json`;
  144 | 
  145 |     writeLogArtifact(responseFileName, {
  146 |       capturedAt: new Date().toISOString(),
  147 |       endpoint,
  148 |       url: `${baseURL}${endpoint}`,
  149 |       method: 'GET',
  150 |       status: response.status(),
  151 |       ok: response.ok(),
  152 |       durationMs: duration,
  153 |       headers: response.headers(),
  154 |       bodyKind: responseBody.kind,
  155 |       body: responseBody.body,
  156 |       parseError: 'error' in responseBody ? responseBody.error : null,
  157 |     });
  158 | 
  159 |     appendManifest({
  160 |       type: 'api_response',
  161 |       testName,
  162 |       endpoint,
  163 |       status: response.status(),
  164 |       durationMs: duration,
  165 |       file: `logs/${responseFileName}`,
  166 |       details: {
  167 |         maxDurationMs,
  168 |         ok: response.ok(),
  169 |       },
  170 |     });
  171 | 
  172 |     return { response, duration };
  173 |   }
  174 | 
  175 |   test.beforeAll(async () => {
  176 |     ensureArtifactDirs();
  177 | 
  178 |     writeJson(path.join(artifactRoot, 'run-info.json'), {
  179 |       runId,
  180 |       suite: 'API Validation Suite',
  181 |       framework: 'Playwright',
  182 |       startedAt: new Date().toISOString(),
  183 |       baseURL,
  184 |       artifactFolders: {
  185 |         logs: 'logs/',
  186 |         manifests: 'manifests/',
  187 |         snapshots: 'snapshots/',
  188 |       },
  189 |     });
  190 | 
  191 |     appendRunLog(`Initialized artifact directories under ${artifactRoot}`);
  192 | 
  193 |     appendManifest({
  194 |       type: 'run_start',
  195 |       message: 'Started API validation suite',
  196 |       details: { runId, baseURL },
  197 |     });
  198 |   });
  199 | 
  200 |   test('validate market data endpoint returns valid structure and values', async ({ request }) => {
  201 |     const testName = 'market-data';
  202 |     const { response } = await validateResponseTime(
  203 |       request,
  204 |       '/api/market-data',
  205 |       2000,
  206 |       testName
  207 |     );
  208 | 
  209 |     await test.step('Validate status and content type', async () => {
  210 |       expect(response.ok()).toBeTruthy();
  211 |       expect(response.status()).toBe(200);
  212 |       await validateJsonContentType(response);
  213 | 
  214 |       appendManifest({
  215 |         type: 'validation_step',
  216 |         testName,
  217 |         endpoint: '/api/market-data',
  218 |         message: 'Validated status and JSON content type',
  219 |       });
  220 |     });
  221 | 
  222 |     await test.step('Validate market data payload structure', async () => {
  223 |       const body = await response.json();
  224 | 
  225 |       expect(body).toHaveProperty('data');
  226 |       expect(Array.isArray(body.data)).toBeTruthy();
  227 |       expect(body.data.length).toBeGreaterThan(0);
  228 | 
  229 |       const firstItem = body.data[0] as MarketDataItem;
  230 | 
  231 |       expect(firstItem).toHaveProperty('symbol');
  232 |       expect(firstItem).toHaveProperty('price');
  233 |       expect(firstItem).toHaveProperty('timestamp');
  234 | 
  235 |       expect(typeof firstItem.symbol).toBe('string');
  236 |       expect(firstItem.symbol.length).toBeGreaterThan(0);
  237 | 
  238 |       expect(typeof firstItem.price).toBe('number');
  239 |       expect(firstItem.price).toBeGreaterThan(0);
```