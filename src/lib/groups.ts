import { App, BasesEntry, BasesEntryGroup, TFolder } from 'obsidian';
import { LOG_PREFIX } from '../constants';

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
 * Folder-aware grouping for file.folder: nests a group under the nearest
 * *existing* ancestor group, not under every intermediate path segment the
 * way buildGroupTree does. Each node is still labeled with just the folder
 * that directly contains its own files, not the full vault-root-down path.
 *
 * Bases only produces a group for a folder that actually holds files
 * directly — an intermediate folder that's just a pass-through (nothing
 * of its own, only subfolders) never becomes a group at all. So
 * "Masters/Application/Georgia Tech MS-HCI" with nothing directly in
 * Masters or Masters/Application has no ancestor to nest under and
 * renders as a root-level "Georgia Tech MS-HCI". But "UT Austin" (has its
 * own files) and "UT Austin/Short Answer Questions" (a real subfolder,
 * also with its own files) are both real groups, so the second nests
 * under the first — exactly mirroring the vault's actual folder tree,
 * rather than flattening every folder group to one level regardless of
 * whether it's really nested inside another one that's also showing.
 */
export function buildFolderGroups(groups: BasesEntryGroup[]): Map<string, GroupNode> {
	const roots = new Map<string, GroupNode>();
	const nodesByPath = new Map<string, GroupNode>();
	const keyed: { path: string; entries: BasesEntry[] }[] = [];

	for (const group of groups) {
		if (!group.hasKey() || !group.key) {
			roots.set('', { key: '', fullKey: '', entries: [...group.entries], children: new Map() });
			continue;
		}
		keyed.push({ path: group.key.toString(), entries: group.entries });
	}

	// TEMPORARY: diagnosing why some nested folder groups aren't nesting —
	// remove once confirmed.
	console.debug(`${LOG_PREFIX} folder group keys:`, keyed.map((k) => k.path));

	// Shallowest paths first, so a parent's node exists by the time a
	// deeper path goes looking for it.
	keyed.sort((a, b) => a.path.split('/').length - b.path.split('/').length);

	for (const { path, entries } of keyed) {
		const lastSlash = path.lastIndexOf('/');
		const displayKey = lastSlash === -1 ? path : path.slice(lastSlash + 1);
		const node: GroupNode = {
			key: displayKey || path,
			fullKey: path,
			entries: [...entries],
			children: new Map(),
		};
		nodesByPath.set(path, node);

		// Walk up the path looking for the nearest ancestor that's an
		// actual group, skipping any intermediate segment that isn't one.
		let parent: GroupNode | undefined;
		let probe = lastSlash;
		while (probe !== -1) {
			const candidate = path.slice(0, probe);
			const found = nodesByPath.get(candidate);
			if (found) {
				parent = found;
				break;
			}
			probe = candidate.lastIndexOf('/');
		}

		if (parent) {
			parent.children.set(path, node);
		} else {
			roots.set(path, node);
		}
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
 * Drop the single absolute top-level folder from a folder-grouped tree —
 * its own files fall into the ungrouped ('') bucket and its children
 * become the new top-level groups.
 *
 * Which folder counts as "the" absolute top-level one is decided from the
 * vault's real folder tree (the vault root has exactly one subfolder),
 * never from which groups merely happen to be roots in this filtered
 * Base's results. A Base's filters can easily leave only one top-level
 * *group* behind (e.g. everything else got filtered out) without that
 * folder being the vault's actual sole top-level folder — unwrapping it
 * anyway would wrongly promote its real subfolders (like "Short Answer
 * Questions" under "UT Austin") to siblings and dump its own files into
 * the ungrouped bucket, destroying the nesting.
 */
export function hideSoleTopLevelFolder(app: App, roots: Map<string, GroupNode>): Map<string, GroupNode> {
	const vaultTopFolders = app.vault.getRoot().children.filter((f): f is TFolder => f instanceof TFolder);
	if (vaultTopFolders.length !== 1) return roots;

	const top = roots.get(vaultTopFolders[0].path);
	if (!top) return roots;

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
	// Any other root (not the vault's sole top folder, not '') is left as-is.
	for (const [key, node] of roots) {
		if (key === '' || key === vaultTopFolders[0].path) continue;
		result.set(key, node);
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
