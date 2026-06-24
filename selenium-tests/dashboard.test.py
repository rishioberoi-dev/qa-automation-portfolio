from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager


BASE_URL = "https://example.com"
RUN_ID = f"selenium-dashboard-{datetime.utcnow().strftime('%Y%m%dT%H%M%S')}"
ARTIFACT_ROOT = Path("artifacts") / "selenium" / RUN_ID
DEFAULT_TIMEOUT = 10


@dataclass
class ManifestEntry:
    timestamp: str
    type: str
    message: str
    file: str | None = None
    details: dict | None = None


class ArtifactLogger:
    def __init__(self, artifact_root: Path) -> None:
        self.artifact_root = artifact_root
        self.logs_dir = self.artifact_root / "logs"
        self.manifests_dir = self.artifact_root / "manifests"
        self.snapshots_dir = self.artifact_root / "snapshots"

        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.manifests_dir.mkdir(parents=True, exist_ok=True)
        self.snapshots_dir.mkdir(parents=True, exist_ok=True)

        self.manifest_path = self.manifests_dir / "manifest.json"
        self.run_log_path = self.logs_dir / "run.log"

        if not self.manifest_path.exists():
            self._write_json(self.manifest_path, [])

    def _write_json(self, path: Path, data) -> None:
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def append_run_log(self, message: str) -> None:
        line = f"[{datetime.utcnow().isoformat()}Z] {message}\n"
        with self.run_log_path.open("a", encoding="utf-8") as log_file:
            log_file.write(line)

    def write_root_json(self, file_name: str, data) -> None:
        self._write_json(self.artifact_root / file_name, data)

    def write_log_json(self, file_name: str, data) -> None:
        self._write_json(self.logs_dir / file_name, data)

    def write_snapshot_json(self, file_name: str, data) -> None:
        self._write_json(self.snapshots_dir / file_name, data)

    def append_manifest(
        self,
        entry_type: str,
        message: str,
        file_name: str | None = None,
        details: dict | None = None,
    ) -> None:
        existing = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        existing.append(
            asdict(
                ManifestEntry(
                    timestamp=datetime.utcnow().isoformat() + "Z",
                    type=entry_type,
                    message=message,
                    file=file_name,
                    details=details,
                )
            )
        )
        self._write_json(self.manifest_path, existing)

        log_parts = [entry_type, message]
        if file_name:
            log_parts.append(f"file={file_name}")
        if details:
            log_parts.append(f"details={json.dumps(details, default=str)}")
        self.append_run_log(" | ".join(log_parts))

    def save_screenshot(self, driver: WebDriver, file_name: str, message: str) -> None:
        path = self.snapshots_dir / file_name
        driver.save_screenshot(str(path))
        self.append_manifest(
            entry_type="screenshot",
            message=message,
            file_name=f"snapshots/{file_name}",
            details={"path": str(path)},
        )


class LoginPage:
    def __init__(self, driver: WebDriver, timeout: int = DEFAULT_TIMEOUT) -> None:
        self.driver = driver
        self.wait = WebDriverWait(driver, timeout)

    def email_input(self):
        return self.wait.until(EC.visibility_of_element_located((By.ID, "email")))

    def password_input(self):
        return self.wait.until(EC.visibility_of_element_located((By.ID, "password")))

    def login_button(self):
        return self.wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit']"))
        )

    def error_banner(self):
        return self.wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "[data-testid='login-error']"))
        )

    def goto(self) -> None:
        self.driver.get(f"{BASE_URL}/login")

    def login(self, email: str, password: str) -> None:
        self.email_input().clear()
        self.email_input().send_keys(email)
        self.password_input().clear()
        self.password_input().send_keys(password)
        self.login_button().click()


class DashboardPage:
    def __init__(self, driver: WebDriver, timeout: int = DEFAULT_TIMEOUT) -> None:
        self.driver = driver
        self.wait = WebDriverWait(driver, timeout)

    def dashboard_header(self):
        return self.wait.until(EC.visibility_of_element_located((By.TAG_NAME, "h1")))

    def financial_graph(self):
        return self.wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "[data-testid='financial-graph']"))
        )

    def portfolio_value(self):
        return self.wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "[data-testid='portfolio-value']"))
        )

    def market_insights(self):
        return self.wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "[data-testid='market-insights']"))
        )

    def wait_for_dashboard(self) -> None:
        self.wait.until(EC.url_contains("/dashboard"))
        self.dashboard_header()
        self.financial_graph()
        self.portfolio_value()
        self.market_insights()


def create_driver() -> WebDriver:
    chrome_options = Options()
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--disable-notifications")
    chrome_options.add_argument("--disable-infobars")

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=chrome_options,
    )
    return driver


