/**
 * The `notion-feed` Bases view: renders query results as a vertical feed of
 * full note cards — title, colored pill properties, and the note's body as
 * a live, directly-editable embedded editor (the same CodeMirror editor
 * Obsidian uses for its own tabs, reparented into the card instead of
 * opened as one). Re-renders from scratch on every `onDataUpdated`, same as
 * the table/list/board views; because a rebuild tears down and remounts
 * every card's embedded editor, any previously mounted leaves are detached
 * first so a rebuild never leaks one.
 */
import {
	App,
	BasesEntry,
	BasesPropertyId,
	BasesView,
	MarkdownView,
	Notice,
	Platform,
	QueryController,
	TFile,
	WorkspaceLeaf,
} from 'obsidian';
import { LOG_PREFIX, NOTION_FEED_VIEW } from '../constants';
import { PinnedColors, applyPillColor, colorByName, resolvePillColor, resolvePillOpacity } from '../lib/colors';
import { PillDetection, computePillProps, parsePinnedColors } from '../lib/pills';
import { buildFolderGroups, buildGroupTree, countEntries, GroupNode, hideSoleTopLevelFolder, isGroupedByFolder } from '../lib/groups';
import { renamePillValue } from '../lib/rename';
import { valueToStrings } from '../lib/values';
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

/**
 * `WorkspaceLeaf` takes the owning `App` in its constructor, but that
 * constructor isn't part of the declared public API surface — same
 * "undocumented but stable" situation as `newItemMenu` above.
 */
type LeafCtor = new (app: App) => WorkspaceLeaf;

export class NotionFeedView extends BasesView {
	readonly type = NOTION_FEED_VIEW;
	private rootEl: HTMLElement;
	/** The controller this view was created for (holds the core toolbar). */
	private readonly queryCtrl: QueryController;
	/** True while the toolbar's New button is rerouted to the page panel. */
	private newButtonPatched = false;
	/** Pill / list classification, recomputed each update. */
	private pills: PillDetection = { pillProps: new Set(), listProps: new Set() };
	/** User-pinned value → color overrides from the `pinnedColors` view option. */
	private pinnedColors: PinnedColors = new Map();
	/** Set of group full keys that are currently collapsed. */
	private collapsedGroups = new Set<string>();
	/** The open select editor, if any (also drives outside-click detection). */
	private selectEditor: SelectEditor | null = null;
	/**
	 * Detached leaves backing each visible card's embedded editor. A full
	 * rebuild (every `onDataUpdated`) tears all of these down before
	 * recreating them — without that, each rebuild would leak one.
	 */
	private openLeaves: WorkspaceLeaf[] = [];

	constructor(controller: QueryController, parentEl: HTMLElement) {
		super(controller);
		this.queryCtrl = controller;
		this.rootEl = parentEl.createDiv({ cls: 'ntn-root ntn-feed-view' });
		this.register(() => this.closeSelectMenu());
		this.register(() => this.detachAllLeaves());
		// rootEl.doc resolves to the view's own document, so this also works
		// when the view lives in a popout window (plain `document` would not).
		this.registerDomEvent(this.rootEl.doc, 'pointerdown', (evt) => {
			if (!this.selectEditor) return;
			const target = evt.target as Node;
			if (this.selectEditor.contains(target)) return;
			if (this.selectEditor.anchorEl.contains(target)) return;
			this.closeSelectMenu();
		}, { capture: true });
		this.patchToolbarNew();
	}

