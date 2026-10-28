import { describe, expect, it } from "vitest";
import { dictionaries, zh, type CopyKey } from "../src/client/locales.ts";

/** Locale ids shipped by DSH 0.2.2; other languages fall back to English. */
const SHIPPED_LOCALES = ["zh", "en", "ja", "es", "fr", "de", "ru", "pt"];

/** Named `{placeholder}` tokens of one template, sorted for comparison. */
function placeholders(template: string): string[] {
	return [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

describe("locales", () => {
	it("ships exactly the languages DSH 0.2.2 offers", () => {
		expect(Object.keys(dictionaries)).toEqual(SHIPPED_LOCALES);
	});

	it.each(SHIPPED_LOCALES)("%s covers the zh key set and placeholders", (locale) => {
		const dictionary = dictionaries[locale];
		expect(Object.keys(dictionary).sort()).toEqual(Object.keys(zh).sort());
		for (const key of Object.keys(zh) as CopyKey[]) {
			expect(placeholders(dictionary[key])).toEqual(placeholders(zh[key]));
		}
	});
});
