/** The view-settings options Extended Base adds to the Bases toolbar. */
import { BasesAllOptions, BasesViewConfig } from 'obsidian';

/**
 * The `titleIcon`/`titleIconCustom` options, shared by all four views so a
 * note's title icon is configured the same way everywhere. Spread into each
 * view's option list.
 */
function titleIconOptions(): BasesAllOptions[] {
	return [
		{
			type: 'dropdown',
			key: 'titleIcon',
			displayName: 'Title icon',
			default: 'page',
			options: {
				page: 'Page icon 📄',
				theme: "Obsidian's file icon",
				custom: 'Custom (set below)',
				none: 'Hidden',
			},
		},
		{
			type: 'text',
			key: 'titleIconCustom',
			displayName: 'Custom title icon — an emoji, or a Lucide icon name like file-text',
		},
	];
}

/**
 * Build the option descriptors Obsidian renders in the view's settings.
 * Read the values back at render time with `this.config.get(key)`.
 */
export function buildViewOptions(_config: BasesViewConfig): BasesAllOptions[] {
	return [
		{
			type: 'toggle',
			key: 'wrapCells',
			displayName: 'Wrap all content',
			default: true,
		},
		{
			type: 'toggle',
			key: 'verticalLines',
			displayName: 'Show vertical lines',
			default: true,
		},
		{
			type: 'dropdown',
			key: 'openMode',
			displayName: 'Open notes in',
			default: 'tab',
			options: {
				tab: 'New tab',
				panel: 'Page panel',
			},
		},
		...titleIconOptions(),
		{
			type: 'multitext',
			key: 'pillProperties',
			displayName: 'Properties to show as colored pills',
		},
		{
			type: 'multitext',
			key: 'pinnedColors',
			displayName: 'Pinned pill colors (value=color: gray, brown, orange, yellow, green, blue, purple, pink, red)',
		},
	];
}

export function buildListViewOptions(_config: BasesViewConfig): BasesAllOptions[] {
	return [
		{
			type: 'text',
			key: 'rowCount',
			displayName: 'Row count limit (e.g. 10, 25, 50, 100 or custom. 0 for all)',
			default: '10',
		},
		{
			type: 'dropdown',
			key: 'openMode',
			displayName: 'Open notes in',
			default: 'tab',
			options: {
				tab: 'New tab',
				panel: 'Page panel',
			},
		},
		...titleIconOptions(),
		{
			type: 'multitext',
			key: 'pillProperties',
			displayName: 'Properties to show as colored pills',
		},
		{
			type: 'multitext',
			key: 'pinnedColors',
			displayName: 'Pinned pill colors',
		},
	];
}

export function buildFeedViewOptions(_config: BasesViewConfig): BasesAllOptions[] {
	return [
		{
			type: 'text',
			key: 'rowCount',
			displayName: 'Card count limit (e.g. 5, 10, 25 or custom. 0 for all)',
			default: '5',
		},
		{
			type: 'dropdown',
			key: 'openMode',
			displayName: 'Open notes in',
			default: 'tab',
			options: {
				tab: 'New tab',
				panel: 'Page panel',
			},
		},
		...titleIconOptions(),
		{
			type: 'multitext',
			key: 'pillProperties',
			displayName: 'Properties to show as colored pills',
		},
		{
			type: 'multitext',
			key: 'pinnedColors',
			displayName: 'Pinned pill colors',
		},
	];
}

export function buildBoardViewOptions(_config: BasesViewConfig): BasesAllOptions[] {
	return [
		{
			type: 'property',
			key: 'groupBy',
			displayName: 'Group by property',
		},
		{
			type: 'dropdown',
			key: 'boardColumnWidth',
			displayName: 'Column width',
			default: 'medium',
			options: {
				small: 'Small',
				medium: 'Medium',
				large: 'Large',
			},
		},
		{
			type: 'dropdown',
			key: 'groupColorDisplay',
			displayName: 'Show group color as',
			default: 'off',
			options: {
				off: 'Off',
				label: 'Label only',
				background: 'Background only',
				both: 'Both',
			},
		},
		{
			type: 'dropdown',
			key: 'openMode',
			displayName: 'Open notes in',
			default: 'tab',
			options: {
				tab: 'New tab',
				panel: 'Page panel',
			},
		},
		...titleIconOptions(),
		{
			type: 'multitext',
			key: 'pillProperties',
			displayName: 'Properties to show as colored pills',
		},
		{
			type: 'multitext',
			key: 'pinnedColors',
			displayName: 'Pinned pill colors',
		},
		{
			type: 'multitext',
			key: 'hiddenGroups',
			displayName: 'Hidden groups',
		},
	];
}
