import { test, expect } from "@playwright/test";
test.setTimeout(60000);
const password = process.env.STOCKFLOW_TEST_PASSWORD;
test.skip(
  !password,
  "Set STOCKFLOW_TEST_PASSWORD to the current seed password.",
);
test("real workspace: stock → draft → confirm → cancel, themes, keyboard and mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Email address").fill("admin@stockflow.local");
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Updating your workspace…")).toBeHidden();
  await page.screenshot({
    path: "docs/screenshots/overview-light.png",
    fullPage: true,
  });
  const theme = await page.locator("html").getAttribute("data-theme");
  await page
    .getByRole("button", {
      name: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
    })
    .click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    theme === "dark" ? "light" : "dark",
  );
  await expect(page.getByRole("heading", {name:"Overview", exact:true})).toBeVisible();
  await expect(page.getByText("Updating your workspace…")).toBeHidden();
  await page.screenshot({
    path: "docs/screenshots/overview-dark.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Products", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Product catalog" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Add product", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Stock for Bamboo notebook", exact: true })
    .click();
  await page.getByLabel("Quantity to add or remove").fill("3");
  await page
    .getByLabel("Reason for this change")
    .fill("Browser acceptance delivery");
  await page
    .getByRole("button", { name: "Record stock change", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("link", { name: "Sales orders", exact: true }).click();
  await page.getByRole("button", { name: "New order", exact: true }).click();
  const picker=page.getByRole('combobox',{name:'Product 1',exact:true});
  await expect(picker).toBeVisible();
  const productId=await picker.getByRole('option',{name:/^Bamboo notebook/}).getAttribute('value');
  await picker.selectOption(productId!);
  await page.getByLabel("Quantity", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Save draft order" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .getByRole("button", { name: /Review order/ })
    .first()
    .click();
  await expect(
    page.getByRole("dialog").getByText("Draft", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm order", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm order", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .getByRole("button", { name: /Review order/ })
    .first()
    .click();
  await expect(
    page.getByRole("dialog").getByText("Confirmed", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel order", exact: true }).click();
  await page.getByRole("button", { name: "Cancel order", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("row").filter({ hasText: "Canceled" }).first(),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Products", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Product catalog" }),
  ).toBeVisible();
  await expect(page.getByRole('button',{name:'Open navigation'})).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "docs/screenshots/products-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
