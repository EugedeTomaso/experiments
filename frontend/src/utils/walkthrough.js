export function shouldShowWelcomeWalkthrough({
  isReviewerOnlyUser,
  walkthroughDismissed,
  isWizardOpen,
  canCreateProjects,
  projectCount,
}) {
  return (
    !isReviewerOnlyUser &&
    !walkthroughDismissed &&
    !isWizardOpen &&
    canCreateProjects &&
    projectCount === 0
  );
}
