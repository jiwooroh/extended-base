import { BasesEntry, BasesEntryGroup, BasesViewConfig } from 'obsidian';

export interface GroupNode {
	key: string;
	fullKey: string;
	entries: BasesEntry[];
	children: Map<string, GroupNode>;
}

/**
 * Transforms a flat list of groups into a hierarchical tree of GroupNodes.
 */
export function buildGroupTree(groups: BasesEntryGroup[]): Map<string, GroupNode> {
	const roots = new Map<string, GroupNode>();

	for (const group of groups) {
		if (!group.hasKey() || !group.key) {
			roots.set('', { key: '', fullKey: '', entries: [...group.entries], children: new Map() });
			continue;
		}
		
		const rawKey = group.key.toString();
		const parts = rawKey.split('/');
		
		let currentMap = roots;
		let currentFullKey = '';

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			currentFullKey = currentFullKey ? `${currentFullKey}/${part}` : part;
			
			if (!currentMap.has(part)) {
				currentMap.set(part, {
					key: part,
					fullKey: currentFullKey,
					entries: [],
					children: new Map(),
				});
			}
			
			const node = currentMap.get(part)!;
			if (i === parts.length - 1) {
				node.entries.push(...group.entries);
			}
			
			currentMap = node.children;
		}
	}

	return roots;
}

/**
 * Flat, single-level grouping for file.folder: one group per exact folder,
 * labeled with only the folder that directly contains its files — not the
 * full vault-root-down path buildGroupTree would nest through. A folder
 * path is still slash-separated like a hierarchical tag, so without this
 * "Projects/Research/AI" would otherwise render as three nested, collapsible
 * levels instead of a single "AI" group.
 */
export function buildFolderGroups(groups: BasesEntryGroup[]): Map<string, GroupNode> {
	const roots = new Map<string, GroupNode>();

	for (const group of groups) {
		if (!group.hasKey() || !group.key) {
			roots.set('', { key: '', fullKey: '', entries: [...group.entries], children: new Map() });
			continue;
		}

		const rawKey = group.key.toString();
		const lastSlash = rawKey.lastIndexOf('/');
		const displayKey = lastSlash === -1 ? rawKey : rawKey.slice(lastSlash + 1);

		roots.set(rawKey, {
			key: displayKey || rawKey,
			fullKey: rawKey,
			entries: [...group.entries],
			children: new Map(),
		});
	}

	return roots;
}

/**
 * Whether Bases' native "Group by" is currently set to the file.folder
 * property. `BasesConfigFileView.groupBy` isn't part of the typed public
 * API (it's declared as an empty object), so this reads the raw config
 * value defensively — a bare property id, or an object carrying one under
 * `property` — and treats anything else as "not grouped by folder" so
 * ordinary tag/property nesting is unaffected if the shape is ever wrong.
 */
export function isGroupedByFolder(config: BasesViewConfig): boolean {
	const raw = config.get('groupBy');
	if (typeof raw === 'string') return raw === 'file.folder';
	if (raw && typeof raw === 'object') {
		const prop = (raw as { property?: unknown }).property;
		if (typeof prop === 'string') return prop === 'file.folder';
	}
	return false;
}

export function countEntries(node: GroupNode): number {
	let count = node.entries.length;
	for (const child of node.children.values()) {
		count += countEntries(child);
	}
	return count;
}
