# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: playwright\api-validation.spec.ts >> API Validation Suite >> validate unauthorized endpoint access is blocked correctly
- Location: playwright\api-validation.spec.ts:350:7

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected value: 404
Received array: [401, 403]
```

# Test source

```ts
  270 | 
  271 |       appendManifest({
  272 |         type: 'validation_step',
  273 |         testName,
  274 |         endpoint: '/api/market-data',
  275 |         message: 'Validated all market data entries contain required fields',
  276 |         details: {
  277 |           validatedItems: body.data.length,
  278 |         },
  279 |       });
  280 |     });
  281 |   });
  282 | 
  283 |   test('validate AI insights endpoint returns summary and signal data', async ({ request }) => {
  284 |     const testName = 'ai-insights';
  285 |     const { response } = await validateResponseTime(
  286 |       request,
  287 |       '/api/ai-insights',
  288 |       2500,
  289 |       testName
  290 |     );
  291 | 
  292 |     await test.step('Validate status and content type', async () => {
  293 |       expect(response.ok()).toBeTruthy();
  294 |       expect(response.status()).toBe(200);
  295 |       await validateJsonContentType(response);
  296 | 
  297 |       appendManifest({
  298 |         type: 'validation_step',
  299 |         testName,
  300 |         endpoint: '/api/ai-insights',
  301 |         message: 'Validated status and JSON content type',
  302 |       });
  303 |     });
  304 | 
  305 |     await test.step('Validate AI insights payload structure', async () => {
  306 |       const body = (await response.json()) as InsightsResponse;
  307 | 
  308 |       expect(body).toHaveProperty('summary');
  309 |       expect(body).toHaveProperty('signals');
  310 | 
  311 |       expect(typeof body.summary).toBe('string');
  312 |       expect(body.summary.length).toBeGreaterThan(20);
  313 | 
  314 |       expect(Array.isArray(body.signals)).toBeTruthy();
  315 | 
  316 |       writeSnapshotArtifact('ai-insights-pretty.json', body);
  317 | 
  318 |       appendManifest({
  319 |         type: 'payload_snapshot',
  320 |         testName,
  321 |         endpoint: '/api/ai-insights',
  322 |         file: 'snapshots/ai-insights-pretty.json',
  323 |         details: {
  324 |           signalCount: body.signals.length,
  325 |           summaryLength: body.summary.length,
  326 |         },
  327 |       });
  328 |     });
  329 | 
  330 |     await test.step('Validate signals array contains usable values', async () => {
  331 |       const body = (await response.json()) as InsightsResponse;
  332 | 
  333 |       for (const signal of body.signals) {
  334 |         expect(typeof signal).toBe('string');
  335 |         expect(signal.length).toBeGreaterThan(2);
  336 |       }
  337 | 
  338 |       appendManifest({
  339 |         type: 'validation_step',
  340 |         testName,
  341 |         endpoint: '/api/ai-insights',
  342 |         message: 'Validated all signals contain usable string values',
  343 |         details: {
  344 |           validatedSignals: body.signals.length,
  345 |         },
  346 |       });
  347 |     });
  348 |   });
  349 | 
  350 |   test('validate unauthorized endpoint access is blocked correctly', async ({ request }) => {
  351 |     const testName = 'unauthorized-access';
  352 |     const endpoint = '/api/admin/reports';
  353 |     const response = await request.get(`${baseURL}${endpoint}`);
  354 |     const responseBody = await safeReadResponseBody(response);
  355 | 
  356 |     writeLogArtifact('unauthorized-endpoint-response.json', {
  357 |       capturedAt: new Date().toISOString(),
  358 |       endpoint,
  359 |       url: `${baseURL}${endpoint}`,
  360 |       method: 'GET',
  361 |       status: response.status(),
  362 |       ok: response.ok(),
  363 |       headers: response.headers(),
  364 |       bodyKind: responseBody.kind,
  365 |       body: responseBody.body,
  366 |       parseError: 'error' in responseBody ? responseBody.error : null,
  367 |     });
  368 | 
  369 |     await test.step('Validate unauthorized access control', async () => {
> 370 |       expect([401, 403]).toContain(response.status());
      |                          ^ Error: expect(received).toContain(expected) // indexOf
  371 | 
  372 |       appendManifest({
  373 |         type: 'security_validation',
  374 |         testName,
  375 |         endpoint,
  376 |         status: response.status(),
  377 |         file: 'logs/unauthorized-endpoint-response.json',
  378 |         message: 'Validated unauthorized endpoint is blocked',
  379 |       });
  380 |     });
  381 |   });
  382 | 
  383 |   test('validate invalid endpoint returns correct error response', async ({ request }) => {
  384 |     const testName = 'invalid-endpoint';
  385 |     const endpoint = '/api/non-existent-endpoint';
  386 |     const response = await request.get(`${baseURL}${endpoint}`);
  387 |     const responseBody = await safeReadResponseBody(response);
  388 | 
  389 |     writeLogArtifact('not-found-endpoint-response.json', {
  390 |       capturedAt: new Date().toISOString(),
  391 |       endpoint,
  392 |       url: `${baseURL}${endpoint}`,
  393 |       method: 'GET',
  394 |       status: response.status(),
  395 |       ok: response.ok(),
  396 |       headers: response.headers(),
  397 |       bodyKind: responseBody.kind,
  398 |       body: responseBody.body,
  399 |       parseError: 'error' in responseBody ? responseBody.error : null,
  400 |     });
  401 | 
  402 |     await test.step('Validate not found behaviour', async () => {
  403 |       expect(response.status()).toBe(404);
  404 | 
  405 |       appendManifest({
  406 |         type: 'negative_validation',
  407 |         testName,
  408 |         endpoint,
  409 |         status: response.status(),
  410 |         file: 'logs/not-found-endpoint-response.json',
  411 |         message: 'Validated invalid endpoint returns 404',
  412 |       });
  413 |     });
  414 |   });
  415 | 
  416 |   test.afterAll(async () => {
  417 |     appendManifest({
  418 |       type: 'run_end',
  419 |       message: 'Completed API validation suite',
  420 |       details: { runId },
  421 |     });
  422 | 
  423 |     appendRunLog('Finished API validation suite');
  424 |   });
  425 | });
```