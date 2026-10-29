/**
 * The `notion-table` Bases view: renders query results as a Notion-style table
 * with hover OPEN buttons, colored pills, inline editing, and a select editor
 * for pill cells. Re-renders from scratch on every `onDataUpdated`.
 */
import {
	BasesEntry,
	BasesPropertyId,
	BasesView,
	BooleanValue,
	FileValue,
	LinkValue,
	Notice,
	NumberValue,
	Platform,
	QueryController,
	TFile,
	Menu,
	MarkdownRenderer,
	setIcon,
} from 'obsidian';
import { LOG_PREFIX, NOTION_BOARD_VIEW } from '../constants';
import { PinnedColors, applyPillColor, colorByName, resolvePillColor, resolvePillOpacity } from '../lib/colors';
import { PillDetection, computePillProps, parsePinnedColors, pillLabel, stripPath } from '../lib/pills';
import { buildFolderGroups, countEntries, GroupNode, hideSoleTopLevelFolder, isGroupedByFolder } from '../lib/groups';
import { getPropertyIcon, getPropertyMetaType, isEditableProp, propBareName } from '../lib/property-types';
import { syncPillColorToPrettyProperties } from '../lib/pretty-properties-sync';
import { renamePillValue } from '../lib/rename';
import { TitleIconConfig, readTitleIconConfig, renderTitleIcon } from '../lib/title-icon';
import { isNullish, valueToStrings } from '../lib/values';
import { buildColorMenu } from './color-menu';
import { NotePageModal, OpenSelectOpts } from './note-modal';
import { SelectEditor } from './select-editor';

/**
 * Internal shape of the core toolbar's new-item menu (`QueryController.
 * newItemMenu` — not in the public API). Guarded at runtime before use.
 */
interface CoreNewItemMenu {
	open(name?: string, frontmatterProcessor?: (fm: Record<string, unknown>) => void): Promise<void>;
	close(): void;
}

export class NotionBoardView extends BasesView {
	readonly type = NOTION_BOARD_VIEW;
	private rootEl: HTMLElement;
	/** The controller this view was created for (holds the core toolbar). */
	private readonly queryCtrl: QueryController;
	/** True while the toolbar's New button is rerouted to the page panel. */
	private newButtonPatched = false;
	/** Pill / list classification, recomputed each update. */
	private pills: PillDetection = { pillProps: new Set(), listProps: new Set() };
	/** User-pinned value → color overrides from the `pinnedColors` view option. */
	private pinnedColors: PinnedColors = new Map();
	/** How a note's title icon renders (the `titleIcon`/`titleIconCustom` view options). */
	private titleIconCfg: TitleIconConfig = { show: true };
	/** Whether to also push pill colors into the Pretty Properties plugin (the `syncPrettyProperties` view option). */
	private syncPP = false;
	/** How a card property's name renders next to its value (the `propertyLabelDisplay` view option). */
	private propertyLabelDisplay: 'icon-name' | 'icon' | 'name' | 'none' = 'none';
	/** The open select editor, if any (also drives outside-click detection). */
	private selectEditor: SelectEditor | null = null;
	/** Set of subgroup full keys (nested folders within a column) that are currently collapsed. */
	private collapsedSubgroups = new Set<string>();
	/** The open column-color picker flyout, if any (also drives outside-click detection). */
	private colorMenuEl: HTMLElement | null = null;

	constructor(controller: QueryController, parentEl: HTMLElement) {
		super(controller);
		this.queryCtrl = controller;
		this.rootEl = parentEl.createDiv({ cls: 'ntn-root ntn-board-view' });
		this.register(() => this.closeSelectMenu());
		this.register(() => this.closeColorMenu());
		// rootEl.doc resolves to the view's own document, so this also works
		// when the view lives in a popout window (plain `document` would not).
		// One persistent capture-phase listener that no-ops unless a menu is open
		// — do not revert to a per-menu `document.addEventListener`.
		this.registerDomEvent(this.rootEl.doc, 'pointerdown', (evt) => {
			if (!this.selectEditor) return;
			const target = evt.target as Node;
			if (this.selectEditor.contains(target)) return;
			// A click on the anchoring cell is left to that cell's own click
			// handler, which toggles the menu shut (see openSelectEditor).
			// Closing here too would let the click re-open it instead.
			if (this.selectEditor.anchorEl.contains(target)) return;
			this.closeSelectMenu();
		}, { capture: true });
		this.registerDomEvent(this.rootEl.doc, 'pointerdown', (evt) => {
			if (!this.colorMenuEl) return;
			if (this.colorMenuEl.contains(evt.target as Node)) return;
			this.closeColorMenu();
		}, { capture: true });
		this.patchToolbarNew();
	}

