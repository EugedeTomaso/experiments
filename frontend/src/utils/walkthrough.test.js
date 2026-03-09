import test from "node:test";
import assert from "node:assert/strict";

import { shouldShowWelcomeWalkthrough } from "./walkthrough.js";

test("shows walkthrough for a new writer with no projects", () => {
  assert.equal(
    shouldShowWelcomeWalkthrough({
      isReviewerOnlyUser: false,
      walkthroughDismissed: false,
      isWizardOpen: false,
      canCreateProjects: true,
      projectCount: 0,
    }),
    true
  );
});

test("hides walkthrough for an existing writer with projects", () => {
  assert.equal(
    shouldShowWelcomeWalkthrough({
      isReviewerOnlyUser: false,
      walkthroughDismissed: false,
      isWizardOpen: false,
      canCreateProjects: true,
      projectCount: 2,
    }),
    false
  );
});
