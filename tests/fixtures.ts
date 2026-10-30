import { test as base } from "@playwright/test";
import { ownerTestCookie } from "./auth-support";
export { expect } from "@playwright/test";
export type { Page } from "@playwright/test";
export const test = base.extend({
  storageState: async ({ baseURL }, use) => { await use({ cookies: [await ownerTestCookie(baseURL)], origins: [] }); },
});
