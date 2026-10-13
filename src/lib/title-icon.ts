/**
 * The icon shown at the head of a note's title, wherever this plugin
 * renders one (the table/list/board title cell, a feed card's header).
 * Shared across all four views so the `showTitleIcon`/`titleIconProperty`
 * view options behave identically everywhere.
 *
 * The only source is a frontmatter property each note's own icon is read
 * from — what a per-file icon plugin like Iconize, configured to sync
 * icons to frontmatter, actually sets. There's no other icon source:
 * Obsidian itself has no per-file custom icon of its own to fall back to,
 * so a note with nothing in that property gets a plain document icon
 * instead (the same default Iconize itself shows for a file with no icon
 * assigned).
 */
import { BasesEntry, BasesPropertyId, BasesViewConfig, setIcon } from 'obsidian';
import { isNullish } from './values';

export interface TitleIconConfig {
	/** The `showTitleIcon` master toggle — false hides the icon entirely. */
	show: boolean;
	/** The frontmatter property each note stores its own icon in (e.g. `icon`). */
	property: string;
}

/** Read the `showTitleIcon`/`titleIconProperty` view options into a {@link TitleIconConfig}. */
export function readTitleIconConfig(config: BasesViewConfig): TitleIconConfig {
	return {
		// Default-on: only an explicit `false` turns the icon off (mirrors wrapCells/verticalLines).
		show: config.get('showTitleIcon') !== false,
		property: String(config.get('titleIconProperty') ?? 'icon').trim(),
	};
}

/**
 * The icon at the head of a title: this note's own value for the
 * configured icon property (a bare lowercase word tries as a Lucide icon
 * name; anything else — an emoji, a symbol — renders as the text it is),
 * or a plain document icon for a note with nothing set there.
 */
export function renderTitleIcon(wrap: HTMLElement, cfg: TitleIconConfig, entry: BasesEntry): void {
	if (!cfg.show) return;
	const el = wrap.createSpan({ cls: 'ntn-page-icon' });

	const raw = resolvePropertyValue(entry, cfg.property);
	if (raw) {
		const named = /^[a-z][a-z0-9-]*$/.test(raw);
		if (named && setLucideIcon(el, raw)) return;
		el.setText(raw);
		return;
	}
	// Nothing set for this note — Iconize's own default for a file with no
	// icon assigned: a plain document icon.
	setLucideIcon(el, 'file');
}

/** This note's own value for the configured icon property, trimmed; `''` if unset/empty. */
function resolvePropertyValue(entry: BasesEntry, propertyName: string): string {
	if (!propertyName) return '';
	const value = entry.getValue(`note.${propertyName}` as BasesPropertyId);
	return isNullish(value) ? '' : value.toString().trim();
}

/**
 * Draw a Lucide icon into the span. Returns false — leaving the span
 * untouched — when the name isn't a real icon, since `setIcon` fails
 * silently and would otherwise leave an empty gap before the title.
 */
function setLucideIcon(el: HTMLElement, name: string): boolean {
	el.addClass('ntn-page-icon-lucide');
	setIcon(el, name);
	if (el.firstElementChild) return true;
	el.removeClass('ntn-page-icon-lucide');
	return false;
}
