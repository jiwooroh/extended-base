/** The view-settings options Extended Base adds to the Bases toolbar. */
import { BasesAllOptions, BasesViewConfig } from 'obsidian';

/**
 * The `showTitleIcon`/`titleIconProperty` options, shared by all four views
 * so a note's title icon is configured the same way everywhere. The only
 * icon source is a frontmatter property (what a per-file icon plugin like
 * Iconize, synced to frontmatter, actually sets) — there's no other mode,
 * since Obsidian itself has no per-file custom icon of its own to offer.
 * Spread into each view's option list.
 */
function titleIconOptions(): BasesAllOptions[] {
	return [
		{
			type: 'toggle',
			key: 'showTitleIcon',
			displayName: 'Show title icon',
			default: true,
		},
		{
			type: 'text',
			key: 'titleIconProperty',
			displayName: "Icon property — e.g. icon, the frontmatter key a plugin like Iconize's \"sync to frontmatter\" option writes each note's sidebar icon to. A note with nothing set there gets a plain document icon.",
			default: 'icon',
		},
	];
}

/**
 * The `syncPrettyProperties` option, shared by all four views: when on, a
 * list/tag/select pill's resolved color is also pushed into the Pretty
 * Properties plugin's own color store, so a note's real property panel
 * (and its inline tags) shows the same color as this view. Off by default —
 * it writes into another plugin's settings, so it should be an explicit
 * opt-in. Spread into each view's option list.
 */
function prettyPropertiesOptions(): BasesAllOptions[] {
	return [
		{
			type: 'toggle',
			key: 'syncPrettyProperties',
			displayName: "Sync pill colors to Pretty Properties — matches this view's pill colors in the note's own property panel (requires the Pretty Properties plugin; never overwrites a color you picked by hand there)",
			default: false,
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
		...prettyPropertiesOptions(),
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
		...prettyPropertiesOptions(),
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
		...prettyPropertiesOptions(),
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
			key: 'propertyLabelDisplay',
			displayName: "Show a card property's name as",
			default: 'none',
			options: {
				'icon-name': 'Icon + name',
				icon: 'Icon only',
				name: 'Name only',
				none: 'None',
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
		...prettyPropertiesOptions(),
		{
			type: 'multitext',
			key: 'hiddenGroups',
			displayName: 'Hidden groups',
		},
	];
}
