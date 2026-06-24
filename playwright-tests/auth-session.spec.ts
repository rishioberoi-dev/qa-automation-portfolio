import { test, expect, Page } from '@playwright/test';
import {
  createArtifactContext,
  finalizeArtifactContext,
  saveScreenshot,
  captureBrowserState,
  captureConsoleErrors,
} from './artifact-utils';

class LoginPage {
  constructor(private page: Page) {}

  readonly emailInput = () => this.page.locator('#email');
  readonly passwordInput = () => this.page.locator('#password');
  readonly submitButton = () => this.page.locator('button[type="submit"]');
  readonly errorMessage = () => this.page.locator('[data-testid="login-error"]');

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
  readonly profileMenuButton = () => this.page.locator('[data-testid="profile-menu-button"]');
  readonly logoutButton = () => this.page.locator('[data-testid="logout-button"]');

  async waitForLoad() {
    await expect(this.dashboardHeader()).toContainText(/dashboard|financial overview/i);
  }

  async logout() {
    await this.profileMenuButton().click();
    await this.logoutButton().click();
  }
}

test.describe('Authentication and Session Management', () => {
  const suiteName = 'auth-session';
  const {
    runId,
    artifactRoot,
    appendManifest,
    appendRunLog,
    writeLogArtifact,
    writeSnapshotArtifact,
  } = createArtifactContext(suiteName);

  test.beforeAll(async () => {
    appendRunLog('Authentication and Session Management suite initialized');
    appendManifest({
      type: 'suite_ready',
      message: 'Authentication and session helpers initialized',
      details: { runId },
    });
  });

  test('valid user can log in and access protected dashboard route', async ({ page, context }) => {
    const testName = 'valid-login-access-dashboard';
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await test.step('Navigate to login page', async () => {
      await loginPage.goto();
      await expect(page).toHaveURL(/login/);

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

    await test.step('Authenticate with valid credentials', async () => {
      appendRunLog(`Attempting valid login for ${testName}`);

      await loginPage.login('testuser@example.com', 'SecurePassword123');
      await expect(page).toHaveURL(/dashboard/);
      await dashboardPage.waitForLoad();

      appendManifest({
        type: 'authentication',
        testName,
        message: 'Valid login succeeded and dashboard loaded',
        details: { currentUrl: page.url() },
      });

      await saveScreenshot(
        artifactRoot,
        page,
        `${testName}-dashboard.png`,
        testName,
        'Dashboard visible after valid login'
      );

      await captureBrowserState(
        artifactRoot,
        page,
        context,
        testName,
        'after-valid-login'
      );
    });

    await test.step('Verify protected dashboard content is visible', async () => {
      await expect(dashboardPage.dashboardHeader()).toBeVisible();

      writeSnapshotArtifact(`${testName}-protected-dashboard-check.json`, {
        capturedAt: new Date().toISOString(),
        currentUrl: page.url(),
        dashboardHeaderVisible: true,
      });

      appendManifest({
        type: 'validation_step',
        testName,
        message: 'Verified protected dashboard content is visible',
        file: `snapshots/${testName}-protected-dashboard-check.json`,
        details: { currentUrl: page.url() },
      });
    });
  });

  test('invalid login attempt shows authentication error and blocks access', async ({ page, context }) => {
    const testName = 'invalid-login-blocked';
    const loginPage = new LoginPage(page);

    await test.step('Navigate to login page', async () => {
      await loginPage.goto();

      appendManifest({
        type: 'navigation',
        testName,
        message: 'Opened login page for invalid login scenario',
        details: { currentUrl: page.url() },
      });

      await saveScreenshot(
        artifactRoot,
        page,
        `${testName}-login-page.png`,
        testName,
        'Login page loaded for invalid login scenario'
      );
    });

    await test.step('Attempt login with invalid credentials', async () => {
      appendRunLog(`Attempting invalid login for ${testName}`);
      await loginPage.login('invalid-user@example.com', 'WrongPassword123');
    });

    await test.step('Verify access is denied', async () => {
      await expect(page).toHaveURL(/login/);
      await expect(loginPage.errorMessage()).toBeVisible();
      await expect(loginPage.errorMessage()).toContainText(/invalid|incorrect|denied/i);

      const errorText = (await loginPage.errorMessage().textContent())?.trim() ?? '';

      writeLogArtifact(`${testName}-error-banner.json`, {
        capturedAt: new Date().toISOString(),
        currentUrl: page.url(),
        errorMessage: errorText,
      });

      appendManifest({
        type: 'negative_validation',
        testName,
        message: 'Verified invalid login is blocked with visible error banner',
        file: `logs/${testName}-error-banner.json`,
        details: {
          currentUrl: page.url(),
          errorMessage: errorText,
        },
      });

      await saveScreenshot(
        artifactRoot,
        page,
        `${testName}-error-banner.png`,
        testName,
        'Invalid login error displayed'
      );

      await captureBrowserState(
        artifactRoot,
        page,
        context,
        testName,
        'after-invalid-login'
      );
    });
  });

  test('unauthenticated user is redirected when attempting direct access to protected route', async ({ page, context }) => {
    const testName = 'unauthenticated-redirect-protected-route';

    await test.step('Attempt to open protected route without session', async () => {
      appendRunLog(`Attempting protected route access without session for ${testName}`);
      await page.goto('https://example.com/dashboard', { waitUntil: 'domcontentloaded' });
    });

    await test.step('Verify redirect to login page', async () => {
      await expect(page).toHaveURL(/login/);

      writeSnapshotArtifact(`${testName}-redirect-check.json`, {
        capturedAt: new Date().toISOString(),
        attemptedUrl: 'https://example.com/dashboard',
        finalUrl: page.url(),
      });

      appendManifest({
        type: 'auth_guard',
        testName,
        message: 'Verified unauthenticated access redirects to login',
        file: `snapshots/${testName}-redirect-check.json`,
        details: {
          attemptedUrl: 'https://example.com/dashboard',
          finalUrl: page.url(),
        },
      });

      await saveScreenshot(
        artifactRoot,
        page,
        `${testName}-redirected-login.png`,
        testName,
        'Unauthenticated user redirected to login'
      );

      await captureBrowserState(
        artifactRoot,
        page,
        context,
        testName,
        'after-protected-route-redirect'
      );
    });
  });

  test('authenticated session persists after page refresh', async ({ page, context }) => {
    const testName = 'session-persists-after-refresh';
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await test.step('Log in successfully', async () => {
      await loginPage.goto();
      await loginPage.login('testuser@example.com', 'SecurePassword123');
      await expect(page).toHaveURL(/dashboard/);
      await dashboardPage.waitForLoad();

      appendManifest({
        type: 'authentication',
        testName,
        message: 'Logged in successfully before refresh validation',
        details: { currentUrl: page.url() },
      });

      await captureBrowserState(
        artifactRoot,
        page,
        context,
        testName,
        'before-refresh'
      );

      await saveScreenshot(
        artifactRoot,
        page,
        `${testName}-before-refresh.png`,
        testName,
        'Dashboard before refresh'
      );
    });

    await test.step('Refresh page and verify session persistence', async () => {
      await captureConsoleErrors(
        artifactRoot,
        page,
        testName,
        'page-refresh',
        async () => {
          await page.reload({ waitUntil: 'networkidle' });
          await expect(page).toHaveURL(/dashboard/);
          await dashboardPage.waitForLoad();
        }
      );

      writeSnapshotArtifact(`${testName}-refresh-check.json`, {
        capturedAt: new Date().toISOString(),
        currentUrl: page.url(),
        sessionPersisted: true,
      });

      appendManifest({
        type: 'session_validation',
        testName,
        message: 'Verified authenticated session persists after refresh',
        file: `snapshots/${testName}-refresh-check.json`,
        details: { currentUrl: page.url() },
      });

      await captureBrowserState(
        artifactRoot,
        page,
        context,
        testName,
        'after-refresh'
      );

      await saveScreenshot(
        artifactRoot,
        page,
        `${testName}-after-refresh.png`,
        testName,
        'Dashboard after refresh'
      );
    });
  });

  test('user can log out and loses access to protected route', async ({ page, context }) => {
    const testName = 'logout-revokes-protected-access';
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await test.step('Authenticate successfully', async () => {
      await loginPage.goto();
      await loginPage.login('testuser@example.com', 'SecurePassword123');
      await expect(page).toHaveURL(/dashboard/);
      await dashboardPage.waitForLoad();

      appendManifest({
        type: 'authentication',
        testName,
        message: 'Logged in successfully before logout validation',
        details: { currentUrl: page.url() },
      });

      await captureBrowserState(
        artifactRoot,
        page,
        context,
        testName,
        'before-logout'
      );

      await saveScreenshot(
        artifactRoot,
        page,
        `${testName}-before-logout.png`,
        testName,
        'Dashboard before logout'
      );
    });

    await test.step('Log out from the application', async () => {
      appendRunLog(`Logging out during ${testName}`);
      await dashboardPage.logout();
    });

    await test.step('Verify user is redirected to login page', async () => {
      await expect(page).toHaveURL(/login/);

      appendManifest({
        type: 'logout_validation',
        testName,
        message: 'Verified user is redirected to login after logout',
        details: { currentUrl: page.url() },
      });

      await captureBrowserState(
        artifactRoot,
        page,
        context,
        testName,
        'after-logout'
      );

      await saveScreenshot(
        artifactRoot,
        page,
        `${testName}-after-logout.png`,
        testName,
        'User redirected to login after logout'
      );
    });

    await test.step('Verify protected route is no longer accessible', async () => {
      await page.goto('https://example.com/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/login/);

      writeSnapshotArtifact(`${testName}-post-logout-check.json`, {
        capturedAt: new Date().toISOString(),
        attemptedUrl: 'https://example.com/dashboard',
        finalUrl: page.url(),
      });

      appendManifest({
        type: 'auth_guard',
        testName,
        file: `snapshots/${testName}-post-logout-check.json`,
        message: 'Verified protected route is no longer accessible after logout',
        details: {
          attemptedUrl: 'https://example.com/dashboard',
          finalUrl: page.url(),
        },
      });

      await captureBrowserState(
        artifactRoot,
        page,
        context,
        testName,
        'post-logout-protected-route-check'
      );
    });
  });

  test.afterAll(async () => {
    finalizeArtifactContext(artifactRoot, suiteName, runId);
  });
});