	private closeColorMenu(): void {
		this.colorMenuEl?.remove();
		this.colorMenuEl = null;
	}

	/**
	 * Open the shared Notion-palette color + opacity picker anchored under
	 * `anchorEl` — the same picker the pill select editor uses. Picking a
	 * color or adjusting opacity pins it for `fullKey` via the same
	 * pinnedColors mechanism the select editor writes to.
	 */
	private openColumnColorMenu(anchorEl: HTMLElement, fullKey: string): void {
		this.closeColorMenu();
		this.closeSelectMenu();
		this.colorMenuEl = buildColorMenu({
			doc: this.rootEl.doc,
			win: this.rootEl.win,
			anchorEl,
			currentOpacity: resolvePillOpacity(fullKey, this.pinnedColors),
			onPick: (colorName) => {
				this.setPinnedColor(fullKey, colorName);
				this.closeColorMenu();
				this.onDataUpdated();
			},
			onOpacityChange: (opacity) => {
				this.setPinnedOpacity(fullKey, opacity);
				this.closeColorMenu();
				this.onDataUpdated();
			},
		});
	}


	/**
	 * A collapse/expand toggle rebuilds the whole view (`onDataUpdated`
	 * empties and recreates every element), which on its own drops whatever
	 * ancestor was scrolled down to the card you just clicked back to the
	 * top. `root.empty()` only clears this view's own children, though — the
	 * actual scrolling element (an Obsidian-owned ancestor, not anything of
	 * ours) is never destroyed, so capturing and restoring its `scrollTop`
	 * around the rebuild is enough to keep the view where it was.
	 */
	private refreshPreservingScroll(): void {
		const scrollEl = this.findScrollParent();
		const scrollTop = scrollEl?.scrollTop;
		this.onDataUpdated();
		if (scrollEl && scrollTop !== undefined) scrollEl.scrollTop = scrollTop;
	}

	/** The nearest ancestor that's actually scrollable, or null if none is. */
	private findScrollParent(): HTMLElement | null {
		let el = this.rootEl.parentElement;
		while (el) {
			if (el.scrollHeight > el.clientHeight) return el;
			el = el.parentElement;
		}
		return null;
	}

