describe('Financial Dashboard User Flow', () => {
  const suiteName = 'dashboard-flow';
  const runId = `${suiteName}-${Date.now()}`;
  const artifactRoot = `artifacts/cypress/${runId}`;
  const logsDir = `${artifactRoot}/logs`;
  const manifestsDir = `${artifactRoot}/manifests`;
  const snapshotsDir = `${artifactRoot}/snapshots`;

  const writeJsonArtifact = (path: string, data: unknown) => {
    cy.writeFile(path, data, { log: false });
  };

  const appendRunLog = (message: string) => {
    const line = `[${new Date().toISOString()}] ${message}\n`;

    cy.task('appendRunLog', {
      filePath: `${logsDir}/run.log`,
      content: line,
    }, { log: false });
  };

  const appendManifest = (entry: Record<string, unknown>) => {
    const manifestEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };

    cy.task('appendJsonArrayEntry', {
      filePath: `${manifestsDir}/manifest.json`,
      entry: manifestEntry,
    }, { log: false });
  };

  const logStep = (message: string, extra: Record<string, unknown> = {}) => {
    cy.log(message);
    appendRunLog(message);
    appendManifest({
      type: 'step',
      message,
      ...extra,
    });
  };

  const saveApiSnapshot = (name: string, interception: any) => {
    const responseBody = interception?.response?.body ?? null;

    const snapshot = {
      capturedAt: new Date().toISOString(),
      alias: name,
      request: {
        method: interception?.request?.method ?? null,
        url: interception?.request?.url ?? null,
      },
      response: {
        statusCode: interception?.response?.statusCode ?? null,
        statusMessage: interception?.response?.statusMessage ?? null,
        headers: interception?.response?.headers ?? {},
        body: responseBody,
      },
    };

    writeJsonArtifact(`${logsDir}/${name}.json`, snapshot);

    appendManifest({
      type: 'api_snapshot',
      name,
      statusCode: interception?.response?.statusCode ?? null,
      url: interception?.request?.url ?? null,
      file: `logs/${name}.json`,
    });

    if (responseBody) {
      writeJsonArtifact(`${snapshotsDir}/${name}.pretty.json`, responseBody);

      appendManifest({
        type: 'payload_snapshot',
        name,
        file: `snapshots/${name}.pretty.json`,
      });
    }
  };

  before(() => {
    writeJsonArtifact(`${artifactRoot}/run-info.json`, {
      runId,
      suite: 'Financial Dashboard User Flow',
      startedAt: new Date().toISOString(),
      baseUrl: 'https://example.com',
      framework: 'Cypress',
      artifactFolders: {
        logs: 'logs/',
        manifests: 'manifests/',
        snapshots: 'snapshots/',
      },
    });

    appendRunLog(`Initialized Cypress artifact directories for ${suiteName}`);

    appendManifest({
      type: 'run_start',
      message: 'Started Financial Dashboard User Flow suite',
      details: { runId, suiteName },
    });
  });

  beforeEach(() => {
    cy.visit('https://example.com/login');
    logStep('Opened login page', { page: '/login' });
  });

  after(() => {
    appendManifest({
      type: 'run_end',
      message: 'Completed Financial Dashboard User Flow suite',
      details: { runId, suiteName },
    });

    appendRunLog(`Completed suite ${suiteName}`);
  });

  it('logs in successfully and validates dashboard widgets', () => {
    cy.intercept('GET', '**/api/market-data').as('getMarketData');
    cy.intercept('GET', '**/api/ai-insights').as('getAiInsights');

    logStep('Registered network intercepts', {
      intercepts: ['getMarketData', 'getAiInsights'],
    });

    cy.get('#email').should('be.visible').type('testuser@example.com');
    cy.get('#password').should('be.visible').type('SecurePassword123', { log: false });
    logStep('Entered valid credentials', { email: 'testuser@example.com' });

    cy.get('button[type="submit"]').click();
    logStep('Submitted login form');

    cy.url().should('include', '/dashboard');
    logStep('Login successful and redirected to dashboard', { page: '/dashboard' });

    cy.wait('@getMarketData').then((interception) => {
      expect(interception.response.statusCode).to.eq(200);
      expect(interception.response.body).to.have.property('data');
      expect(interception.response.body.data).to.be.an('array').and.not.be.empty;
      expect(interception.response.body.data[0]).to.have.property('symbol');
      expect(interception.response.body.data[0]).to.have.property('price');
      expect(interception.response.body.data[0]).to.have.property('timestamp');

      saveApiSnapshot('market-data-initial', interception);
    });

    cy.wait('@getAiInsights').then((interception) => {
      expect(interception.response.statusCode).to.eq(200);
      expect(interception.response.body).to.have.property('summary');
      expect(interception.response.body).to.have.property('signals');
      expect(interception.response.body.summary).to.be.a('string').and.not.be.empty;
      expect(interception.response.body.signals).to.be.an('array');

      saveApiSnapshot('ai-insights-initial', interception);
    });

    cy.get('h1').should('be.visible').and('contain.text', 'Dashboard');
    cy.get('[data-testid="financial-graph"]').should('be.visible');
    cy.get('[data-testid="portfolio-value"]').should('be.visible').and('not.be.empty');
    cy.get('[data-testid="market-insights"]').should('be.visible');

    writeJsonArtifact(`${snapshotsDir}/dashboard-widget-validation.json`, {
      capturedAt: new Date().toISOString(),
      widgets: ['header', 'financial-graph', 'portfolio-value', 'market-insights'],
      currentPath: '/dashboard',
    });

    logStep('Validated dashboard widgets', {
      widgets: ['header', 'financial-graph', 'portfolio-value', 'market-insights'],
    });

    cy.screenshot(`cypress/${runId}/dashboard-loaded`, { capture: 'viewport' });
    appendManifest({
      type: 'screenshot',
      name: 'dashboard-loaded',
      file: `snapshots/dashboard-loaded.png`,
    });

    cy.get('[data-testid="refresh-dashboard"]').should('be.visible').click();
    logStep('Clicked refresh dashboard button');

    cy.wait('@getMarketData').then((interception) => {
      expect(interception.response.statusCode).to.eq(200);
      expect(interception.response.body.data).to.be.an('array').and.not.be.empty;

      saveApiSnapshot('market-data-refresh', interception);
    });

    cy.get('[data-testid="financial-graph"]').should('be.visible');
    logStep('Validated dashboard after refresh');

    cy.window().then((win) => {
      writeJsonArtifact(`${snapshotsDir}/browser-location.json`, {
        href: win.location.href,
        pathname: win.location.pathname,
        capturedAt: new Date().toISOString(),
      });
    });
  });

  it('blocks dashboard access for unauthenticated users', () => {
    cy.clearCookies();
    cy.clearLocalStorage();
    logStep('Cleared cookies and local storage');

    cy.visit('https://example.com/dashboard');
    cy.url().should('include', '/login');

    writeJsonArtifact(`${snapshotsDir}/unauthenticated-redirect.json`, {
      capturedAt: new Date().toISOString(),
      attemptedPath: '/dashboard',
      redirectedTo: '/login',
    });

    appendManifest({
      type: 'auth_guard',
      result: 'redirected_to_login',
      attemptedPath: '/dashboard',
      file: 'snapshots/unauthenticated-redirect.json',
    });

    cy.screenshot(`cypress/${runId}/unauthenticated-redirect`, { capture: 'viewport' });
  });

  it('shows an error for invalid login attempts', () => {
    cy.intercept('POST', '**/api/**').as('failedLoginRequest');

    cy.get('#email').type('invalid-user@example.com');
    cy.get('#password').type('WrongPassword123', { log: false });
    logStep('Entered invalid credentials', {
      email: 'invalid-user@example.com',
    });

    cy.get('button[type="submit"]').click();
    logStep('Submitted invalid login form');

    cy.url().should('include', '/login');

    cy.get('[data-testid="login-error"]')
      .should('be.visible')
      .and(($el) => {
        const text = $el.text().toLowerCase();
        expect(text).to.match(/invalid|incorrect|denied/);
      })
      .invoke('text')
      .then((errorText) => {
        writeJsonArtifact(`${logsDir}/invalid-login-error.json`, {
          capturedAt: new Date().toISOString(),
          message: errorText.trim(),
        });

        appendManifest({
          type: 'validation',
          name: 'invalid_login_error_banner',
          result: 'visible',
          message: errorText.trim(),
          file: 'logs/invalid-login-error.json',
        });
      });

    cy.screenshot(`cypress/${runId}/invalid-login-error`, { capture: 'viewport' });
  });
});
