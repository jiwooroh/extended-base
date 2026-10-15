/**
 * Extended Base plugin entry point. Registers the table, list, and board
 * Bases views; all rendering and editing lives in `./view`, and reusable,
 * Obsidian-agnostic helpers live in `./lib`.
 */
import { Notice, Plugin } from 'obsidian';
import { NOTION_TABLE_VIEW, NOTION_LIST_VIEW, NOTION_BOARD_VIEW, NOTION_FEED_VIEW } from './constants';
import { setColorScheme } from './lib/colors';
import { DEFAULT_SETTINGS, ExtendedBaseSettings } from './settings';
import { ExtendedBaseSettingTab } from './settings-tab';
import { buildViewOptions, buildListViewOptions, buildBoardViewOptions, buildFeedViewOptions } from './view-options';
import { NotionTableView } from './view/notion-table-view';
import { NotionListView } from './view/notion-list-view';
import { NotionBoardView } from './view/notion-board-view';
import { NotionFeedView } from './view/notion-feed-view';

export default class NotionBasesPlugin extends Plugin {
	settings: ExtendedBaseSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();
		setColorScheme(this.settings.colorScheme);
		this.addSettingTab(new ExtendedBaseSettingTab(this.app, this));

		if (typeof this.registerBasesView !== 'function') {
			new Notice('Extended Base: requires Obsidian 1.10.0+ (registerBasesView API missing).', 8000);
			return;
		}
		const okTable = this.registerBasesView(NOTION_TABLE_VIEW, {
			name: 'Notion Table',
			icon: 'table-2',
			factory: (controller, containerEl) =>
				new NotionTableView(controller, containerEl),
			options: buildViewOptions,
		});

		const okList = this.registerBasesView(NOTION_LIST_VIEW, {
			name: 'Notion List',
			icon: 'list',
			factory: (controller, containerEl) =>
				new NotionListView(controller, containerEl),
			options: buildListViewOptions,
		});

		const okBoard = this.registerBasesView(NOTION_BOARD_VIEW, {
			name: 'Notion Board',
			icon: 'columns',
			factory: (controller, containerEl) =>
				new NotionBoardView(controller, containerEl),
			options: buildBoardViewOptions,
		});

		const okFeed = this.registerBasesView(NOTION_FEED_VIEW, {
			name: 'Notion Feed',
			icon: 'newspaper',
			factory: (controller, containerEl) =>
				new NotionFeedView(controller, containerEl),
			options: buildFeedViewOptions,
		});

		if (!okTable || !okList || !okBoard || !okFeed) {
			new Notice(
				`Extended Base: view registration failed (table=${okTable}, list=${okList}, board=${okBoard}, feed=${okFeed}). Is the Bases core plugin enabled?`,
				8000,
			);
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * Switch the active color scheme and persist it. There's no documented
	 * way to force an already-open base to re-render from here, so this
	 * takes effect the next time one does on its own (switching tabs,
	 * editing a note, reopening it).
	 */
	async setColorScheme(id: string): Promise<void> {
		this.settings.colorScheme = id;
		await this.saveData(this.settings);
		setColorScheme(id);
		new Notice('Extended Base: switch to another tab and back (or reopen the base) to see the new colors.');
	}
}