	onDataUpdated(): void {
		// The toolbar may not have existed at construction time; retry until
		// the patch lands (no-op once it has).
		this.patchToolbarNew();
		const root = this.rootEl;
		root.empty();

		// Default-on: only an explicit `false` turns wrapping off (mirrors verticalLines).
		root.toggleClass('ntn-wrap', this.config.get('wrapCells') !== false);
		root.toggleClass('ntn-vlines', this.config.get('verticalLines') !== false);

		const props = this.config.getOrder();
		this.pills = computePillProps(props, this.data.data, this.config, this.app);
		this.pinnedColors = parsePinnedColors(this.config.get('pinnedColors'));
		this.titleIconCfg = readTitleIconConfig(this.config);
		this.syncPP = this.config.get('syncPrettyProperties') === true;
		const labelDisplay = this.config.get('propertyLabelDisplay');
		this.propertyLabelDisplay = labelDisplay === 'icon-name' || labelDisplay === 'icon' || labelDisplay === 'name'
			? labelDisplay : 'none';

		const boardContainer = root.createDiv({ cls: 'ntn-board-container' });

		const widthPx = { small: 200, medium: 240, large: 320 }[
			this.config.get('boardColumnWidth') as string
		] ?? 240;
		boardContainer.setCssProps({ '--ntn-board-col-width': `${widthPx}px` });

		let hiddenGroups = this.config.get('hiddenGroups') as string[];
		if (!Array.isArray(hiddenGroups)) hiddenGroups = [];
		const folderGrouped = isGroupedByFolder(this.app, this.data.groupedData);

		// Off by default so existing boards look unchanged: tag-grouped
		// columns already always show their pills regardless of this
		// setting, and folder-grouped columns stay plain bold text until
		// opted in. 'label' additionally colors a folder column's own
		// heading; 'background' tints every column's background with its
		// group color; 'both' does both.
		const colorDisplay = (this.config.get('groupColorDisplay') as string) || 'off';
		const showLabelColor = colorDisplay === 'label' || colorDisplay === 'both';
		const showBgTint = colorDisplay === 'background' || colorDisplay === 'both';

		// One column per *top-level* group. For folder grouping this walks
		// the same nested tree table/list use (so the sole top-level
		// wrapper folder is hidden the same way), but — unlike table/list —
		// a deeper subfolder does NOT get its own column: every descendant,
		// however many levels down, renders as a labeled card cluster
		// inside its top-level column instead, indented and nested one
		// step per real level (not flattened to one step for all of them,
		// so a subfolder's own subfolder still reads as nested under it,
		// and collapsing a subfolder collapses everything under it too).
		// A board with one column per nested subfolder doesn't read as a
		// Kanban board any more; Notion's own folder-grouped board does
		// the same — one column per top-level folder, deeper folders
		// shown as sections within it.
		const columns: { key: string; fullKey: string; entries: BasesEntry[]; subgroups: GroupNode[] }[] = [];
		if (folderGrouped) {
			const roots = hideSoleTopLevelFolder(buildFolderGroups(this.data.groupedData));
			for (const node of roots.values()) {
				if (node.key) {
					columns.push({
						key: node.key,
						fullKey: node.fullKey,
						entries: node.entries,
						subgroups: [...node.children.values()],
					});
				} else if (node.entries.length) {
					columns.push({ key: 'No Status', fullKey: 'No Status', entries: node.entries, subgroups: [] });
				}
			}
		} else {
			for (const group of this.data.groupedData) {
				const rawGroupKey = group.hasKey() && group.key ? group.key.toString() : 'No Status';
				columns.push({ key: rawGroupKey, fullKey: rawGroupKey, entries: group.entries, subgroups: [] });
			}
		}

		for (const col of columns) {
			if (hiddenGroups.includes(col.fullKey)) continue;

			const colWrap = boardContainer.createDiv({ cls: 'ntn-board-column' });
			if (showBgTint) {
				colWrap.addClass('ntn-board-column-tinted');
				const c = resolvePillColor(col.fullKey, this.pinnedColors);
				colWrap.setCssProps({
					'--ntn-board-tint-light': c.lightBg,
					'--ntn-board-tint-dark': c.darkBg,
				});
			}
			const colHeader = colWrap.createDiv({ cls: 'ntn-board-column-header' });

			const headerTitles = colHeader.createDiv({ cls: 'ntn-board-column-titles' });

			colHeader.addEventListener('contextmenu', (evt) => {
				evt.preventDefault();
				const menu = new Menu();
				menu.addItem((item) => {
					item.setTitle('Set color')
						.setIcon('palette')
						.onClick(() => this.openColumnColorMenu(headerTitles, col.fullKey));
				});
				menu.addItem((item) => {
					item.setTitle('Hide group')
						.setIcon('eye-off')
						.onClick(() => {
							const newHidden = [...hiddenGroups, col.fullKey];
							this.config.set('hiddenGroups', newHidden);
						});
				});
				menu.showAtMouseEvent(evt);
			});

			if (folderGrouped) {
				// One flat label for the folder that directly contains these
				// files — not the pill-per-level stack below, and not the
				// full vault-root-down path. Plain bold text by default (a
				// folder isn't really a tag), but the "Show group color as"
				// view option can color it like any other pill.
				if (showLabelColor) {
					const pill = headerTitles.createSpan({ cls: 'ntn-pill ntn-group-folder-pill' });
					this.applyPillColor(pill, col.fullKey);
					pill.setText(col.key);
				} else {
					headerTitles.createSpan({ cls: 'ntn-group-folder-label', text: col.key });
				}
			} else {
				const parts = col.fullKey === 'No Status' ? ['No Status'] : col.fullKey.split('/');
				for (let i = 0; i < parts.length; i++) {
					const part = parts[i];
					const pill = headerTitles.createSpan({ cls: 'ntn-pill' });
					const currentFullKey = parts.slice(0, i + 1).join('/');
					this.applyPillColor(pill, currentFullKey);
					pill.setText(part);
					if (i > 0) {
						// Nested group levels step in; the stylesheet reads the offset.
						pill.addClass('ntn-board-header-pill-nested');
						pill.setCssProps({ '--ntn-indent': `${i * 12}px` });
					}
				}
			}

			const totalCount = col.entries.length
				+ col.subgroups.reduce((sum, sg) => sum + countEntries(sg), 0);
			colHeader.createSpan({ cls: 'ntn-group-count', text: String(totalCount) });

			const cardsWrap = colWrap.createDiv({ cls: 'ntn-board-cards' });
			for (const entry of col.entries) {
				this.renderCard(cardsWrap, entry, props, 0);
			}
			// Deeper subfolders render as a labeled, collapsible section
			// inside this column rather than spawning their own column (see
			// comment above `columns`) — recursively, one indent step per
			// real level, so a subfolder's own subfolder nests under it
			// instead of sitting flat alongside it; collapsing one hides
			// every subfolder (and card) nested under it too.
			const renderSubgroup = (sub: GroupNode, depth: number): void => {
				const isCollapsed = this.collapsedSubgroups.has(sub.fullKey);
				const subLabel = cardsWrap.createDiv({ cls: 'ntn-board-subgroup-label' });
				subLabel.setCssProps({ '--ntn-indent': `${depth * 16}px` });
				const toggleIcon = subLabel.createSpan({ cls: 'ntn-group-toggle' });
				toggleIcon.setText(isCollapsed ? '▶' : '▼');
				// Always on, no view option — a quick visual cue this is a
				// nested subfolder, not another top-level column.
				const folderIcon = subLabel.createSpan({ cls: 'ntn-group-folder-icon' });
				setIcon(folderIcon, 'folder');
				subLabel.createSpan({ text: sub.key });
				subLabel.createSpan({ cls: 'ntn-group-count', text: String(countEntries(sub)) });
				subLabel.addEventListener('click', () => {
					if (isCollapsed) {
						this.collapsedSubgroups.delete(sub.fullKey);
					} else {
						this.collapsedSubgroups.add(sub.fullKey);
					}
					this.refreshPreservingScroll();
				});
				if (isCollapsed) return;
				for (const entry of sub.entries) {
					this.renderCard(cardsWrap, entry, props, depth * 16);
				}
				for (const child of sub.children.values()) {
					renderSubgroup(child, depth + 1);
				}
			};
			for (const sub of col.subgroups) renderSubgroup(sub, 0);

			// A small "+ New" at the bottom of each column
			const colNew = colWrap.createDiv({ cls: 'ntn-board-column-new' });
			colNew.createSpan({ cls: 'ntn-new-plus', text: '+' });
			colNew.createSpan({ text: 'New' });
			colNew.addEventListener('click', () => void this.createAndOpenPage());
		}

		// Hidden groups collapse to a pill-shaped strip instead of
		// disappearing — their name still reads and clicking one un-hides
		// it. All of them stack vertically in one narrow rail at the right
		// edge of the board (not side by side as separate full-height
		// columns), so hiding several groups doesn't eat up horizontal
		// space.
		const hiddenCols = columns.filter((col) => hiddenGroups.includes(col.fullKey));
		if (hiddenCols.length) {
			const rail = boardContainer.createDiv({ cls: 'ntn-board-hidden-rail' });
			for (const col of hiddenCols) {
				const collapsed = rail.createDiv({
					cls: 'ntn-board-column-collapsed ntn-pill',
					attr: { 'aria-label': `Show "${col.key}"` },
				});
				this.applyPillColor(collapsed, col.fullKey);
				collapsed.createSpan({ cls: 'ntn-board-collapsed-label', text: col.key });
				collapsed.createSpan({ cls: 'ntn-group-count', text: String(col.entries.length) });
				collapsed.addEventListener('click', () => {
					this.config.set('hiddenGroups', hiddenGroups.filter((k) => k !== col.fullKey));
				});
			}
		}

		// ---- "+ New" footer for the entire board (if they want an unassigned note) ----
		const footerWrap = root.createDiv({ cls: 'ntn-footer-wrap' });
		const newRow = footerWrap.createDiv({ cls: 'ntn-new-row' });
		newRow.createSpan({ cls: 'ntn-new-plus', text: '+' });
		newRow.createSpan({ text: 'New' });
		newRow.addEventListener('click', () => void this.createAndOpenPage());
	}

