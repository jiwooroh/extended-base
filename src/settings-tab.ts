/** The plugin's Obsidian Settings pane: currently just the pill color scheme. */
import { App, PluginSettingTab, Setting } from 'obsidian';
import { COLOR_SCHEMES } from './lib/colors';
import type NotionBasesPlugin from './main';

export class ExtendedBaseSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: NotionBasesPlugin) {
		super(app, plugin);
	}

	display(): void {
		this.containerEl.empty();

		new Setting(this.containerEl)
			.setName('Color scheme')
			.setDesc('The palette pill colors (and the color picker) are drawn from, across every base using Extended Base views.')
			.addDropdown((dropdown) => {
				for (const [id, scheme] of Object.entries(COLOR_SCHEMES)) {
					dropdown.addOption(id, scheme.label);
				}
				dropdown.setValue(this.plugin.settings.colorScheme);
				dropdown.onChange((value) => void this.plugin.setColorScheme(value));
			});
	}
}