def capture_browser_state(driver: WebDriver, logger: ArtifactLogger, label: str) -> None:
    local_storage = driver.execute_script(
        """
        const items = {};
        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            items[key] = window.localStorage.getItem(key);
        }
        return items;
        """
    )
    session_storage = driver.execute_script(
        """
        const items = {};
        for (let i = 0; i < window.sessionStorage.length; i++) {
            const key = window.sessionStorage.key(i);
            items[key] = window.sessionStorage.getItem(key);
        }
        return items;
        """
    )

    file_name = f"{label}-browser-state.json"
    logger.write_snapshot_json(
        file_name,
        {
            "capturedAt": datetime.utcnow().isoformat() + "Z",
            "label": label,
            "url": driver.current_url,
            "title": driver.title,
            "cookies": driver.get_cookies(),
            "localStorage": local_storage,
            "sessionStorage": session_storage,
        },
    )
    logger.append_manifest(
        entry_type="browser_state",
        message=f"Captured browser state for {label}",
        file_name=f"snapshots/{file_name}",
        details={
            "url": driver.current_url,
            "localStorageKeys": list(local_storage.keys()),
            "sessionStorageKeys": list(session_storage.keys()),
            "cookieCount": len(driver.get_cookies()),
        },
    )


def test_dashboard_flow() -> None:
    logger = ArtifactLogger(ARTIFACT_ROOT)
    driver = create_driver()

    logger.write_root_json(
        "run-info.json",
        {
            "runId": RUN_ID,
            "framework": "Selenium",
            "suite": "Financial Dashboard Flow",
            "startedAt": datetime.utcnow().isoformat() + "Z",
            "baseUrl": BASE_URL,
            "artifactFolders": {
                "logs": "logs/",
                "manifests": "manifests/",
                "snapshots": "snapshots/",
            },
        },
    )
    logger.append_manifest(
        entry_type="run_start",
        message="Started Selenium dashboard validation run",
        details={"runId": RUN_ID},
    )

    try:
        login_page = LoginPage(driver)
        dashboard_page = DashboardPage(driver)

        logger.append_run_log("Navigating to login page")
        login_page.goto()
        logger.append_manifest(
            entry_type="navigation",
            message="Opened login page",
            details={"url": driver.current_url},
        )
        logger.save_screenshot(driver, "login-page.png", "Captured login page")
        capture_browser_state(driver, logger, "before-login")

        logger.append_run_log("Attempting valid login")
        login_page.login("testuser@example.com", "SecurePassword123")
        dashboard_page.wait_for_dashboard()

        logger.append_manifest(
            entry_type="authentication",
            message="Valid user logged in and dashboard loaded",
            details={"url": driver.current_url},
        )
        logger.save_screenshot(driver, "dashboard-loaded.png", "Captured loaded dashboard")
        capture_browser_state(driver, logger, "after-login")

        header = dashboard_page.dashboard_header()
        graph = dashboard_page.financial_graph()
        portfolio = dashboard_page.portfolio_value()
        insights = dashboard_page.market_insights()

        assert header.is_displayed(), "Dashboard header is not visible"
        assert graph.is_displayed(), "Financial graph is not visible"
        assert portfolio.is_displayed(), "Portfolio value card is not visible"
        assert insights.is_displayed(), "Market insights panel is not visible"

        logger.write_log_json(
            "ui-validation.json",
            {
                "capturedAt": datetime.utcnow().isoformat() + "Z",
                "headerText": header.text,
                "widgets": {
                    "financialGraphVisible": graph.is_displayed(),
                    "portfolioValueVisible": portfolio.is_displayed(),
                    "marketInsightsVisible": insights.is_displayed(),
                },
            },
        )
        logger.append_manifest(
            entry_type="ui_validation",
            message="Validated dashboard widgets successfully",
            file_name="logs/ui-validation.json",
            details={
                "headerText": header.text,
                "validatedWidgets": [
                    "dashboard_header",
                    "financial_graph",
                    "portfolio_value",
                    "market_insights",
                ],
            },
        )

    except TimeoutException as exc:
        logger.save_screenshot(driver, "timeout-failure.png", "Captured browser on timeout failure")
        logger.write_log_json(
            "failure-timeout.json",
            {
                "capturedAt": datetime.utcnow().isoformat() + "Z",
                "errorType": "TimeoutException",
                "message": str(exc),
                "url": driver.current_url,
            },
        )
        logger.append_manifest(
            entry_type="failure",
            message="Test failed due to timeout",
            file_name="logs/failure-timeout.json",
            details={"url": driver.current_url},
        )
        raise

    except Exception as exc:
        logger.save_screenshot(driver, "unexpected-failure.png", "Captured browser on unexpected failure")
        logger.write_log_json(
            "failure-unexpected.json",
            {
                "capturedAt": datetime.utcnow().isoformat() + "Z",
                "errorType": exc.__class__.__name__,
                "message": str(exc),
                "url": driver.current_url,
            },
        )
        logger.append_manifest(
            entry_type="failure",
            message="Test failed due to unexpected exception",
            file_name="logs/failure-unexpected.json",
            details={"url": driver.current_url},
        )
        raise

    finally:
        logger.append_manifest(
            entry_type="run_end",
            message="Completed Selenium dashboard validation run",
            details={"runId": RUN_ID},
        )
        driver.quit()


if __name__ == "__main__":
    test_dashboard_flow()
