import { setKeybindings } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { KeybindingsManager } from "../src/core/keybindings.ts";
import { ExtensionSelectorComponent } from "../src/modes/interactive/components/extension-selector.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

describe("ExtensionSelectorComponent", () => {
	beforeAll(() => {
		initTheme("dark");
		setKeybindings(new KeybindingsManager());
	});

	const makeSelector = (options: string[]) => {
		const onSelect = vi.fn();
		const onCancel = vi.fn();
		const component = new ExtensionSelectorComponent("Pick", options, onSelect, onCancel);
		return { component, onSelect, onCancel };
	};

	const rendered = (component: ExtensionSelectorComponent) => stripAnsi(component.render(80).join("\n"));

	it("windows long option lists and keeps the selection visible (regression: #6688)", () => {
		const options = Array.from({ length: 30 }, (_, i) => `option-${i}`);
		const { component } = makeSelector(options);

		let output = rendered(component);
		// Selection starts at the top of the window, scroll indicator shows the overflow
		expect(output).toContain("→ option-0");
		expect(output).toContain("option-9");
		expect(output).not.toContain("option-10");
		expect(output).toContain("(1/30)");

		// Moving down re-centers the window around the cursor
		for (let i = 0; i < 12; i++) component.handleInput("\x1b[B");
		output = rendered(component);
		expect(output).toContain("→ option-12");
		expect(output).toContain("option-7");
		expect(output).toContain("option-16");
		expect(output).not.toContain("option-17");
		expect(output).toContain("(13/30)");
	});

	it("keeps the selection visible when navigating to the end of a long list (regression: #6688)", () => {
		const options = Array.from({ length: 30 }, (_, i) => `option-${i}`);
		const { component } = makeSelector(options);

		for (let i = 0; i < 29; i++) component.handleInput("\x1b[B");
		const output = rendered(component);
		expect(output).toContain("→ option-29");
		expect(output).toContain("option-20");
		expect(output).not.toContain("option-19\n");
		expect(output).toContain("(30/30)");

		// Up wraps the window back around the selection
		component.handleInput("\x1b[A");
		expect(rendered(component)).toContain("→ option-28");
	});

	it("renders short lists in full without a scroll indicator", () => {
		const options = ["alpha", "beta", "gamma"];
		const { component } = makeSelector(options);

		const output = rendered(component);
		expect(output).toContain("→ alpha");
		expect(output).toContain("beta");
		expect(output).toContain("gamma");
		expect(output).not.toMatch(/\(\d+\/\d+\)/);
	});

	it("keeps navigation clamped and confirm/cancel callbacks intact", () => {
		const options = ["alpha", "beta", "gamma"];
		const { component, onSelect, onCancel } = makeSelector(options);

		// Down is clamped at the last option
		for (let i = 0; i < 10; i++) component.handleInput("\x1b[B");
		expect(rendered(component)).toContain("→ gamma");

		component.handleInput("\r");
		expect(onSelect).toHaveBeenCalledWith("gamma");

		component.handleInput("\x1b");
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it("renders an empty option list without throwing", () => {
		const { component } = makeSelector([]);
		expect(() => component.handleInput("\x1b[B")).not.toThrow();
		const output = rendered(component);
		expect(output).not.toContain("→");
		expect(output).not.toMatch(/\(\d+\/\d+\)/);
	});
});