	private renderCard(
		container: HTMLElement,
		entry: BasesEntry,
		props: BasesPropertyId[],
		indent = 0,
	): void {
		const cardEl = container.createDiv({ cls: 'ntn-board-card' });
		// Matches the subfolder header's own indent one level up, so a
		// card visibly belongs to the (possibly nested) subfolder section
		// it's listed under.
		if (indent) cardEl.setCssProps({ '--ntn-indent': `${indent}px` });

		// Title is always first
		const titleWrap = cardEl.createDiv({ cls: 'ntn-board-card-title' });
		this.renderCell(titleWrap, entry, 'file.name');

		// Skipped entirely (not just left empty) when nothing qualifies —
		// an empty-but-present flex child still claims .ntn-board-card's own
		// `gap` between it and the title above, padding the card for nothing.
		const visibleProps = props.filter((prop) => prop !== 'file.name' && !this.isCellEmpty(entry, prop));
		if (!visibleProps.length) return;
		const propsWrap = cardEl.createDiv({ cls: 'ntn-board-card-props' });
		for (const prop of visibleProps) {
			const cellWrap = propsWrap.createDiv({ cls: 'ntn-board-cell' });
			this.renderPropertyLabel(cellWrap, prop);
			const valueWrap = cellWrap.createDiv({ cls: 'ntn-board-cell-value' });
			this.renderCell(valueWrap, entry, prop);
		}
	}

