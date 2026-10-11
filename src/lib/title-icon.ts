/**
 * The icon shown at the head of a note's title, wherever this plugin
 * renders one (the table/list/board title cell, a feed card's header).
 * Shared across all four views so the `titleIcon` / `titleIconCustom`
 * view options behave identically everywhere.
 */
import { BasesViewConfig, setIcon } from 'obsidian';

export interface TitleIconConfig {
	/** `'page'` (Notion's page emoji, default) | `'theme'` | `'custom'` | `'none'`. */
	mode: string;
	/** For `mode: 'custom'` — a Lucide icon name, or any other text (emoji, symbol). */
	custom: string;
}

/** Read the `titleIcon`/`titleIconCustom` view options into a {@link TitleIconConfig}. */
export function readTitleIconConfig(config: BasesViewConfig): TitleIconConfig {
	return {
		mode: String(config.get('titleIcon') ?? 'page'),
		custom: String(config.get('titleIconCustom') ?? '').trim(),
	};
}

/**
 * The icon at the head of a title. Notion's page emoji is the default, but
 * it's a fixed glyph that can sit badly against a theme — so `titleIcon`
 * also offers Obsidian's own file icon (which takes the theme's color), any
 * emoji or Lucide icon the user names, or no icon at all.
 */
export function renderTitleIcon(wrap: HTMLElement, cfg: TitleIconConfig): void {
	const { mode, custom } = cfg;
	if (mode === 'none') return;
	const el = wrap.createSpan({ cls: 'ntn-page-icon' });
	if (mode === 'theme') {
		setLucideIcon(el, 'file-text');
		return;
	}
	if (mode === 'custom' && custom) {
		// A bare lowercase word is a Lucide icon name; anything else — an
		// emoji, a letter, a symbol — is rendered as the text it is.
		const named = /^[a-z][a-z0-9-]*$/.test(custom);
		if (named && setLucideIcon(el, custom)) return;
		el.setText(custom);
		return;
	}
	// Both 'page' and a 'custom' with nothing filled in yet.
	el.addClass('ntn-page-icon-emoji');
	el.setText('📄');
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
