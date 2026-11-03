/**
 * What's shown around a title, wherever this plugin renders one (the
 * table/list/board title cell, a feed card's header): this note's icon at
 * the head of it, and — for anything that isn't a plain Markdown note — a
 * small file-type badge pinned to the row's right edge (via CSS `order`,
 * not DOM position — see `.ntn-filetype-badge` in styles.css). Shared
 * across all four views so both behave identically everywhere.
 *
 * The icon's only source is the Iconize community plugin's own per-file
 * icon assignment — the real icon a note shows in Obsidian's sidebar —
 * read directly from Iconize's plugin data (see `./iconize.ts`), not
 * frontmatter; Iconize itself doesn't write picked icons into frontmatter.
 * A note with nothing assigned there gets a plain document icon instead
 * (the same default Iconize itself shows for a file with no icon). The
 * `showTitleIcon` view option controls the icon only — the file-type
 * badge always shows, since it's "what kind of file is this", not a
 * decoration.
 */
import { App, BasesEntry, BasesViewConfig, setIcon } from 'obsidian';
import { getIconizeIconName, getIconizeSvg, splitIconPackName } from './iconize';

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
 *
 * Resolving the real SVG means reading a file off disk (see iconize.ts), so
 * it can't happen synchronously: the plain document icon shows first and
 * gets swapped for the real one as soon as it resolves, rather than making
 * every row's render wait on a filesystem read.
 */
export function renderTitleIcon(wrap: HTMLElement, cfg: TitleIconConfig, app: App, entry: BasesEntry): void {
	if (cfg.show) {
		const el = wrap.createSpan({ cls: 'ntn-page-icon' });

		const raw = getIconizeIconName(app, entry.file.path);
		if (!raw) {
			// Nothing assigned for this note — Iconize's own default for a
			// file with no icon: a plain document icon.
			setLucideIcon(el, 'file');
		} else if (!splitIconPackName(raw)) {
			// No pack prefix to look up — an emoji (or any other value Iconize
			// didn't need an icon-pack entry for) renders as the literal
			// character it is.
			el.setText(raw);
		} else {
			setLucideIcon(el, 'file');
			void getIconizeSvg(app, raw).then((svg) => {
				if (svg) {
					if (!el.isConnected) return;
					el.empty();
					el.removeClass('ntn-page-icon-lucide');
					drawSvg(el, svg);
					return;
				}
				// No pack folder on disk matched — the common remaining case is
				// Obsidian's own native Lucide set (Iconize's default pack,
				// which isn't extracted to files at all when used that way):
				// try it directly before settling for the plain document icon
				// already shown.
				if (!el.isConnected) return;
				const split = splitIconPackName(raw);
				if (!split || !setLucideIcon(el, toKebabCase(split.name))) {
					setLucideIcon(el, 'file');
				}
			});
		}
	}

	renderFileTypeBadge(wrap, entry);
}

/**
 * A small badge for the file's own extension (e.g. "PDF", "DOCX"), pinned
 * to the right edge of the title row (see `.ntn-filetype-badge`'s own
 * `order` + `margin-left: auto` in styles.css — appending it here, before
 * the caller even creates the title text span, still lands it on the
 * right visually). A Base can list any file in the vault, not just notes,
 * and nothing else in a title cell says what a non-Markdown entry actually
 * is. A plain ".md" note needs no badge — it's what Bases shows by default.
 */
function renderFileTypeBadge(wrap: HTMLElement, entry: BasesEntry): void {
	const ext = entry.file.extension;
	if (!ext || ext.toLowerCase() === 'md') return;
	wrap.createSpan({ cls: 'ntn-filetype-badge', text: ext.toUpperCase() });
}

/** PascalCase icon name → the kebab-case id Obsidian's own Lucide set uses (e.g. `ArrowUpRight` → `arrow-up-right`). */
function toKebabCase(name: string): string {
	return name
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
		.toLowerCase();
}

/**
 * Insert an icon-pack's `<svg>...</svg>` markup (read off disk in
 * iconize.ts) as real DOM nodes — parsed via `DOMParser`, not assigned
 * through `innerHTML`, so this never executes markup as live HTML even
 * though the source is a local file we trust.
 */
function drawSvg(el: HTMLElement, svg: string): void {
	const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
	if (!(root instanceof SVGElement)) return;
	el.addClass('ntn-page-icon-lucide');
	el.appendChild(el.doc.importNode(root, true));
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
