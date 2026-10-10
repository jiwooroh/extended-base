/**
 * Property type lookup, shared by the table, list, and board views.
 *
 * Obsidian's `metadataTypeManager` is not part of the public API, so the
 * shape we depend on is declared here and every access is optional —
 * a missing manager just falls back to the generic text icon.
 */
import { App } from 'obsidian';

/** The property descriptor `getPropertyInfo` returns, as far as we use it. */
interface PropertyInfo {
	widget?: string;
	type?: string;
}

/** The slice of the internal `metadataTypeManager` this plugin relies on. */
interface MetadataTypeManager {
	getPropertyInfo?(name: string): PropertyInfo | string | undefined;
}

interface AppWithMetadataTypes extends App {
	metadataTypeManager?: MetadataTypeManager;
}

const NAMESPACES = new Set(['note', 'formula', 'file']);

/**
 * Strip a Bases property id's `note.`/`file.`/`formula.` namespace, leaving
 * the bare frontmatter property name. Some contexts (the legacy `type:
 * "bases"` view declaration this plugin's table view keeps for
 * compatibility — see `NOTION_TABLE_VIEW` in constants.ts) hand properties
 * to the view already normalized to their bare name, with no namespace
 * prefix at all; naively stripping everything before the first `.` in that
 * case would mangle (or, worse, empty out) the name, so a leading segment
 * that isn't one of the three known namespaces is left alone.
 */
export function propBareName(prop: string): string {
	const dot = prop.indexOf('.');
	if (dot === -1) return prop;
	const ns = prop.slice(0, dot);
	return NAMESPACES.has(ns) ? prop.slice(dot + 1) : prop;
}

/**
 * Whether a property's cells should be treated as editable frontmatter.
 * `file.*`/`formula.*` are read-only by nature (derived, not stored in this
 * note's own frontmatter); everything else — `note.*`, and a bare,
 * already-normalized name (see {@link propBareName}) — is.
 */
export function isEditableProp(prop: string): boolean {
	return !prop.startsWith('file.') && !prop.startsWith('formula.');
}

/**
 * The registered type of a property (`text`, `number`, `date`, …), or
 * undefined when Obsidian has no record of it.
 */
export function getPropertyMetaType(app: App, prop: string): string | undefined {
	const mtm = (app as AppWithMetadataTypes).metadataTypeManager;
	const info = mtm?.getPropertyInfo?.(propBareName(prop).toLowerCase());
	if (typeof info === 'string') return info;
	return info?.widget ?? info?.type;
}

/** The Lucide icon name to show in a column header for this property. */
export function getPropertyIcon(app: App, prop: string): string {
	if (prop.startsWith('file.') && propBareName(prop) === 'name') return 'file-text';

	switch (getPropertyMetaType(app, prop)) {
		case 'number':
			return 'hash';
		case 'checkbox':
			return 'check-square';
		case 'date':
		case 'datetime':
			return 'calendar';
		case 'multitext':
		case 'tags':
		case 'aliases':
			return 'tags';
		default:
			return 'type';
	}
}
