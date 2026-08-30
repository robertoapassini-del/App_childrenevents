import { expect, test, type Page } from "@playwright/test";

/**
 * The end-to-end smoke test: does a parent's actual path through the app work?
 *
 * Assertions are on the DOM, never on rendered map imagery — OpenStreetMap tiles
 * are unreachable from the sandbox this runs in, and a test that depends on
 * third-party tiles would fail for reasons that have nothing to do with the app.
 * Tile requests are stubbed so the map still initialises.
 */

const CARD = "main ul li button";

/** Stand in for the tiles, which we can neither reach nor meaningfully assert on. */
async function stubTiles(page: Page) {
  await page.route(/tile\.openstreetmap\.org/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e9e0d3"/></svg>',
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await stubTiles(page);
});

test("the map loads with activities and a legend", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Ouistiti" })).toBeVisible();
  await expect(page.locator(CARD).first()).toBeVisible();

  // The age legend is the key to the pin colours, so it has to be present.
  await expect(page.getByLabel(/code couleur par âge/i)).toBeVisible();

  // Leaflet mounted and drew pins.
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".ouistiti-pin").first()).toBeVisible();
});

test("the bottom sheet moves between its two positions", async ({ page }) => {
  await page.goto("/");

  const sheet = page.getByRole("region", { name: /carte/i });
  const handle = page.getByRole("button", { name: /agrandir ou réduire/i });

  await expect(handle).toHaveAttribute("aria-expanded", "false");
  const peek = (await sheet.boundingBox())!.height;

  await handle.click();
  await expect(handle).toHaveAttribute("aria-expanded", "true");
  // The transition has to finish before the height means anything.
  await expect
    .poll(async () => (await sheet.boundingBox())!.height, { timeout: 5000 })
    .toBeGreaterThan(peek * 1.5);

  await handle.click();
  await expect(handle).toHaveAttribute("aria-expanded", "false");
  await expect
    .poll(async () => (await sheet.boundingBox())!.height, { timeout: 5000 })
    .toBeCloseTo(peek, 0);
});

test("overlapping pins collapse into a counted cluster", async ({ page }) => {
  await page.goto("/");

  // Central Lausanne puts several activities within a few hundred metres, so at
  // the default zoom at least one cluster must exist rather than a pin stack.
  const clusters = page.locator(".ouistiti-cluster");
  await expect(clusters.first()).toBeVisible();

  // A cluster shows how many it stands for.
  await expect(clusters.first()).toHaveText(/^\d+$/);

  // Zooming right in must break them apart again.
  await page.locator(".ouistiti-cluster").first().click();
  await page.waitForTimeout(1200);
  await expect(page.locator(".ouistiti-pin").first()).toBeVisible();
});

