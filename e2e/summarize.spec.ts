import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ARTICLE_URL, MOCK_AI_SUMMARY } from "./support/fixtures";

const urlInput = (page: Page) => page.locator("#url-input");
const submitButton = (page: Page) => page.locator("form.url-form button[type=submit]");

async function summarize(page: Page, url: string) {
  await urlInput(page).fill(url);
  await submitButton(page).click();
}

test.beforeEach(async ({ page }) => {
  // Collect CSP violations from the very first script so a broken policy fails the test.
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      (window as unknown as { __csp: string[] }).__csp.push(event.violatedDirective);
    });
  });
  await page.goto("/");
});

test.describe("first load", () => {
  test("shows the URL form and a sample brief, with no stray validation error", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Webpage brief" })).toBeVisible();
    await expect(urlInput(page)).toBeVisible();
    await expect(page.getByText("Sample preview")).toBeVisible();
    await expect(page.locator("#url-error")).toBeHidden();
  });

  test("runs under the strict Content Security Policy without violations", async ({ page }) => {
    await summarize(page, ARTICLE_URL);
    await expect(page.locator("#summary-headline")).toHaveText(MOCK_AI_SUMMARY.headline);
    const violations = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
    expect(violations).toEqual([]);
  });

  test("has no serious or critical accessibility violations", async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

test.describe("URL validation", () => {
  test("blocks an empty submit with an inline error", async ({ page }) => {
    await submitButton(page).click();
    await expect(page.locator("#url-error")).toBeVisible();
    await expect(page.locator("#url-error")).toContainText("Enter a webpage URL");
    await expect(urlInput(page)).toHaveAttribute("aria-invalid", "true");
    await expect(urlInput(page)).toBeFocused();
  });

  test("rejects text that is not a web address", async ({ page }) => {
    await summarize(page, "not a url");
    await expect(page.locator("#url-error")).toBeVisible();
    await expect(page.locator(".loading-card")).toHaveCount(0);
  });

  test("adds https:// to a bare domain before sending it", async ({ page }) => {
    await summarize(page, "blog.example.com/http-caching-basics");
    await expect(page.locator("#summary-headline")).toHaveText(MOCK_AI_SUMMARY.headline);
    await expect(urlInput(page)).toHaveValue(ARTICLE_URL);
  });
});

test.describe("summarising a page", () => {
  test("shows a loading indicator, then the structured AI brief", async ({ page }) => {
    await summarize(page, "https://blog.example.com/slow-article");

    await expect(page.getByRole("progressbar")).toBeVisible();
    await expect(page.getByText("Reading blog.example.com")).toBeVisible();
    await expect(submitButton(page)).toBeDisabled();
    await expect(submitButton(page)).toHaveText(/Summarizing/);

    await expect(page.locator("#summary-headline")).toHaveText(MOCK_AI_SUMMARY.headline, { timeout: 10_000 });
    await expect(page.locator(".summary-prose")).toHaveText(MOCK_AI_SUMMARY.summary);
    await expect(page.locator(".takeaway-row")).toHaveCount(MOCK_AI_SUMMARY.keyPoints.length);
    for (const topic of MOCK_AI_SUMMARY.topics) {
      await expect(page.locator(".topic-tag", { hasText: topic })).toBeVisible();
    }
    await expect(page.locator(".generation-meta")).toContainText("gemini-3.5-flash-lite");
    await expect(page.getByText("Sample preview")).toHaveCount(0);
    await expect(page).toHaveTitle(`${MOCK_AI_SUMMARY.headline} — SnapRead`);
  });

  test("lets the user cancel a slow request", async ({ page }) => {
    await summarize(page, "https://blog.example.com/slow-cancel");
    await expect(page.getByRole("progressbar")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await expect(submitButton(page)).toBeEnabled();
  });

  test("adds each brief to the session history", async ({ page }) => {
    await summarize(page, ARTICLE_URL);
    await expect(page.locator("#summary-headline")).toHaveText(MOCK_AI_SUMMARY.headline);
    const history = page.getByRole("complementary", { name: "Reading workspace navigation" });
    await expect(history.getByRole("button", { name: new RegExp(MOCK_AI_SUMMARY.headline) })).toBeVisible();
  });

  test("shows the extracted text the summary was based on", async ({ page }) => {
    await summarize(page, ARTICLE_URL);
    await page.getByText("Extracted visible text").click();
    await expect(page.locator(".excerpt-text")).toContainText("Cache-Control header is the main switch");
  });

  test("copies the brief as plain text", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Clipboard permission is a Chromium-only Playwright feature");
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await summarize(page, ARTICLE_URL);
    await page.getByRole("button", { name: "Copy brief" }).click();
    await expect(page.locator(".copy-tip")).toHaveText(/Copied/);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain(MOCK_AI_SUMMARY.headline);
    expect(copied).toContain(`Source: ${ARTICLE_URL}`);
  });
});

test.describe("errors and fallbacks", () => {
  test("explains upstream failures and offers a retry", async ({ page }) => {
    await summarize(page, "https://blog.example.com/upstream-blocked");
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("Could not summarize this webpage");
    await expect(alert).toContainText("blocked automated access");
    await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("tells the user when the offline summariser answered instead of Gemini", async ({ page }) => {
    await summarize(page, "https://blog.example.com/fallback-article");
    await expect(page.locator(".fallback-notice")).toContainText("Gemini rejected the API key");
    await expect(page.locator(".generation-meta")).toContainText("extractive-nlp (free)");
    await expect(page.locator(".summary-prose")).not.toBeEmpty();
  });

  test("shows a friendly message when the API rate limit is hit", async ({ page }) => {
    await page.route("**/api/summarize", (route) =>
      route.fulfill({
        status: 429,
        headers: { "Retry-After": "42" },
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "RATE_LIMITED", message: "Too many summaries from this connection. Please wait 42s and try again." },
        }),
      })
    );
    await summarize(page, ARTICLE_URL);
    await expect(page.getByRole("alert")).toContainText("Please wait 42s");
  });

  test("tells the user when the backend cannot be reached", async ({ page }) => {
    await page.route("**/api/summarize", (route) => route.abort("connectionrefused"));
    await summarize(page, ARTICLE_URL);
    await expect(page.getByRole("alert")).toContainText("Could not reach the SnapRead API server");
  });
});

test.describe("security", () => {
  test("renders HTML from the AI as plain text, never as markup", async ({ page }) => {
    let dialogOpened = false;
    page.on("dialog", async (dialog) => {
      dialogOpened = true;
      await dialog.dismiss();
    });

    await summarize(page, "https://blog.example.com/xss-article");
    await expect(page.locator("#summary-headline")).toContainText("<img src=x");
    await expect(page.locator(".summary-card img, .summary-card script")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect(dialogOpened).toBe(false);
  });
});

test.describe("preferences and keyboard", () => {
  test("switches between light and dark themes", async ({ page }) => {
    const toggle = page.getByRole("button", { name: /theme/i });
    const initial = await toggle.getAttribute("aria-pressed");
    await toggle.click();
    const expected = initial === "true" ? "light" : "dark";
    await expect(page.locator("html")).toHaveAttribute("data-theme", expected);
  });

  test("focuses the URL field with the / shortcut", async ({ page, isMobile }) => {
    test.skip(isMobile, "Keyboard shortcut is a desktop feature");
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("/");
    await expect(urlInput(page)).toBeFocused();
  });

  test("summarises after typing a URL and pressing Enter", async ({ page }) => {
    await urlInput(page).fill(ARTICLE_URL);
    await urlInput(page).press("Enter");
    await expect(page.locator("#summary-headline")).toHaveText(MOCK_AI_SUMMARY.headline);
  });
});
