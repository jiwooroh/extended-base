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
 * `setIcon` can't render most of them). {@link getIconizeSvg} mirrors
 * Iconize's own `getIconByName` lookup (prefix → loaded pack → icon by
 * name) so this resolves the same way Iconize itself would, for any pack
 * it has loaded.
 */
import { App } from 'obsidian';

interface IconizeIcon {
	name: string;
	svgElement: string;
}

interface IconizeIconPack {
	getIcon(name: string): IconizeIcon | undefined;
	getIcons(): IconizeIcon[];
	getName(): string;
	getPrefix(): string;
}

interface IconizeIconPackManager {
	getIconPackByPrefix(prefix: string): IconizeIconPack | undefined;
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

/**
 * The real `<svg>...</svg>` markup for a raw Iconize icon name — the same
 * lookup Iconize's own `getIconByName` does (prefix → the loaded pack with
 * that prefix → the icon by name within it). Undefined when Iconize isn't
 * installed, the name has no pack prefix (a bare emoji character), the
 * pack isn't currently loaded, or that pack has no icon by that name.
 */
export function getIconizeSvg(app: App, rawName: string): string | undefined {
	const split = splitIconPackName(rawName);
	if (!split) return undefined;

	const plugin = getIconizePlugin(app);
	if (!plugin) {
		console.warn(`[Extended Base] Iconize icon "${rawName}": the Iconize plugin (obsidian-icon-folder) isn't installed or enabled.`);
		return undefined;
	}

	const manager = plugin.getIconPackManager?.();
	if (!manager) {
		console.warn(`[Extended Base] Iconize icon "${rawName}": Iconize has no getIconPackManager() — unexpected API shape (possible version mismatch).`);
		return undefined;
	}

	const pack = manager.getIconPackByPrefix(split.prefix);
	if (!pack) {
		const loaded = manager.getIconPacks().map((p) => `${p.getName()} (prefix "${p.getPrefix()}")`).join(', ') || '(none)';
		console.warn(
			`[Extended Base] Iconize icon "${rawName}": no loaded icon pack has prefix "${split.prefix}". ` +
			`Currently loaded packs: ${loaded}`,
		);
		return undefined;
	}

	const icon = pack.getIcon(split.name);
	if (!icon) {
		const sample = pack.getIcons().slice(0, 15).map((i) => i.name).join(', ');
		console.warn(
			`[Extended Base] Iconize icon "${rawName}": pack "${split.prefix}" is loaded (${pack.getIcons().length} icons) but has none named "${split.name}". ` +
			`First few icon names in that pack: ${sample || '(pack has 0 icons loaded)'}`,
		);
		return undefined;
	}

	return icon.svgElement;
}
