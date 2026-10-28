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
 * name).
 *
 * That lookup only finds icons from a pack Iconize has actually read off
 * disk into memory — and at plugin load, Iconize only eagerly does that for
 * zip-downloaded packs' *shells* (`init()`) plus the handful of icons
 * already in use (`loadUsedIcons()`); a pack installed as a plain folder
 * (not a zip), or an icon not yet in that "used" set, stays unregistered
 * until something calls the separate, heavier `loadAll()` — which Iconize
 * itself only does on a deferred/background pass, not before a Bases view
 * can already have rendered. {@link getIconizeSvgAsync} covers that gap: it
 * tries the fast synchronous lookup first, and on a miss, triggers (and
 * caches) that same `loadAll()` itself and retries once it resolves.
 */
import { App, Notice } from 'obsidian';

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
	loadAll(): Promise<void>;
}

interface IconizePluginLike {
	getIconNameFromPath?(path: string): string | undefined;
	getIconPackManager?(): IconizeIconPackManager;
}

function getIconizePlugin(app: App): IconizePluginLike | undefined {
	const plugins = (app as unknown as { plugins?: { plugins?: Record<string, IconizePluginLike> } }).plugins;
	return plugins?.plugins?.['obsidian-icon-folder'];
}

/** Every method name on an object's own prototype chain (not just its own properties) — for diagnosing an unknown API shape at runtime. */
function listMethodNames(obj: unknown): string[] {
	if (!obj || typeof obj !== 'object') return [];
	const names = new Set<string>();
	let proto: object | null = Object.getPrototypeOf(obj);
	while (proto && proto !== Object.prototype) {
		for (const name of Object.getOwnPropertyNames(proto)) {
			if (name === 'constructor') continue;
			const value = (proto as Record<string, unknown>)[name];
			if (typeof value === 'function') names.add(name);
		}
		proto = Object.getPrototypeOf(proto);
	}
	return [...names].sort();
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
export function splitIconPackName(value: string): { prefix: string; name: string } | null {
	if (value.length < 2) return null;
	let i = 1;
	while (i < value.length && !/[A-Z0-9]/.test(value[i])) i++;
	return i < value.length ? { prefix: value.slice(0, i), name: value.slice(i) } : null;
}

/**
 * The real `<svg>...</svg>` markup for a raw Iconize icon name — the same
 * lookup Iconize's own `getIconByName` does (prefix → the loaded pack with
 * that prefix → the icon by name within it). Undefined when Iconize isn't
 * installed, the name has no pack prefix (a bare emoji character), or that
 * pack/icon isn't loaded into memory yet — see {@link getIconizeSvgAsync}.
 */
export function getIconizeSvg(app: App, rawName: string): string | undefined {
	const split = splitIconPackName(rawName);
	if (!split) return undefined;
	const manager = getIconizePlugin(app)?.getIconPackManager?.();
	const icon = manager?.getIconPackByPrefix(split.prefix)?.getIcon(split.name);
	return icon?.svgElement;
}

/** One shared, cached `loadAll()` call per app session — never kicked off twice. */
let loadAllPromise: Promise<unknown> | null = null;
/** Whether forcing `loadAll()` itself failed (logged once, not per icon). */
let loadAllFailed = false;
/**
 * Shows the first diagnosis as an on-screen Notice, not just a console log
 * — the dev console isn't available on every platform (mobile) or to every
 * user, but a Notice always is. Fires once per session so a table full of
 * unresolved icons doesn't spam a dozen popups.
 */
let diagnosisShown = false;
function showDiagnosisOnce(message: string): void {
	if (diagnosisShown) return;
	diagnosisShown = true;
	new Notice(message, 0);
}

/**
 * {@link getIconizeSvg}, but when the fast path misses (the pack hasn't
 * been fully read off disk yet — see the module doc comment), forces
 * Iconize to finish loading every icon pack and retries once. Resolves to
 * undefined if it's still not found after that (Iconize isn't installed,
 * the icon was removed, or the pack genuinely isn't downloaded) — and logs
 * exactly which of those it was, once per distinct icon, since this can't
 * be tested against a real vault/Iconize installation from here.
 */
export async function getIconizeSvgAsync(app: App, rawName: string): Promise<string | undefined> {
	const direct = getIconizeSvg(app, rawName);
	if (direct) return direct;

	const plugin = getIconizePlugin(app);
	if (!plugin) {
		const msg = '[Extended Base] Iconize icon lookup: the Iconize plugin (id "obsidian-icon-folder") was not found under app.plugins.plugins. Is it installed and enabled?';
		console.warn(msg);
		showDiagnosisOnce(msg);
		return undefined;
	}

	const manager = plugin.getIconPackManager?.();
	if (!manager) {
		const methods = listMethodNames(plugin).join(', ') || '(none found)';
		const msg =
			'[Extended Base] Iconize icon lookup: the Iconize plugin was found, but it has no getIconPackManager() method — ' +
			`this installed version's API differs from what this was built against. Methods it does have: ${methods}`;
		console.warn(msg);
		showDiagnosisOnce(msg);
		return undefined;
	}

	if (!loadAllPromise) {
		loadAllPromise = manager.loadAll().catch((e) => {
			loadAllFailed = true;
			const msg = `[Extended Base] Iconize loadAll() threw while force-loading icon packs: ${e}`;
			console.error(msg, e);
			showDiagnosisOnce(msg);
		});
	}
	await loadAllPromise;
	if (loadAllFailed) return undefined;

	const resolved = getIconizeSvg(app, rawName);
	if (!resolved) {
		const split = splitIconPackName(rawName);
		const packs = manager.getIconPacks();
		const loaded = packs.map((p) => `${p.getName()} (prefix "${p.getPrefix()}", ${p.getIcons().length} icons)`).join(', ') || '(none)';
		const msg =
			`[Extended Base] Iconize icon "${rawName}" still unresolved after loadAll(). ` +
			`Looking for prefix "${split?.prefix}". Loaded packs: ${loaded}`;
		console.warn(msg);
		showDiagnosisOnce(msg);
	}
	return resolved;
}
