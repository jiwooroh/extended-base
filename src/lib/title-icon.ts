/**
 * The icon shown at the head of a note's title, wherever this plugin
 * renders one (the table/list/board title cell, a feed card's header).
 * Shared across all four views so the `showTitleIcon` view option behaves
 * identically everywhere.
 *
 * The only source is the Iconize community plugin's own per-file icon
 * assignment — the real icon a note shows in Obsidian's sidebar — read
 * directly from Iconize's plugin data (see `./iconize.ts`), not frontmatter;
 * Iconize itself doesn't write picked icons into frontmatter. A note with
 * nothing assigned there gets a plain document icon instead (the same
 * default Iconize itself shows for a file with no icon).
 */
import { App, BasesEntry, BasesViewConfig, setIcon } from 'obsidian';
import { getIconizeIconName, getIconizeSvg, getIconizeSvgAsync, splitIconPackName } from './iconize';

export interface TitleIconConfig {
	/** The `showTitleIcon` master toggle — false hides the icon entirely. */
	show: boolean;
}

/** Read the `showTitleIcon` view option into a {@link TitleIconConfig}. */
export function readTitleIconConfig(config: BasesViewConfig): TitleIconConfig {
	return {
		// Default-on: only an explicit `false` turns the icon off (mirrors wrapCells/verticalLines).
		show: config.get('showTitleIcon') !== false,
	};
}

/**
 * The icon at the head of a title: this note's own icon as Iconize has it
 * assigned — the real icon-pack SVG Iconize itself would draw (any pack,
 * not just Lucide), or the literal character for an emoji — or a plain
 * document icon for a note with nothing assigned there.
 */
export function renderTitleIcon(wrap: HTMLElement, cfg: TitleIconConfig, app: App, entry: BasesEntry): void {
	if (!cfg.show) return;
	const el = wrap.createSpan({ cls: 'ntn-page-icon' });

	const raw = getIconizeIconName(app, entry.file.path);
	if (!raw) {
		// Nothing assigned for this note — Iconize's own default for a
		// file with no icon: a plain document icon.
		setLucideIcon(el, 'file');
		return;
	}

	if (!splitIconPackName(raw)) {
		// No pack prefix to look up — an emoji (or any other value Iconize
		// didn't need an icon-pack entry for) renders as the literal
		// character it is.
		el.setText(raw);
		return;
	}

	const svg = getIconizeSvg(app, raw);
	if (svg) {
		drawSvg(el, svg);
		return;
	}

	// Iconize hasn't fully loaded this icon's pack into memory yet (it
	// only eagerly loads so much at startup — see iconize.ts). Show the
	// plain document icon for now and swap in the real one once it's
	// ready, if it ever resolves.
	setLucideIcon(el, 'file');
	void getIconizeSvgAsync(app, raw).then((lateSvg) => {
		if (!lateSvg || !el.isConnected) return;
		el.empty();
		el.removeClass('ntn-page-icon-lucide');
		drawSvg(el, lateSvg);
	});
}

function drawSvg(el: HTMLElement, svg: string): void {
	el.addClass('ntn-page-icon-lucide');
	el.innerHTML = svg;
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