	onDataUpdated(): void {
		// The toolbar may not have existed at construction time; retry until
		// the patch lands (no-op once it has).
		this.patchToolbarNew();
		// Every embedded editor below is about to be torn down and rebuilt —
		// detach their leaves first so none of them leak.
		this.detachAllLeaves();

		const root = this.rootEl;
		root.empty();

		const props = this.config.getOrder();
		this.pills = computePillProps(props, this.data.data, this.config, this.app);
		this.pinnedColors = parsePinnedColors(this.config.get('pinnedColors'));

		const feedContainer = root.createDiv({ cls: 'ntn-feed-container' });

		let renderedCount = 0;
		let limitRaw = this.config.get('rowCount');
		if (limitRaw === undefined) limitRaw = '5';
		const limitStr = String(limitRaw).trim();
		const limit = (limitStr === 'all' || limitStr === '0') ? 'all' : parseInt(limitStr, 10) || 5;

		const folderGrouped = isGroupedByFolder(this.app, this.data.groupedData);
		const roots = folderGrouped
			? hideSoleTopLevelFolder(buildFolderGroups(this.data.groupedData))
			: buildGroupTree(this.data.groupedData);

		const renderNode = (node: GroupNode, depth: number) => {
			if (limit !== 'all' && renderedCount >= limit) return;

			let isCollapsed = false;
			if (node.key) {
				isCollapsed = this.collapsedGroups.has(node.fullKey);

				const gRow = feedContainer.createDiv({ cls: 'ntn-group-row' });
				const headerIndent = folderGrouped ? (depth > 0 ? 32 : 12) : (depth * 20) + 12;
				gRow.setCssStyles({ paddingLeft: `${headerIndent}px` });

				const toggleIcon = gRow.createSpan({ cls: 'ntn-group-toggle' });
				toggleIcon.setText(isCollapsed ? '▶' : '▼');
				toggleIcon.addEventListener('click', () => {
					if (isCollapsed) {
						this.collapsedGroups.delete(node.fullKey);
					} else {
						this.collapsedGroups.add(node.fullKey);
					}
					this.onDataUpdated();
				});

				if (folderGrouped) {
					gRow.createSpan({ cls: 'ntn-group-folder-label', text: node.key });
				} else {
					const pill = gRow.createSpan({ cls: 'ntn-pill' });
					this.applyPillColor(pill, node.fullKey);
					pill.setText(node.key);
				}

				gRow.createSpan({ cls: 'ntn-group-count', text: String(countEntries(node)) });
			}

			if (isCollapsed) return;

			for (const entry of node.entries) {
				if (limit !== 'all' && renderedCount >= limit) break;
				this.renderCard(feedContainer, entry, props);
				renderedCount++;
			}

			for (const child of node.children.values()) {
				renderNode(child, node.key ? depth + 1 : depth);
			}
		};

		for (const rootNode of roots.values()) {
			renderNode(rootNode, 0);
		}

		// ---- "+ New" footer ----
		const footerWrap = root.createDiv({ cls: 'ntn-footer-wrap' });

		const newRow = footerWrap.createDiv({ cls: 'ntn-new-row' });
		newRow.createSpan({ cls: 'ntn-new-plus', text: '+' });
		newRow.createSpan({ text: 'New' });
		newRow.addEventListener('click', () => void this.createAndOpenPage());
	}

	/** One feed card: title + pill properties header, then the note's live editor. */
	private renderCard(container: HTMLElement, entry: BasesEntry, props: BasesPropertyId[]): void {
		const card = container.createDiv({ cls: 'ntn-feed-entry' });

		const header = card.createDiv({ cls: 'ntn-feed-header' });
		const title = header.createEl('a', {
			cls: 'ntn-feed-title',
			text: entry.file.basename,
			attr: { href: '#' },
		});
		title.addEventListener('click', (evt) => {
			evt.preventDefault();
			// Ctrl/Cmd always means "new tab", whatever `openMode` says.
			const modified = evt.ctrlKey || evt.metaKey;
			if (!modified && this.config.get('openMode') === 'panel') {
				this.openPagePanel(entry.file);
				return;
			}
			void this.app.workspace.openLinkText(entry.file.path, '', modified);
		});

		const pillProps = props.filter((p) => p !== 'file.name' && this.pills.pillProps.has(p));
		if (pillProps.length) {
			const metaRow = header.createDiv({ cls: 'ntn-feed-meta' });
			for (const prop of pillProps) {
				this.renderMetaPill(metaRow, entry, prop);
			}
		}

		const body = card.createDiv({ cls: 'ntn-feed-body' });
		void this.mountInlineEditor(body, entry.file);
	}

