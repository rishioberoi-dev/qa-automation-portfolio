import { test, expect, Page, APIResponse } from '@playwright/test';
import {
  createArtifactContext,
  finalizeArtifactContext,
  saveScreenshot,
  captureBrowserState,
  captureApiResponse,
  captureConsoleErrors,
} from './artifact-utils';

class LoginPage {
  constructor(private page: Page) {}

  readonly emailInput = () => this.page.locator('#email');
  readonly passwordInput = () => this.page.locator('#password');
  readonly submitButton = () => this.page.locator('button[type="submit"]');
  readonly errorBanner = () => this.page.locator('[data-testid="login-error"]');

  async goto() {
    await this.page.goto('https://example.com/login', { waitUntil: 'domcontentloaded' });
  }

  async login(email: string, password: string) {
    await this.emailInput().fill(email);
    await this.passwordInput().fill(password);
    await this.submitButton().click();
  }
}

class DashboardPage {
  constructor(private page: Page) {}

  readonly dashboardHeader = () => this.page.locator('h1');
  readonly graphContainer = () => this.page.locator('[data-testid="financial-graph"]');
  readonly portfolioValueCard = () => this.page.locator('[data-testid="portfolio-value"]');
  readonly marketInsightPanel = () => this.page.locator('[data-testid="market-insights"]');
  readonly loadingSpinner = () => this.page.locator('[data-testid="loading-spinner"]');
  readonly refreshButton = () => this.page.locator('[data-testid="refresh-dashboard"]');

  async waitForDashboardToLoad() {
    await expect(this.dashboardHeader()).toContainText(/dashboard|financial overview/i);
    await expect(this.loadingSpinner()).toHaveCount(0);
    await expect(this.graphContainer()).toBeVisible();
    await expect(this.portfolioValueCard()).toBeVisible();
    await expect(this.marketInsightPanel()).toBeVisible();
  }
}

