import type { AxeResults, Result, RunOptions } from "axe-core";

let configured = false;

export const runAxe = async (
	container: Element,
	options?: RunOptions,
): Promise<AxeResults> => {
	const axe = (await import("axe-core")).default;
	if (!configured) {
		axe.configure({ rules: [{ id: "color-contrast", enabled: false }] });
		configured = true;
	}
	return axe.run(container, options ?? {});
};

const formatViolations = (violations: Result[]): string =>
	violations
		.map((v) => `  - ${v.id} (${v.impact}): ${v.description}\n    ${v.helpUrl}`)
		.join("\n");

export const toHaveNoViolations = (results: AxeResults) => {
	const pass = results.violations.length === 0;
	return {
		pass,
		message: () =>
			pass
				? "Expected accessibility violations but found none"
				: `Expected no accessibility violations but found ${results.violations.length}:\n${formatViolations(results.violations)}`,
	};
};
