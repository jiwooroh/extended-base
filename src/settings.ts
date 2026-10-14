/** Extended Base's plugin-wide settings — entered via Obsidian's own Settings pane, not a per-Base view option. */
export interface ExtendedBaseSettings {
	/** Which palette (see `COLOR_SCHEMES` in `lib/colors.ts`) pill colors are drawn from. */
	colorScheme: string;
}

export const DEFAULT_SETTINGS: ExtendedBaseSettings = {
	colorScheme: 'notion',
};