	/** One pill-property cell in a card's header meta row — click opens the shared select editor. */
	private renderMetaPill(wrap: HTMLElement, entry: BasesEntry, prop: BasesPropertyId): void {
		const disableColorColumns = this.config.get('disableColorColumns') as string[] || [];
		const useDefaultColor = !disableColorColumns.includes(prop);
		const propName = prop.split('.').slice(1).join('.');
		const editable = prop.startsWith('note.');

		const cell = wrap.createDiv({ cls: 'ntn-pills ntn-feed-meta-cell' });
		const items = valueToStrings(entry.getValue(prop));
		for (const item of items) {
			const pill = cell.createSpan({ cls: 'ntn-pill' });
			this.applyPillColor(pill, item, useDefaultColor);
			pill.setText(item.replace(/^#/, '').split('/').pop() || '');
		}
		if (editable) {
			cell.addClass('ntn-editable');
			cell.addEventListener('click', () =>
				this.openSelectEditor(cell, entry, prop, propName, useDefaultColor),
			);
			this.selectEditor?.reanchorIfMatches(cell, entry.file.path, prop);
		}
	}

	/**
	 * Embed the note's own live editor in the card body — the same
	 * `MarkdownView` Obsidian uses for a normal tab, just reparented into the
	 * card and never attached to the workspace layout, so it never shows up
	 * as a tab of its own. If the leaf gets detached (by a rebuild, or view
	 * unload) before `openFile` resolves, or anything here throws, the card
	 * falls back to a plain "open to edit" link instead of staying blank.
	 */
	private async mountInlineEditor(container: HTMLElement, file: TFile): Promise<void> {
		let leaf: WorkspaceLeaf;
		try {
			leaf = new (WorkspaceLeaf as unknown as LeafCtor)(this.app);
		} catch (e) {
			console.error(`${LOG_PREFIX} couldn't create an embedded editor leaf`, e);
			this.renderFallbackBody(container, file);
			return;
		}
		this.openLeaves.push(leaf);
		try {
			await leaf.openFile(file, { state: { mode: 'source', source: false } });
		} catch (e) {
			console.error(`${LOG_PREFIX} couldn't open note in embedded editor`, e);
		}
		// Torn down (rebuild, or view unload) while the open above was in flight.
		if (!this.openLeaves.includes(leaf)) return;
		if (!(leaf.view instanceof MarkdownView)) {
			this.renderFallbackBody(container, file);
			return;
		}
		container.empty();
		container.appendChild(leaf.view.containerEl);
	}

	private renderFallbackBody(container: HTMLElement, file: TFile): void {
		container.empty();
		container.addClass('ntn-feed-body-fallback');
		const link = container.createSpan({ text: 'Open to edit', cls: 'ntn-feed-fallback-link' });
		link.addEventListener('click', () => void this.app.workspace.openLinkText(file.path, '', false));
	}

	/** Detach every leaf backing a currently mounted card editor. Idempotent. */
	private detachAllLeaves(): void {
		for (const leaf of this.openLeaves) {
			try {
				leaf.detach();
			} catch (e) {
				console.error(`${LOG_PREFIX} couldn't detach an embedded editor leaf`, e);
			}
		}
		this.openLeaves = [];
	}

	/** Color a pill element using this view's pinned-color overrides. */
	private applyPillColor(pill: HTMLElement, text: string, useDefaultColor = true): void {
		applyPillColor(pill, text, this.pinnedColors, useDefaultColor);
	}

	/** Open the Notion-style select editor for a pill meta cell. */
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
	 * Open the select editor anchored anywhere — a meta pill cell or a
	 * property row of the page panel. Known values always come from the
	 * live query result; lifetime stays with the view (outside-click / Esc
	 * / unload).
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
	 * option so it survives reloads and is editable from the view settings too.
	 * Keeps whatever opacity the value already had pinned.
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
	 * Rename a value everywhere it's used: rewrites every note's frontmatter
	 * that holds it, and carries over any pinned color/opacity to the new
	 * key so the rename doesn't silently lose it.
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
		if (Platform.isPhone || this.newButtonPatched) {
			await this.createFileForView();
			return;
		}
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
}
