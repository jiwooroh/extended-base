/**
 * The Notion-palette color + opacity picker flyout — shared by the pill
 * select editor's per-value color button and the board's column-header
 * "Set color" menu, so both get the identical picker instead of two
 * near-duplicate implementations.
 */
import { NOTION_COLORS, NotionColor, applyColorVars } from '../lib/colors';

export interface ColorMenuOptions {
	/** The view's own document (popout-safe). */
	doc: Document;
	/** The view's own window (popout-safe), used to clamp on screen. */
	win: Window;
	/** Element the menu anchors beneath. */
	anchorEl: HTMLElement;
	/** Current opacity (0-100) to preset the slider to. */
	currentOpacity: number;
	/** Called when a palette color (or "default") is clicked. */
	onPick: (colorName: string) => void;
	/** Called once the opacity slider is released on a new value. */
	onOpacityChange: (opacity: number) => void;
}

/** Build, position, and return the flyout element; the caller owns its lifetime (append tracking, outside-click close). */
export function buildColorMenu(opts: ColorMenuOptions): HTMLElement {
	const menu = opts.doc.body.createDiv({ cls: 'ntn-root ntn-color-menu' });

	const options: { name: string }[] = [{ name: 'default' }, ...NOTION_COLORS];
	for (const c of options) {
		const item = menu.createDiv({ cls: 'ntn-color-option' });
		const swatch = item.createSpan({ cls: 'ntn-color-swatch' });
		if (c.name !== 'default') {
			applyColorVars(swatch, c as NotionColor);
		}
		item.createSpan({ cls: 'ntn-color-name', text: c.name.charAt(0).toUpperCase() + c.name.slice(1) });
		item.addEventListener('click', (evt) => {
			evt.stopPropagation();
			opts.onPick(c.name);
		});
	}

	// Live-updates its own label while dragging; only commits (and
	// triggers the caller's re-render) once the user releases the slider,
	// so dragging doesn't fire a render per tick.
	const opacityRow = menu.createDiv({ cls: 'ntn-color-opacity-row' });
	opacityRow.createSpan({ cls: 'ntn-color-opacity-label', text: 'Opacity' });
	const slider = opacityRow.createEl('input', { type: 'range', cls: 'ntn-color-opacity-slider' });
	slider.min = '10';
	slider.max = '100';
	slider.step = '5';
	slider.value = String(opts.currentOpacity);
	const valueLabel = opacityRow.createSpan({ cls: 'ntn-color-opacity-value', text: `${opts.currentOpacity}%` });
	slider.addEventListener('click', (evt) => evt.stopPropagation());
	slider.addEventListener('input', () => {
		valueLabel.setText(`${slider.value}%`);
	});
	slider.addEventListener('change', () => {
		opts.onOpacityChange(Number(slider.value));
	});

	// Anchor below the triggering element, then nudge back on screen.
	const anchorRect = opts.anchorEl.getBoundingClientRect();
	menu.setCssStyles({ left: `${anchorRect.left}px`, top: `${anchorRect.bottom + 4}px` });
	const menuRect = menu.getBoundingClientRect();
	if (menuRect.bottom > opts.win.innerHeight - 8) {
		menu.setCssStyles({ top: `${Math.max(8, anchorRect.top - menuRect.height - 4)}px` });
	}
	if (menuRect.right > opts.win.innerWidth - 8) {
		menu.setCssStyles({ left: `${Math.max(8, opts.win.innerWidth - menuRect.width - 8)}px` });
	}

	return menu;
}
