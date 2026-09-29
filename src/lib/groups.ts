import { App, BasesEntry, BasesEntryGroup, TFolder } from 'obsidian';

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
 * Whether Bases' native "Group by" is currently set to file.folder (or
 * anything else that groups by real vault folders). There's no public API
 * for reading which property a view is grouped by — `BasesViewConfig.get`
 * only returns this plugin's own declared options, not Bases' native
 * config, and no `getGroupBy()` exists alongside `getOrder()`/`getSort()` —
 * so this infers it from the data instead: if every group's key is the
 * path of a folder that actually exists in the vault, it's a folder
 * grouping. A tag or arbitrary property would need every distinct value to
 * coincidentally collide with a real folder path, which doesn't happen in
 * practice.
 */
export function isGroupedByFolder(app: App, groups: BasesEntryGroup[]): boolean {
	let sawKeyedGroup = false;
	for (const group of groups) {
		if (!group.hasKey() || !group.key) continue;
		sawKeyedGroup = true;
		const path = group.key.toString();
		if (!(app.vault.getAbstractFileByPath(path) instanceof TFolder)) return false;
	}
	return sawKeyedGroup;
}

export function countEntries(node: GroupNode): number {
	let count = node.entries.length;
	for (const child of node.children.values()) {
		count += countEntries(child);
	}
	return count;
}
