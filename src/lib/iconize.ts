/**
 * Reads a note's actual sidebar icon from the Iconize community plugin
 * (`obsidian-icon-folder` — its plugin id never changed even though the
 * plugin itself was renamed), and resolves it to real SVG markup.
 *
 * Iconize keeps a file's icon assignment in its own plugin data, keyed by
 * vault path — not in frontmatter. Its (optional, off by default) "icon in
 * frontmatter" setting still ends up writing that same per-path store, so
 * `getIconNameFromPath` is the one source that covers every way a user
 * actually assigns an icon through Iconize, whether picked from its UI or
 * driven by a frontmatter property.
 *
 * A non-emoji icon name is `<packPrefix><IconName>` (e.g. `LiSmile` for
 * Lucide's "smile", `BoBxsCircle` for Boxicons-solid's "circle" — Iconize
 * supports many icon packs beyond Lucide, so Obsidian's own Lucide-only
 * `setIcon` can't render most of them). Instead this looks the icon up the
 * same way Iconize itself does — across every pack it has loaded — and
 * returns that pack's own `<svg>` markup directly.
 */
import { App } from 'obsidian';

interface IconizeIcon {
	name: string;
	prefix: string;
	svgElement: string;
}

interface IconizeIconPack {
	getIcons(): IconizeIcon[];
}

interface IconizeIconPackManager {
	getPreloadedIcons(): IconizeIcon[];
	getIconPacks(): IconizeIconPack[];
}

interface IconizePluginLike {
	getIconNameFromPath?(path: string): string | undefined;
	getIconPackManager?(): IconizeIconPackManager;
}

function getIconizePlugin(app: App): IconizePluginLike | undefined {
	const plugins = (app as unknown as { plugins?: { plugins?: Record<string, IconizePluginLike> } }).plugins;
	return plugins?.plugins?.['obsidian-icon-folder'];
}

/**
 * This file's icon exactly as Iconize stores it, or undefined if Iconize
 * isn't installed/enabled or has no icon assigned for this path. The raw
 * value is either a literal character (an emoji) or `<packPrefix><Name>`
 * — see {@link getIconizeSvg}.
 */
export function getIconizeIconName(app: App, path: string): string | undefined {
	return getIconizePlugin(app)?.getIconNameFromPath?.(path) || undefined;
}

/**
 * Split a raw Iconize icon name into its pack prefix and the icon's own
 * name within that pack, mirroring Iconize's own `nextIdentifier()`: the
 * prefix is everything up to (but not including) the next uppercase letter
 * or digit after the first character. A name with no such second boundary
 * (e.g. a bare `smile`) has no prefix to split off.
 */
function splitIconPackName(value: string): { prefix: string; name: string } | null {
	if (value.length < 2) return null;
	let i = 1;
	while (i < value.length && !/[A-Z0-9]/.test(value[i])) i++;
	return i < value.length ? { prefix: value.slice(0, i), name: value.slice(i) } : null;
}

/** Iconize's own `getNormalizedName`: `-`/`_`/` `-separated words → PascalCase. */
function normalizeName(s: string): string {
	return s
		.split(/[ _-]/g)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join('');
}

/**
 * The real `<svg>...</svg>` markup for a raw Iconize icon name, searched
 * across every icon pack Iconize has loaded (Lucide included) the same way
 * Iconize resolves one for its own sidebar/title icons. Undefined when
 * Iconize isn't installed, the name has no pack prefix to look up (a bare
 * emoji character), or no loaded pack has a matching icon (the pack isn't
 * downloaded/enabled).
 */
export function getIconizeSvg(app: App, rawName: string): string | undefined {
	const manager = getIconizePlugin(app)?.getIconPackManager?.();
	const split = manager && splitIconPackName(rawName);
	if (!manager || !split) return undefined;

	const prefix = split.prefix.toLowerCase();
	const name = split.name.toLowerCase();

	const direct = manager.getPreloadedIcons().find(
		(icon) => icon.prefix.toLowerCase() === prefix && icon.name.toLowerCase() === name,
	);
	if (direct) return direct.svgElement;

	for (const pack of manager.getIconPacks()) {
		const icon = pack.getIcons().find(
			(icon) => icon.prefix.toLowerCase() === prefix && normalizeName(icon.name).toLowerCase() === name,
		);
		if (icon) return icon.svgElement;
	}
	return undefined;
}
