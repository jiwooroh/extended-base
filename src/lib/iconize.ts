/**
 * Reads a note's actual sidebar icon from the Iconize community plugin
 * (`obsidian-icon-folder` — its plugin id never changed even though the
 * plugin itself was renamed).
 *
 * Iconize keeps a file's icon assignment in its own plugin data, keyed by
 * vault path — not in frontmatter. Its (optional, off by default) "icon in
 * frontmatter" setting still ends up writing that same per-path store, so
 * `getIconNameFromPath` is the one source that covers every way a user
 * actually assigns an icon through Iconize, whether picked from its UI or
 * driven by a frontmatter property.
 */
import { App } from 'obsidian';

interface IconizePluginLike {
	getIconNameFromPath?(path: string): string | undefined;
}

function getIconizePlugin(app: App): IconizePluginLike | undefined {
	const plugins = (app as unknown as { plugins?: { plugins?: Record<string, IconizePluginLike> } }).plugins;
	return plugins?.plugins?.['obsidian-icon-folder'];
}

/**
 * This file's icon exactly as Iconize stores it, or undefined if Iconize
 * isn't installed/enabled or has no icon assigned for this path. The raw
 * value is either a literal character (an emoji) or `<packPrefix><Name>`
 * (e.g. `LiSmile` for Lucide's "smile") — see {@link splitIconPackName}.
 */
export function getIconizeIconName(app: App, path: string): string | undefined {
	return getIconizePlugin(app)?.getIconNameFromPath?.(path) || undefined;
}

/**
 * Strip an icon pack's prefix off a raw Iconize icon name, mirroring
 * Iconize's own `nextIdentifier()`: the prefix is everything up to (but not
 * including) the next uppercase letter or digit after the first character.
 * A name with no such second boundary (e.g. an already-bare `smile`) has no
 * prefix to strip, so it's returned unchanged.
 */
function splitIconPackName(value: string): string {
	if (value.length < 2) return value;
	let i = 1;
	while (i < value.length && !/[A-Z0-9]/.test(value[i])) i++;
	return i < value.length ? value.slice(i) : value;
}

/** PascalCase (or already-bare) icon name → the kebab-case id Obsidian's Lucide set uses. */
function toKebabCase(name: string): string {
	return name
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
		.toLowerCase();
}

/**
 * A raw Iconize icon name reduced to the Lucide id Obsidian's own `setIcon`
 * would recognize — correct for Lucide (Iconize's bundled default pack);
 * a name from any other icon pack just won't resolve to a real icon, left
 * for the caller to handle (Iconize itself renders those packs' own SVGs,
 * which this plugin has no access to).
 */
export function toLucideId(rawIconizeName: string): string {
	return toKebabCase(splitIconPackName(rawIconizeName));
}