	/**
	 * A property's icon and/or name, shown ahead of its value per the
	 * `propertyLabelDisplay` view option — off (`none`) by default, since a
	 * board card is already tight on space and the property's own value
	 * (a pill, a date, …) is often self-explanatory without it.
	 */
	private renderPropertyLabel(cellWrap: HTMLElement, prop: BasesPropertyId): void {
		if (this.propertyLabelDisplay === 'none') return;
		const labelWrap = cellWrap.createDiv({ cls: 'ntn-board-cell-label' });
		if (this.propertyLabelDisplay === 'icon' || this.propertyLabelDisplay === 'icon-name') {
			const iconSpan = labelWrap.createSpan({ cls: 'ntn-board-cell-icon' });
			setIcon(iconSpan, getPropertyIcon(this.app, prop));
		}
		if (this.propertyLabelDisplay === 'name' || this.propertyLabelDisplay === 'icon-name') {
			labelWrap.createSpan({ cls: 'ntn-board-cell-label-text', text: this.config.getDisplayName(prop) });
		}
	}

	/**
	 * Whether a property has nothing to show for this entry — an empty-list
	 * pill, or a nullish plain value. A card otherwise grows one full row
	 * taller per *configured* property regardless of whether this note
	 * actually has anything in it, which with many columns stacked up a lot
	 * of dead vertical space. A checkbox is never "empty": unchecked is a
	 * real, meaningful value, not an absent one.
	 */
	private isCellEmpty(entry: BasesEntry, prop: BasesPropertyId): boolean {
		const value = entry.getValue(prop);
		if (this.pills.pillProps.has(prop)) return valueToStrings(value).length === 0;
		if (value instanceof BooleanValue) return false;
		if (isNullish(value) && getPropertyMetaType(this.app, prop) === 'checkbox') return false;
		return isNullish(value);
	}

	private renderCell(td: HTMLElement, entry: BasesEntry, prop: BasesPropertyId): void {
		if (prop === 'file.name') {
			td.addClass('ntn-col-title'); // Inherit some styling like min-width
			
			const titleWrap = td.createDiv({ cls: 'ntn-title-wrap' });
			renderTitleIcon(titleWrap, this.titleIconCfg, this.app, entry);

			const link = titleWrap.createSpan({ text: entry.file.basename, cls: 'ntn-title-text' });
			link.addEventListener('click', (evt) => {
				// Ctrl/Cmd always means "new tab", whatever `openMode` says.
				const modified = evt.ctrlKey || evt.metaKey;
				if (!modified && this.config.get('openMode') === 'panel') {
					this.openPagePanel(entry.file);
					return;
				}
				void this.app.workspace.openLinkText(entry.file.path, '', modified);
			});
			return;
		}

		const value = entry.getValue(prop);
		const editable = isEditableProp(prop);
		const propName = propBareName(prop);

		// ---- Pills (lists, tags, user-selected select-like properties) ----
		if (this.pills.pillProps.has(prop)) {
			const disableColorColumns = this.config.get('disableColorColumns') as string[] || [];
			const useDefaultColor = !disableColorColumns.includes(prop);

			const wrap = td.createDiv({ cls: 'ntn-pills' });
			const items = valueToStrings(value);
			for (const item of items) {
				const pill = wrap.createSpan({ cls: 'ntn-pill' });
				this.applyPillColor(pill, item, useDefaultColor);
				pill.setText(pillLabel(item));
				if (this.syncPP) {
					syncPillColorToPrettyProperties(
						this.app, td.doc, propName, pillLabel(item),
						resolvePillColor(item, this.pinnedColors, useDefaultColor),
					);
				}
			}
			if (editable) {
				td.addClass('ntn-editable');
				td.addEventListener('click', () =>
					this.openSelectEditor(td, entry, prop, propName, useDefaultColor),
				);
				// Keep an open menu pointed at this re-rendered cell so
				// click-to-toggle keeps working after a write re-renders the table.
				this.selectEditor?.reanchorIfMatches(td, entry.file.path, prop);
			}
			return;
		}

		// ---- Checkboxes write straight back to frontmatter ----
		// A checkbox property with nothing set yet comes back as a nullish
		// value, not a `BooleanValue(false)` — still render it as an
		// (unchecked) checkbox rather than an empty cell, using the
		// vault-registered property type to recognize it.
		if (value instanceof BooleanValue || (isNullish(value) && getPropertyMetaType(this.app, prop) === 'checkbox')) {
			const cb = td.createEl('input', { type: 'checkbox', cls: 'ntn-checkbox' });
			cb.checked = value instanceof BooleanValue && value.isTruthy();
			if (editable) {
				cb.addEventListener('change', () => {
					void this.writeProperty(entry.file, propName, cb.checked);
				});
			} else {
				cb.disabled = true;
			}
			return;
		}

		// ---- Plain values: native render, click-to-edit for note.* ----
		const cellEl = td.createDiv({ cls: 'ntn-cell' });
		if (!isNullish(value)) {
			const raw = value.toString();
			// stripPath is for link/file paths only ("Folder/Note" -> "Note");
			// applying it to freeform text truncates any value that happens to
			// contain a "/" (a fraction, a date, a unit like "km/h", …).
			const strVal = (value instanceof LinkValue || value instanceof FileValue)
				? stripPath(raw)
				: raw;
			const metaType = getPropertyMetaType(this.app, prop);
			if (strVal && (!metaType || metaType === 'text' || metaType === 'multitext')) {
				void MarkdownRenderer.render(this.app, strVal, cellEl, entry.file.path, this);
			} else {
				value.renderTo(cellEl, this.app.renderContext);
			}
		}
		if (editable) {
			td.addClass('ntn-editable');
			const kind = value instanceof NumberValue ? 'number' : 'text';
			td.addEventListener('click', (evt) => {
				// Don't hijack clicks on links rendered inside the cell.
				if ((evt.target as HTMLElement).closest('a')) return;
				this.editCell(td, entry, propName, isNullish(value) ? '' : value.toString(), kind);
			});
		}
	}