test("filtering by age narrows the list and survives a reload", async ({ page }) => {
  await page.goto("/");
  const before = await page.locator(CARD).count();
  expect(before).toBeGreaterThan(3);

  await page.getByRole("button", { name: "Bébés", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bébés", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // The list re-fetches, so wait for the count to settle rather than racing it.
  await expect
    .poll(async () => page.locator(CARD).count(), { timeout: 10_000 })
    .toBeLessThan(before);

  // The filter lives in the URL — that's what makes a filtered view shareable.
  await expect(page).toHaveURL(/age=infant/);

  const filtered = await page.locator(CARD).count();
  await page.reload();
  await expect
    .poll(async () => page.locator(CARD).count(), { timeout: 10_000 })
    .toBe(filtered);
});

test("a shared filter link opens on the right view", async ({ page }) => {
  await page.goto("/?age=preschool&when=weekend");

  await expect(
    page.getByRole("button", { name: "Grands", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Ce week-end", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("clearing the filters brings everything back", async ({ page }) => {
  await page.goto("/?age=infant");
  const filtered = await page.locator(CARD).count();

  await page.getByRole("button", { name: /tout effacer/i }).click();
  await expect
    .poll(async () => page.locator(CARD).count(), { timeout: 10_000 })
    .toBeGreaterThan(filtered);
  await expect(page).not.toHaveURL(/age=/);
});

test("opening an activity shows its detail sheet", async ({ page }) => {
  await page.goto("/");
  await page.locator(CARD).first().click();

  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading").first()).toBeVisible();
  await expect(sheet.getByRole("button", { name: /y aller|partager/i }).first()).toBeVisible();

  // The selected activity is in the URL, so the sheet is linkable too.
  await expect(page).toHaveURL(/[?&]a=/);

  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
});

test("it takes two parents on site to confirm a listing", async ({
  browser,
  page,
  context,
}) => {
  // One report is deliberately not enough: verification needs two different
  // people who were actually there. This walks that rule end to end.
  await context.grantPermissions(["geolocation"]);
  await page.goto("/");

  const target = await page.evaluate(async () => {
    const response = await fetch("/api/activities");
    const data = await response.json();
    const found = data.activities.find(
      (a: { verification: string; status: string }) =>
        a.verification === "UNVERIFIED" && a.status === "ACTIVE",
    );
    return found ?? null;
  });
  test.skip(!target, "no unverified activity in the seed to report on");

  await context.setGeolocation({ latitude: target.lat, longitude: target.lng });
  await page.goto(`/a/${target.id}`);
  await expect(page.getByText("À confirmer")).toBeVisible();

  await page.getByRole("button", { name: /ça a lieu/i }).click();

  // The thank-you names the on-site case, which is the one that counts double.
  await expect(page.getByText(/vous étiez sur place/i)).toBeVisible({
    timeout: 15_000,
  });

  // Still unconfirmed after one witness.
  await page.reload();
  await expect(page.getByText("À confirmer")).toBeVisible();

  // A second parent, in their own browser, is what tips it over.
  const secondContext = await browser.newContext({
    locale: "fr-CH",
    permissions: ["geolocation"],
    geolocation: { latitude: target.lat, longitude: target.lng },
  });
  const secondParent = await secondContext.newPage();
  await stubTiles(secondParent);
  await secondParent.goto(`/a/${target.id}`);
  await expect(secondParent.getByText("À confirmer")).toBeVisible();
  await secondParent.getByRole("button", { name: /ça a lieu/i }).click();
  await expect(secondParent.getByText(/merci/i)).toBeVisible({ timeout: 15_000 });

  // The badge must flip in place, with no reload. This is the whole feedback
  // loop: the second reporter is the one whose tap verifies the listing, and
  // they are the one person guaranteed to be looking at it when it happens.
  // Asserting only after a reload hid a real bug here — /a/[id] renders the
  // detail body with no parent listening for the update.
  await expect(secondParent.getByText("Confirmé par des parents")).toBeVisible({
    timeout: 10_000,
  });
  await secondContext.close();

  await page.reload();
  await expect(page.getByText("Confirmé par des parents")).toBeVisible();
});

test("the same person cannot report twice in a row", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 46.5218, longitude: 6.6327 });

  await page.goto("/");
  const id = await page.evaluate(async () => {
    const response = await fetch("/api/activities?limit=1");
    const data = await response.json();
    return data.activities[0]?.id ?? null;
  });
  test.skip(!id, "no activities seeded");

  await page.goto(`/a/${id}`);
  await page.getByRole("button", { name: /c'est plein/i }).click();
  await expect(page.getByText(/merci/i)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /ça a lieu/i }).click();
  await expect(page.getByText(/repassez dans une demi-heure/i)).toBeVisible({
    timeout: 15_000,
  });
});

test("the submit flow falls back to manual entry and saves", async ({ page }) => {
  await page.goto("/ajouter");

  await page.getByRole("button", { name: /saisir à la main/i }).click();

  await page.getByLabel("Titre").fill("Atelier test de bout en bout");
  await page.getByLabel("Lieu", { exact: true }).fill("Maison de quartier");
  await page.getByLabel("Adresse").fill("Avenue de Milan 20");
  await page.getByLabel("Début").fill("2026-12-05T10:00");
  await page.getByLabel("De (mois)").fill("12");
  await page.getByLabel("À (mois)").fill("48");

  await page.getByRole("button", { name: /^publier$/i }).click();

  // A successful save lands on the new activity's own shareable page.
  await expect(page).toHaveURL(/\/a\/[a-z0-9]+/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: "Atelier test de bout en bout" }),
  ).toBeVisible();
  // Anything submitted starts unverified, whatever it claims about itself.
  await expect(page.getByText("À confirmer")).toBeVisible();
});

test("a Facebook link falls through to the paste-text step", async ({ page }) => {
  await page.goto("/ajouter");

  await page.locator("#url").fill("https://www.facebook.com/events/1234567890123456/");
  await page.getByRole("button", { name: /analyser le lien/i }).click();

  // Facebook is unreachable here, exactly as it is behind its login wall in
  // production. Either way the parent must land on the paste box, told why.
  await expect(page.getByText(/facebook ne nous laisse pas/i)).toBeVisible({
    timeout: 25_000,
  });
  await expect(page.locator("#text")).toBeVisible();
});

test("the language toggle switches the interface to English", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Bébés", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "English" }).click();

  await expect(page.getByRole("button", { name: "Babies", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: "Français" })).toBeVisible();
});

test("the PWA manifest is served and points at real icons", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);

  const manifest = await response.json();
  expect(manifest.name).toContain("Ouistiti");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.length).toBeGreaterThan(0);
  // A maskable icon is what stops Android cropping the face off.
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(
    true,
  );

  for (const icon of manifest.icons) {
    const iconResponse = await request.get(icon.src);
    expect(iconResponse.ok(), `${icon.src} should exist`).toBe(true);
  }
});
