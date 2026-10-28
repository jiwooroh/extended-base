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
 * driven by a frontmatter property. That one method is public and stable
 * across versions.
 *
 * A non-emoji icon name is `<packPrefix><IconName>` (e.g. `LiSmile` for
 * Lucide's "smile", `BoBxsCircle` for Boxicons-solid's "circle"). Rendering
 * that as a real icon is the hard part: Iconize's *current* development
 * branch exposes a `getIconPackManager()` for exactly this, but that's
 * unreleased — every actually-published version (2.14.7 and earlier) keeps
 * all of its icon-pack state as module-private variables with no public
 * method to reach it at all. So instead of asking Iconize for the SVG, this
 * reads it straight off disk the same way Iconize's own (also private)
 * `loadIcon()` does: find the pack folder under its icons directory whose
 * name hashes to the right prefix, then the `.svg` file in it whose
 * normalized name matches — using only the stable, public Obsidian vault
 * adapter API, not anything Iconize-version-specific.
 */
import { App } from 'obsidian';

interface IconizePluginLike {
	getIconNameFromPath?(path: string): string | undefined;
	getSettings?(): { iconPacksPath?: string } | undefined;
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
 * (e.g. a bare `smile`) has no prefix to split off — a literal emoji, not
 * an icon-pack reference.
 */
export function splitIconPackName(value: string): { prefix: string; name: string } | null {
	if (value.length < 2) return null;
	let i = 1;
	while (i < value.length && !/[A-Z0-9]/.test(value[i])) i++;
	return i < value.length ? { prefix: value.slice(0, i), name: value.slice(i) } : null;
}

/** Iconize's `createIconPackPrefix`: a pack's folder name → its 2-char (or hyphen-word-initials) prefix. */
function packPrefixFor(folderName: string): string {
	if (folderName.includes('-')) {
		const parts = folderName.split('-');
		return parts[0].charAt(0).toUpperCase() + parts.slice(1).map((p) => p.charAt(0).toLowerCase()).join('');
	}
	return folderName.charAt(0).toUpperCase() + folderName.charAt(1).toLowerCase();
}

/** Iconize's `getNormalizedName`: an on-disk icon filename (minus extension) → the PascalCase form its icon names use. */
function normalizeIconFileName(fileName: string): string {
	return fileName
		.split(/[ _-]/g)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join('');
}

const DEFAULT_ICONS_PATH = '.obsidian/icons';

/** folder name → prefix, for every icon pack folder under Iconize's icons directory. Loaded once per session and reused. */
let packFoldersPromise: Promise<{ iconsPath: string; byPrefix: Map<string, string> }> | null = null;

async function loadPackFolders(app: App, iconsPath: string): Promise<{ iconsPath: string; byPrefix: Map<string, string> }> {
	const byPrefix = new Map<string, string>();
	try {
		const listing = await app.vault.adapter.list(iconsPath);
		for (const folderPath of listing.folders) {
			const name = folderPath.split('/').pop();
			if (name) byPrefix.set(packPrefixFor(name), name);
		}
	} catch {
		// Icons folder missing/unreadable — leave the map empty; callers treat
		// that the same as "no matching pack found".
	}
	return { iconsPath, byPrefix };
}

/**
 * The real `<svg>...</svg>` markup for a raw Iconize icon name, read
 * directly off disk (see the module doc comment for why). Undefined when
 * Iconize isn't installed, the name has no pack prefix (a bare emoji
 * character), no icon-pack folder matches that prefix, or that folder has
 * no `.svg` file by that name.
 */
export async function getIconizeSvg(app: App, rawName: string): Promise<string | undefined> {
	const split = splitIconPackName(rawName);
	if (!split) return undefined;

	const plugin = getIconizePlugin(app);
	if (!plugin) return undefined;

	if (!packFoldersPromise) {
		const iconsPath = plugin.getSettings?.()?.iconPacksPath || DEFAULT_ICONS_PATH;
		packFoldersPromise = loadPackFolders(app, iconsPath);
	}
	const { iconsPath, byPrefix } = await packFoldersPromise;

	const folderName = byPrefix.get(split.prefix);
	if (!folderName) return undefined;

	try {
		const listing = await app.vault.adapter.list(`${iconsPath}/${folderName}`);
		for (const filePath of listing.files) {
			const fileName = filePath.split('/').pop();
			if (!fileName?.toLowerCase().endsWith('.svg')) continue;
			const baseName = fileName.slice(0, -4);
			if (normalizeIconFileName(baseName) !== split.name) continue;
			return await app.vault.adapter.read(filePath);
		}
	} catch {
		return undefined;
	}
	return undefined;
}