	/** Swap a cell's content for an input; commit on Enter/blur, cancel on Esc. */
	private editCell(
		td: HTMLElement,
		entry: BasesEntry,
		propName: string,
		current: string,
		kind: 'text' | 'number',
	): void {
		if (td.querySelector('.ntn-input')) return; // already editing
		// Size the editor to the cell as it currently renders, rather than a
		// fixed size — measure before emptying (which would collapse the cell).
		const rect = td.getBoundingClientRect();
		// A cell taller than a single line (wrapped long text) needs a textarea
		// so the text wraps and stays visible; a single-line <input> would just
		// scroll it horizontally. Numbers always use a single-line input.
		const multiline = kind === 'text' && rect.height > 40;
		td.empty();
		const input = multiline
			? td.createEl('textarea', { cls: 'ntn-input ntn-textarea' })
			: td.createEl('input', { type: 'text', cls: 'ntn-input' });
		input.setCssStyles({ width: `${rect.width}px`, height: `${rect.height}px` });
		input.value = current;
		input.focus();
		input.select();

		let committed = false;
		const commit = () => {
			if (committed) return;
			committed = true;
			const raw = input.value.trim();
			// Unchanged value: no write fires, so Bases won't re-render — discard
			// the input ourselves, otherwise the edit box lingers in the cell.
			if (raw === current) {
				this.onDataUpdated();
				return;
			}
			let out: unknown = raw;
			if (kind === 'number') {
				const n = Number(raw);
				out = raw === '' ? null : (Number.isNaN(n) ? raw : n);
			} else if (raw === '') {
				out = null;
			}
			void this.writeProperty(entry.file, propName, out);
		};

		input.addEventListener('keydown', (ev: Event) => {
			const evt = ev as KeyboardEvent;
			if (evt.key === 'Enter' && !evt.shiftKey) {
				// Shift+Enter inserts a newline in the textarea; plain Enter commits.
				evt.preventDefault();
				commit();
			} else if (evt.key === 'Escape') {
				committed = true; // suppress blur commit
				this.onDataUpdated(); // re-render, discarding the edit
			}
		});
		input.addEventListener('blur', commit);
	}

