/**
 * The icon shown at the head of a note's title, wherever this plugin
 * renders one (the table/list/board title cell, a feed card's header).
 * Shared across all four views so the `showTitleIcon`/`titleIcon`/
 * `titleIconCustom`/`titleIconProperty` view options behave identically
 * everywhere.
 */
import { BasesEntry, BasesPropertyId, BasesViewConfig, setIcon } from 'obsidian';
import { isNullish } from './values';

export interface TitleIconConfig {
	/** The `showTitleIcon` master toggle — false hides the icon regardless of `mode`. */
	show: boolean;
	/** `'page'` (Notion's page emoji, default) | `'theme'` | `'custom'` | `'property'`. */
	mode: string;
	/** For `mode: 'custom'` — a Lucide icon name, or any other text (emoji, symbol). */
	custom: string;
	/**
	 * For `mode: 'property'` — the frontmatter property each note stores its
	 * own icon in (e.g. a plugin like Iconize, configured to sync icons to
	 * frontmatter, commonly uses `icon`).
	 */
	property: string;
}

/** Read the title-icon view options into a {@link TitleIconConfig}. */
export function readTitleIconConfig(config: BasesViewConfig): TitleIconConfig {
	return {
		// Default-on: only an explicit `false` turns the icon off (mirrors wrapCells/verticalLines).
		show: config.get('showTitleIcon') !== false,
		mode: String(config.get('titleIcon') ?? 'page'),
		custom: String(config.get('titleIconCustom') ?? '').trim(),
		property: String(config.get('titleIconProperty') ?? 'icon').trim(),
	};
}

/**
 * The icon at the head of a title. Notion's page emoji is the default, but
 * it's a fixed glyph that can sit badly against a theme — so `titleIcon`
 * also offers Obsidian's own file icon (which takes the theme's color), a
 * fixed emoji/Lucide icon the user names, or each note's own icon from a
 * frontmatter property (what a per-file icon plugin like Iconize, synced to
 * frontmatter, actually sets) — falling back to a plain document icon,
 * not the page emoji, for a note with nothing set there.
 */
export function renderTitleIcon(wrap: HTMLElement, cfg: TitleIconConfig, entry: BasesEntry): void {
	if (!cfg.show) return;
	const { mode, custom, property } = cfg;
	const el = wrap.createSpan({ cls: 'ntn-page-icon' });

	if (mode === 'page') {
		el.addClass('ntn-page-icon-emoji');
		el.setText('📄');
		return;
	}
	if (mode === 'theme') {
		setLucideIcon(el, 'file-text');
		return;
	}

	const raw = mode === 'custom' ? custom : resolvePropertyValue(entry, property);
	if (raw) {
		// A bare lowercase word is a Lucide icon name; anything else — an
		// emoji, a letter, a symbol — is rendered as the text it is.
		const named = /^[a-z][a-z0-9-]*$/.test(raw);
		if (named && setLucideIcon(el, raw)) return;
		el.setText(raw);
		return;
	}
	// 'custom' with nothing filled in, or 'property' with nothing set for
	// this note — a plain document icon (Iconize's own default for a file
	// with no icon assigned), not the Notion page emoji.
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
