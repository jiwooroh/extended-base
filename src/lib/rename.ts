/**
 * Bulk-renaming a pill/tag value across every note that currently has it —
 * shared by all three views' `renameOption` implementation.
 */
import { App, BasesEntry, BasesPropertyId } from 'obsidian';
import { valueToStrings } from './values';

/**
 * Rewrites `propName`'s frontmatter on every entry (in `entries`) whose
 * value for `prop` includes `oldValue`, replacing it with `newValue`.
 * Preserves whether the frontmatter held a plain scalar or a list. Only
 * entries that actually have the old value are touched.
 */
export async function renamePillValue(
	app: App,
	entries: BasesEntry[],
	prop: BasesPropertyId,
	propName: string,
	oldValue: string,
	newValue: string,
): Promise<void> {
	const oldKey = oldValue.replace(/^#/, '').toLowerCase();
	const affected = entries.filter((entry) =>
		valueToStrings(entry.getValue(prop)).some((v) => v.replace(/^#/, '').toLowerCase() === oldKey),
	);

	for (const entry of affected) {
		await app.fileManager.processFrontMatter(entry.file, (fm: Record<string, unknown>) => {
			const current = fm[propName];
			if (Array.isArray(current)) {
				fm[propName] = current.map((v) =>
					String(v).replace(/^#/, '').toLowerCase() === oldKey ? newValue : v,
				);
			} else if (current != null && String(current).replace(/^#/, '').toLowerCase() === oldKey) {
				fm[propName] = newValue;
			}
		});
	}
}