	private async writeProperty(file: TFile, propName: string, value: unknown): Promise<void> {
		try {
			await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
				if (value === null) {
					delete fm[propName];
				} else {
					fm[propName] = value;
				}
			});
			// Bases reacts to the metadata change and calls onDataUpdated for us.
		} catch (e) {
			console.error(`${LOG_PREFIX} failed to write property`, propName, e);
			new Notice(`Couldn't update "${propName}".`);
			this.onDataUpdated();
		}
	}

	/**
	 * Reroute the core toolbar's New button to the page panel while this
	 * view is active. The button lives on the query controller, outside this
	 * view's DOM, so its menu's `open` is shadowed on the instance and
	 * restored on unload. `newItemMenu` is internal API — if it ever moves,
	 * the guard below simply leaves the core behavior untouched (and the
	 * footer "+ New" falls back to its own capture flow).
	 */
	private patchToolbarNew(): void {
		if (this.newButtonPatched) return;
		const menu = (this.queryCtrl as unknown as { newItemMenu?: CoreNewItemMenu })
			.newItemMenu;
		if (!menu || typeof menu.open !== 'function' || typeof menu.close !== 'function') {
			return;
		}

		const orig = menu.open.bind(menu);
		const patched = async (
			name?: string,
			fmProc?: (fm: Record<string, unknown>) => void,
		): Promise<void> => {
			// Phones already get a full-screen tab from the core flow.
			if (Platform.isPhone) return orig(name, fmProc);
			let created: TFile | undefined;
			const ref = this.app.vault.on('create', (file) => {
				if (file instanceof TFile) created = file;
			});
			// Keep the core popover invisible for the instant it exists.
			const body = this.rootEl.doc.body;
			body.addClass('ntn-hide-new-popover');
			try {
				// The core flow still creates the file (folder + filter
				// frontmatter) and opens its popover, hidden by the class above.
				await orig(name, fmProc);
			} finally {
				this.app.vault.offref(ref);
				menu.close(); // tear down the hidden popover
				body.removeClass('ntn-hide-new-popover');
			}
			if (created) this.openPagePanel(created);
		};

		menu.open = patched;
		this.newButtonPatched = true;
		this.register(() => {
			// The bound original behaves identically for any later caller.
			menu.open = orig;
			this.newButtonPatched = false;
		});
	}

	/**
	 * "+ New" flow: create the note through the core Bases flow — so it lands
	 * in the configured folder and gets the frontmatter implied by the view's
	 * filters — then edit it in the centered Notion-style page panel instead
	 * of the small popover Obsidian anchors to the toolbar's New button.
	 */
	private async createAndOpenPage(): Promise<void> {
		// On phones the core flow already opens the note in a full-screen
		// tab; with the toolbar patch in place, createFileForView routes
		// through the patched menu, which opens the panel for us.
		if (Platform.isPhone || this.newButtonPatched) {
			await this.createFileForView();
			return;
		}
		// createFileForView resolves with void, so capture the file it
		// creates through the vault's create event.
		let created: TFile | undefined;
		const ref = this.app.vault.on('create', (file) => {
			if (file instanceof TFile) created = file;
		});
		try {
			await this.createFileForView();
		} finally {
			this.app.vault.offref(ref);
		}
		if (!created) return;

		// Dismiss the toolbar-anchored popover the core flow opened; the core
		// new-item menu closes itself on any click outside the popover.
		const doc = this.rootEl.doc;
		if (doc.querySelector('.bases-new-item-popover')) doc.body.click();

		this.openPagePanel(created);
	}

	/** Open a note centered in the Notion-style page panel. */
	private openPagePanel(file: TFile): void {
		new NotePageModal(this.app, file, {
			applyColor: (pill, text) => this.applyPillColor(pill, text),
			write: (f, propName, value) => this.writeProperty(f, propName, value),
			isPillProp: (name) =>
				this.pills.pillProps.has(`note.${name}` as BasesPropertyId),
			isListProp: (name) =>
				this.pills.listProps.has(`note.${name}` as BasesPropertyId),
			openSelect: (opts) => this.openSelectAt(opts),
			reanchorSelect: (anchor, filePath, propName) =>
				void this.selectEditor?.reanchorIfMatches(
					anchor, filePath, `note.${propName}` as BasesPropertyId,
				),
			closeSelect: () => this.closeSelectMenu(),
		}).open();
	}

	/** Color a pill element using this view's pinned-color overrides. */
	private applyPillColor(pill: HTMLElement, text: string, useDefaultColor = true): void {
		applyPillColor(pill, text, this.pinnedColors, useDefaultColor);
	}

	/** Open the Notion-style select editor for a pill cell of the table. */
	private openSelectEditor(
		td: HTMLElement,
		entry: BasesEntry,
		prop: BasesPropertyId,
		propName: string,
		useDefaultColor = true,
	): void {
		this.openSelectAt({
			anchor: td,
			file: entry.file,
			propName,
			current: valueToStrings(entry.getValue(prop)),
			isList: this.pills.listProps.has(prop),
			useDefaultColor,
		});
	}

	/**
	 * Open the select editor anchored anywhere — a table cell or a property
	 * row of the page panel. Known values always come from the live query
	 * result; lifetime stays with the view (outside-click / Esc / unload).
	 */
	private openSelectAt(opts: OpenSelectOpts): void {
		// Clicking the element whose menu is already open toggles it shut.
		if (this.selectEditor?.anchorEl === opts.anchor) {
			this.closeSelectMenu();
			return;
		}
		this.closeSelectMenu();
		const prop = `note.${opts.propName}` as BasesPropertyId;
		this.selectEditor = new SelectEditor({
			doc: this.rootEl.doc,
			win: this.rootEl.win,
			anchor: opts.anchor,
			entries: this.data.data,
			file: opts.file,
			current: opts.current,
			prop,
			isList: opts.isList,
			applyColor: (pill, text) => this.applyPillColor(pill, text, opts.useDefaultColor ?? true),
			write: (value) =>
				void this.writeProperty(opts.file, opts.propName, value)
					.then(() => opts.onWrite?.()),
			setColor: (value, colorName) => this.setPinnedColor(value, colorName),
			getOpacity: (value) => resolvePillOpacity(value, this.pinnedColors),
			setOpacity: (value, opacity) => this.setPinnedOpacity(value, opacity),
			renameOption: (oldValue, newValue) => this.renameOption(prop, opts.propName, oldValue, newValue),
			getOrder: () => this.getSelectOptionOrder(opts.propName),
			setOrder: (order) => this.setSelectOptionOrder(opts.propName, order),
			onClose: () => { this.selectEditor = null; },
		});
	}

	/** Saved option order for a select/pill property (lowercased value keys). */
	private getSelectOptionOrder(propName: string): string[] {
		const map = this.config.get('selectOrders') as Record<string, string[]> | undefined;
		const order = map?.[propName];
		return Array.isArray(order) ? order.map((s) => String(s).toLowerCase()) : [];
	}

	/** Persist a select/pill property's option order, keyed by its bare name. */
	private setSelectOptionOrder(propName: string, order: string[]): void {
		const current = this.config.get('selectOrders') as Record<string, string[]> || {};
		this.config.set('selectOrders', { ...current, [propName]: order });
	}

	/**
	 * Pin a value to a specific Notion color. Updates the live map for instant
	 * feedback in the open editor, then persists into the `pinnedColors` view
	 * option so it survives reloads and is editable from the view settings
	 * too. Keeps whatever opacity the value already had pinned.
	 */
	private setPinnedColor(value: string, colorName: string): void {
		const key = value.replace(/^#/, '').toLowerCase();

		if (colorName === 'default') {
			this.pinnedColors.delete(key);
		} else {
			const color = colorByName(colorName);
			if (!color) return;
			const opacity = this.pinnedColors.get(key)?.opacity ?? 100;
			this.pinnedColors.set(key, { color, opacity });
		}

		this.persistPinnedColors();
	}

	/**
	 * Set a value's pinned color's opacity. If the value isn't explicitly
	 * pinned yet (still on its deterministic hash color), pins that color
	 * first — opacity is a property of a pinned color, not of the value by
	 * itself.
	 */
	private setPinnedOpacity(value: string, opacity: number): void {
		const key = value.replace(/^#/, '').toLowerCase();
		const color = this.pinnedColors.get(key)?.color ?? resolvePillColor(value, this.pinnedColors);
		this.pinnedColors.set(key, { color, opacity: Math.max(0, Math.min(100, opacity)) });
		this.persistPinnedColors();
	}

	/** Rewrite the `pinnedColors` view option from the live map. */
	private persistPinnedColors(): void {
		const list: string[] = [];
		for (const [key, entry] of this.pinnedColors) {
			list.push(entry.opacity === 100
				? `${key}=${entry.color.name}`
				: `${key}=${entry.color.name}:${entry.opacity}`);
		}
		this.config.set('pinnedColors', list);
	}

	/**
	 * Rename a value everywhere it's used: rewrites every note's
	 * frontmatter that holds it, and carries over any pinned color/opacity
	 * to the new key so the rename doesn't silently lose it.
	 */
	private renameOption(prop: BasesPropertyId, propName: string, oldValue: string, newValue: string): void {
		const oldKey = oldValue.replace(/^#/, '').toLowerCase();
		const newKey = newValue.replace(/^#/, '').toLowerCase();
		const pinned = this.pinnedColors.get(oldKey);
		if (pinned) {
			this.pinnedColors.delete(oldKey);
			this.pinnedColors.set(newKey, pinned);
			this.persistPinnedColors();
		}
		void renamePillValue(this.app, this.data.data, prop, propName, oldValue, newValue);
	}

	private closeSelectMenu(): void {
		this.selectEditor?.close();
		this.selectEditor = null;
	}
}
