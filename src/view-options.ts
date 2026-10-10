/** The view-settings options Extended Base adds to the Bases toolbar. */
import { BasesAllOptions, BasesViewConfig } from 'obsidian';

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
			key: 'textSize',
			displayName: 'Text size',
			default: 'medium',
			options: {
				small: 'Small',
				medium: 'Medium',
				large: 'Large',
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
			key: 'textSize',
			displayName: 'Text size',
			default: 'medium',
			options: {
				small: 'Small',
				medium: 'Medium',
				large: 'Large',
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
			key: 'textSize',
			displayName: 'Text size',
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
