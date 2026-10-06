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
 * Folder-aware grouping for file.folder: nests a group under every real
 * ancestor folder along its path, mirroring the vault's actual folder
 * tree exactly. Each node is still labeled with just the folder that
 * directly contains its own files, not the full vault-root-down path.
 *
 * Bases only produces a group for a folder that actually holds files
 * directly — an intermediate folder that's just a pass-through (nothing
 * of its own, only subfolders) never becomes a group on its own. Rather
 * than skip it and promote its children past it, this synthesizes an
 * empty node for it (0 of its own entries) so it still shows as its own
 * label with its real children nested inside — e.g. "Application" with
 * nothing of its own but "UT Austin"/"Georgia Tech MS-HCI"/etc. as real
 * subfolders still gets its own heading, rather than disappearing and
 * promoting those subfolders to look like unrelated top-level groups.
 */
export function buildFolderGroups(groups: BasesEntryGroup[]): Map<string, GroupNode> {
	const roots = new Map<string, GroupNode>();
	const nodesByPath = new Map<string, GroupNode>();

	const ensureNode = (path: string): GroupNode => {
		const existing = nodesByPath.get(path);
		if (existing) return existing;

		const lastSlash = path.lastIndexOf('/');
		const node: GroupNode = {
			key: lastSlash === -1 ? path : path.slice(lastSlash + 1),
			fullKey: path,
			entries: [],
			children: new Map(),
		};
		nodesByPath.set(path, node);

		if (lastSlash === -1) {
			roots.set(path, node);
		} else {
			ensureNode(path.slice(0, lastSlash)).children.set(path, node);
		}
		return node;
	};

	for (const group of groups) {
		if (!group.hasKey() || !group.key) {
			roots.set('', { key: '', fullKey: '', entries: [...group.entries], children: new Map() });
			continue;
		}
		ensureNode(group.key.toString()).entries.push(...group.entries);
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

/**
 * Drop the single top-level folder group from a folder-grouped tree — its
 * own files fall into the ungrouped ('') bucket and its children become
 * the new top-level groups — but only when there's exactly one root to
 * begin with. With several unrelated top-level groups, each one's name is
 * the only thing telling them apart, so this leaves them alone rather than
 * guessing which one is "the" root.
 *
 * This asks "is there only one visible top-level group right now", not
 * "is this folder the vault's literal root subfolder" — a Base's own
 * filters routinely leave only one top-level group in view (an org folder
 * like "Application" with no files of the vault root's own), and that's
 * exactly the wrapper this is meant to hide. A real folder (e.g. "UT
 * Austin") that happens to have its own nested subfolder (e.g. "Short
 * Answer Questions") is unaffected either way: unwrapping only touches the
 * single root's direct children, so a deeper nested relationship stays
 * intact regardless of which folder gets unwrapped here.
 */
export function hideSoleTopLevelFolder(roots: Map<string, GroupNode>): Map<string, GroupNode> {
	const realRoots = [...roots.entries()].filter(([key]) => key !== '');
	if (realRoots.length !== 1) return roots;

	const [, top] = realRoots[0];
	const result = new Map<string, GroupNode>();

	const ungrouped = roots.get('');
	if (top.entries.length || ungrouped) {
		result.set('', {
			key: '',
			fullKey: '',
			entries: [...(ungrouped?.entries ?? []), ...top.entries],
			children: new Map(),
		});
	}
	for (const [childKey, childNode] of top.children) {
		result.set(childKey, childNode);
	}

	return result;
}

export function countEntries(node: GroupNode): number {
	let count = node.entries.length;
	for (const child of node.children.values()) {
		count += countEntries(child);
	}
	return count;
}
