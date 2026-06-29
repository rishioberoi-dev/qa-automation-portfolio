# QA Automation Portfolio

A practical QA automation portfolio demonstrating structured test design, artifact-driven reporting, and cross-framework validation across **Playwright**, **Cypress**, and **Selenium**.

This repository is designed to show more than simple pass/fail automation. It demonstrates how automated tests can be structured, executed, evidenced, and documented in a way that supports debugging, defect investigation, developer handoff, tester onboarding, and portfolio review.

---

# Overview

This portfolio uses a financial dashboard scenario to demonstrate realistic QA automation approaches across multiple frameworks:

### Playwright
Used for API validation, authentication/session coverage, and dashboard validation.

### Cypress
Used for end-to-end user flow validation with UI and network checks.

### Selenium WebDriver
Used for browser-driven validation with persistent screenshots, browser-state capture, and failure evidence.

A key design objective of the repository is **traceability**. Each framework is structured to produce execution evidence such as:

- run metadata
- logs
- manifests
- screenshots
- browser-state snapshots
- readable JSON payload captures

This makes the repository valuable not only as code, but as a demonstration of practical QA engineering process and reporting quality.

---

# What This Portfolio Demonstrates

This repository is intended to demonstrate the following QA capabilities:

- designing clear and maintainable automated tests
- validating UI behaviour, API responses, and authentication flows
- capturing structured execution evidence for debugging and auditability
- organizing automation outputs in a consistent artifact model
- using multiple frameworks appropriately for different testing goals
- preserving evidence for developer handoff and tester knowledge transfer
- documenting execution and troubleshooting workflows in a professional way

---

# Framework Coverage

### Playwright

Playwright is used for broader validation across UI, API, authentication, and session behaviour.

Examples include:
- API response structure and timing validation
- authentication and session persistence checks
- protected route validation
- dashboard widget rendering checks
- refresh and reload validation
- console-error capture
- structured artifact generation through a shared utility layer

### Cypress

Cypress is used for fast end-to-end browser flow validation.

Examples include:
- login and dashboard flow validation
- UI widget verification
- network interception and API response checks
- unauthenticated route protection checks
- invalid login handling
- structured run logs, manifests, and JSON snapshots

### Selenium WebDriver

Selenium is used to demonstrate traditional browser-driven automation with persistent evidence capture.

Examples include:
- login workflow validation
- dashboard widget visibility checks
- screenshot capture
- browser-state snapshots
- structured run metadata, logs, and manifests
- preserved timeout and unexpected-failure evidence

---

# Repository Structure

    qa-automation-portfolio/
    ├── README.md
    ├── .gitignore
    ├── cypress.config.js
    ├── artifacts/
    │   ├── cypress/
    │   ├── playwright/
    │   └── selenium/
    ├── cypress/
    │   └── dashboard-flow.cy.js
    ├── playwright/
    │   ├── artifact-utils.ts
    │   ├── api-validation.spec.ts
    │   ├── auth-session.spec.ts
    │   └── financial-dashboard.spec.ts
    ├── selenium/
    │   └── dashboard.test.py
    └── docs/
        ├── QA_Automation_Portfolio_Runbook.pdf
        └── QA_Automation_Portfolio_Runbook.docx

---

# Artifact Strategy

One of the strongest aspects of this repository is the structured artifact model. Test runs are designed to produce evidence in a consistent format so results can be inspected after execution.

Typical framework output:

    artifacts/
    ├── cypress/
    │   └── <run-id>/
    │       ├── logs/
    │       ├── manifests/
    │       ├── snapshots/
    │       └── run-info.json
    ├── playwright/
    │   └── <run-id>/
    │       ├── logs/
    │       ├── manifests/
    │       ├── snapshots/
    │       └── run-info.json
    └── selenium/
        └── <run-id>/
            ├── logs/
            ├── manifests/
            ├── snapshots/
            └── run-info.json

### Artifact Types

- **run-info.json**  
  Run metadata such as framework, suite name, run ID, and timestamp

- **logs/**  
  Execution logs, API response captures, validation outputs, and failure evidence

- **manifests/**  
  Structured timeline of run events and validation steps

- **snapshots/**  
  Screenshots, browser-state JSON, and readable payload snapshots

This structure helps make test runs:
- reviewable
- repeatable
- explainable
- easier to debug
- easier to hand over to other testers or developers

---

# Why This Portfolio Adds Value

This repository is intentionally built to show **QA engineering maturity**, not just test execution.

### 1. Cross-Framework Capability
It demonstrates practical experience with:
- Playwright
- Cypress
- Selenium WebDriver

### 2. Coverage Across Multiple Validation Layers
The examples cover:
- end-to-end UI flow
- API response validation
- authentication and session management
- protected route behaviour
- dashboard rendering
- refresh and reload behaviour
- negative-path handling

### 3. Evidence-Driven QA Reporting
The repository preserves structured execution evidence rather than relying only on pass/fail output.

### 4. Handoff and Documentation Readiness
The included runbook shows how the portfolio can be understood and used operationally by:
- developers
- other testers
- QA leads
- recruiters and hiring managers

---

# Technologies Used

### Testing Frameworks
- Playwright
- Cypress
- Selenium WebDriver

### Languages
- TypeScript
- JavaScript
- Python

### QA Techniques Demonstrated
- end-to-end testing
- API validation
- authentication testing
- session management testing
- UI component validation
- protected route testing
- network interception
- screenshot capture
- browser-state capture
- structured artifact logging

---

# Installation

### Playwright

    npm install -D @playwright/test
    npx playwright install

### Cypress

    npm install -D cypress

### Selenium

    pip install selenium webdriver-manager

---

# How to Run the Tests

### Playwright API validation

    npx playwright test playwright/api-validation.spec.ts --reporter=line

### Playwright auth and session validation

    npx playwright test playwright/auth-session.spec.ts --reporter=line

### Playwright financial dashboard validation

    npx playwright test playwright/financial-dashboard.spec.ts --reporter=line

### Cypress dashboard flow

    npx cypress run --spec cypress/dashboard-flow.cy.js

### Selenium dashboard validation

    python selenium/dashboard.test.py

If your environment uses `python3`, run:

    python3 selenium/dashboard.test.py

---

# Expected Successful Output

After a successful run:

- the command completes without framework-level errors
- a new framework-specific run folder appears under `artifacts/`
- the run folder contains `run-info.json`, `logs/`, `manifests/`, and `snapshots/`
- validation evidence can be opened and reviewed without special tooling
- screenshots and JSON captures provide clear proof of execution

---

# Documentation and Runbook

This repository includes a formal runbook in the `docs/` folder:

- `QA_Automation_Portfolio_Runbook.pdf`
- `QA_Automation_Portfolio_Runbook.docx`

The runbook documents:
- repository structure
- artifact strategy
- execution guidance
- troubleshooting workflow
- knowledge transfer value
- execution evidence across frameworks

This helps present the repository as a professional QA deliverable rather than only a collection of scripts.

---

# Intended Audience

This portfolio is designed to be understandable and useful for:

- recruiters reviewing QA automation capability
- hiring managers evaluating engineering maturity
- QA leads assessing maintainability and reporting quality
- developers reviewing debugging and handoff readiness
- testers who may need to run, inspect, or extend the automation

---

# About the Author

**Rishi Oberoi**  
QA Automation / Technical QA Portfolio  
Glasgow, United Kingdom
Frankfurt, Germany

---

# Summary

This portfolio is intended to demonstrate practical, reviewable QA automation capability across modern frameworks. The value lies not only in the test scripts themselves, but in how the automation is structured, evidenced, documented, and communicated.