test.describe('Financial Dashboard Validation', () => {
  const suiteName = 'financial-dashboard';
  const {
    runId,
    artifactRoot,
    appendManifest,
    appendRunLog,
    writeSnapshotArtifact,
  } = createArtifactContext(suiteName);

  test.beforeAll(async () => {
    appendRunLog('Financial Dashboard Validation suite initialized');
    appendManifest({
      type: 'suite_ready',
      message: 'Financial dashboard helpers initialized',
      details: { runId },
    });
  });

  test('authenticated user can load dashboard, validate API responses, and interact with widgets', async ({ page, context }) => {
    const testName = 'authenticated-dashboard-validation';
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    let marketDataResponse: APIResponse | null = null;
    let insightsResponse: APIResponse | null = null;

    await test.step('Navigate to login page', async () => {
      await loginPage.goto();
      await expect(page).toHaveURL(/login/);
      await expect(loginPage.emailInput()).toBeVisible();
      await expect(loginPage.passwordInput()).toBeVisible();

      appendManifest({
        type: 'navigation',
        testName,
        message: 'Opened login page',
        details: { currentUrl: page.url() },
      });

      await saveScreenshot(
        artifactRoot,
        page,
        `${testName}-login-page.png`,
        testName,
        'Login page loaded'
      );

      await captureBrowserState(
        artifactRoot,
        page,
        context,
        testName,
        'before-login'
      );
    });

    await test.step('Log in with valid credentials', async () => {
      appendRunLog(`Attempting dashboard login for ${testName}`);

      await loginPage.login('testuser@example.com', 'SecurePassword123');
      await expect(page).toHaveURL(/dashboard/);

      appendManifest({
        type: 'authentication',
        testName,
        message: 'Successfully logged in and navigated to dashboard',
        details: {
          currentUrl: page.url(),
        },
      });
    });

    await test.step('Capture dashboard API responses', async () => {
      const [marketResponse, aiInsightsResponse] = await Promise.all([
        page.waitForResponse(response =>
          response.url().includes('/api/market-data') &&
          response.request().method() === 'GET' &&
          response.status() === 200
        ),
        page.waitForResponse(response =>
          response.url().includes('/api/ai-insights') &&
          response.request().method() === 'GET' &&
          response.status() === 200
        ),
      ]);

      marketDataResponse = marketResponse;
      insightsResponse = aiInsightsResponse;

      await captureApiResponse(
        artifactRoot,
        marketDataResponse,
        `${testName}-market-data-initial.json`,
        testName,
        'market-data-initial'
      );

      await captureApiResponse(
        artifactRoot,
        insightsResponse,
        `${testName}-ai-insights-initial.json`,
        testName,
        'ai-insights-initial'
      );
    });

    await test.step('Validate dashboard UI components are fully rendered', async () => {
      await dashboardPage.waitForDashboardToLoad();
      await expect(dashboardPage.graphContainer()).toHaveCount(1);
      await expect(dashboardPage.portfolioValueCard()).not.toBeEmpty();
      await expect(dashboardPage.marketInsightPanel()).toContainText(/market|insight|trend/i);

      writeSnapshotArtifact(`${testName}-ui-validation.json`, {
        capturedAt: new Date().toISOString(),
        currentUrl: page.url(),
        validatedWidgets: [
          'dashboardHeader',
          'graphContainer',
          'portfolioValueCard',
          'marketInsightPanel',
        ],
      });

      appendManifest({
        type: 'ui_validation',
        testName,
        message: 'Validated dashboard UI components are fully rendered',
        file: `snapshots/${testName}-ui-validation.json`,
        details: {
          validatedWidgets: [
            'dashboardHeader',
            'graphContainer',
            'portfolioValueCard',
            'marketInsightPanel',
          ],
        },
      });

      await saveScreenshot(
        artifactRoot,
        page,
        `${testName}-dashboard-loaded.png`,
        testName,
        'Dashboard fully rendered'
      );

      await captureBrowserState(
        artifactRoot,
        page,
        context,
        testName,
        'dashboard-loaded'
      );
    });

    await test.step('Validate market data API payload structure', async () => {
      expect(marketDataResponse).not.toBeNull();

      const marketJson = await marketDataResponse!.json();

      expect(Array.isArray(marketJson.data)).toBeTruthy();
      expect(marketJson.data.length).toBeGreaterThan(0);

      const firstItem = marketJson.data[0];
      expect(firstItem).toHaveProperty('symbol');
      expect(firstItem).toHaveProperty('price');
      expect(firstItem).toHaveProperty('timestamp');

      expect(typeof firstItem.symbol).toBe('string');
      expect(typeof firstItem.price).toBe('number');
      expect(firstItem.price).toBeGreaterThan(0);

      writeSnapshotArtifact(`${testName}-market-data-pretty.json`, marketJson);

      appendManifest({
        type: 'payload_validation',
        testName,
        file: `snapshots/${testName}-market-data-pretty.json`,
        message: 'Validated market data payload structure',
        details: {
          itemCount: marketJson.data.length,
          firstSymbol: firstItem.symbol,
        },
      });
    });

    await test.step('Validate AI insights API payload structure', async () => {
      expect(insightsResponse).not.toBeNull();

      const insightsJson = await insightsResponse!.json();

      expect(insightsJson).toHaveProperty('summary');
      expect(insightsJson).toHaveProperty('signals');
      expect(typeof insightsJson.summary).toBe('string');
      expect(insightsJson.summary.length).toBeGreaterThan(10);
      expect(Array.isArray(insightsJson.signals)).toBeTruthy();

      writeSnapshotArtifact(`${testName}-ai-insights-pretty.json`, insightsJson);

      appendManifest({
        type: 'payload_validation',
        testName,
        file: `snapshots/${testName}-ai-insights-pretty.json`,
        message: 'Validated AI insights payload structure',
        details: {
          summaryLength: insightsJson.summary.length,
          signalCount: insightsJson.signals.length,
        },
      });
    });

    await test.step('Verify refresh interaction reloads dashboard data correctly', async () => {
      const refreshResponsePromise = page.waitForResponse(response =>
        response.url().includes('/api/market-data') &&
        response.request().method() === 'GET' &&
        response.status() === 200
      );

      await dashboardPage.refreshButton().click();

      const refreshResponse = await refreshResponsePromise;
      const refreshedBody = await captureApiResponse(
        artifactRoot,
        refreshResponse,
        `${testName}-market-data-refresh.json`,
        testName,
        'market-data-refresh'
      );

      const refreshedJson = refreshedBody as { data: unknown[] };

      expect(Array.isArray(refreshedJson.data)).toBeTruthy();
      expect(refreshedJson.data.length).toBeGreaterThan(0);
      await expect(dashboardPage.graphContainer()).toBeVisible();

      writeSnapshotArtifact(`${testName}-refresh-validation.json`, {
        capturedAt: new Date().toISOString(),
        refreshedItemCount: refreshedJson.data.length,
        currentUrl: page.url(),
      });

      appendManifest({
        type: 'interaction_validation',
        testName,
        message: 'Validated dashboard refresh interaction reloads data correctly',
        file: `snapshots/${testName}-refresh-validation.json`,
        details: {
          refreshedItemCount: refreshedJson.data.length,
        },
      });

      await saveScreenshot(
        artifactRoot,
        page,
        `${testName}-after-refresh.png`,
        testName,
        'Dashboard after refresh'
      );
    });

    await test.step('Confirm there are no critical front-end console errors', async () => {
      await captureConsoleErrors(
        artifactRoot,
        page,
        testName,
        'dashboard-reload',
        async () => {
          await page.reload({ waitUntil: 'networkidle' });
          await dashboardPage.waitForDashboardToLoad();
        }
      );

      writeSnapshotArtifact(`${testName}-reload-validation.json`, {
        capturedAt: new Date().toISOString(),
        currentUrl: page.url(),
        reloadSuccessful: true,
      });

      appendManifest({
        type: 'console_validation',
        testName,
        message: 'Verified dashboard reload without critical console errors',
        file: `snapshots/${testName}-reload-validation.json`,
        details: {
          currentUrl: page.url(),
        },
      });

      await captureBrowserState(
        artifactRoot,
        page,
        context,
        testName,
        'after-reload'
      );

      await saveScreenshot(
        artifactRoot,
        page,
        `${testName}-after-reload.png`,
        testName,
        'Dashboard after reload without critical console errors'
      );
    });
  });

  test.afterAll(async () => {
    finalizeArtifactContext(artifactRoot, suiteName, runId);
  });
});
