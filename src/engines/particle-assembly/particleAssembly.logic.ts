import type { ParticleAssemblySharedConfig } from "@/engines/particle-assembly/particleAssembly.config";

export function checkComposition(target: Record<string, number>, actual: Record<string, number>): boolean {
  return Object.keys(target).every((key) => target[key] === (actual[key] ?? 0));
}

/**
 * Builds the System Warning feedback text. Kept as pure string interpolation
 * so it's testable independent of the React component, matching the engine's
 * "pure logic file has no React" convention.
 */
export function buildFeedback(
  shared: ParticleAssemblySharedConfig,
  target: Record<string, number>,
  actual: Record<string, number>
): string {
  const targetProtons = target.proton ?? 0;
  const actualProtons = actual.proton ?? 0;

  if (targetProtons !== actualProtons) {
    const actualElement = shared.elementsByProtonCount[String(actualProtons)] ?? "an unknown element";
    const targetElement = shared.elementsByProtonCount[String(targetProtons)] ?? "the target element";
    const rule = shared.feedbackRules.find((r) => r.when === "proton_count_mismatch");
    const template = rule?.message ?? "This composition has {protonCount} protons.";
    return template
      .replace("{protonCount}", String(actualProtons))
      .replace("{targetElement}", targetElement)
      .replace("{targetProtonCount}", String(targetProtons))
      .concat(` You created ${actualElement}. Try again.`);
  }

  const rule = shared.feedbackRules.find((r) => r.when === "any_mismatch");
  return rule?.message ?? "Not quite — check your counts against the mission card. Try again.";
}
