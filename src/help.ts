// src/settings/RoadmapHelper.ts

import { App, Modal } from 'obsidian';

export class RoadmapRenderer {
    static renderRoadmap(containerEl: HTMLElement): void {
        // HEADER
        containerEl.createEl('h1', { text: '📘 Link Grabber - User Guide' });

        containerEl.createEl('p', {
            text: 'Link Grabber is a powerful Obsidian plugin that helps you find and insert links while you write. It offers two main modes: Instant inline search and AI-powered semantic suggestions.'
        });

        // OVERVIEW SECTION
        containerEl.createEl('h2', { text: '🌟 Overview' });
        containerEl.createEl('p', {
            text: 'Link Grabber enhances your writing workflow by automatically suggesting relevant links from your vault as you type, either through simple text matching or advanced AI understanding.'
        });

        // SECTION 1: INLINE SEARCH
        containerEl.createEl('h2', { text: '🔍 1. Inline Search (Typing Mode)' });
        containerEl.createEl('p', {
            text: 'The core functionality that works instantly as you type in your notes. This mode provides real-time text-based suggestions.'
        });

        containerEl.createEl('h3', { text: 'How It Works' });
        containerEl.createEl('ul', {}, (ul: HTMLElement) => {
            ul.createEl('li', { text: 'Start typing anywhere in your note' });
            ul.createEl('li', { text: 'A popup appears showing matching notes from your vault' });
            ul.createEl('li', { text: 'Use arrow keys or mouse to select a suggestion' });
            ul.createEl('li', { text: 'Press Tab or click to insert the link' });
        });

        containerEl.createEl('h3', { text: 'Configuration Options' });
        containerEl.createEl('ul', {}, (ul: HTMLElement) => {
            ul.createEl('li', { text: '🔤 Search in Titles: Fastest option, searches note titles only' });
            ul.createEl('li', { text: '📑 Search in Headings: Searches H1, H2, H3 headings within notes' });
            ul.createEl('li', { text: '🏷️ Search in Tags & Frontmatter: Includes metadata in searches' });
            ul.createEl('li', { text: '🚫 Stop Words: Ignore common words for better results' });
            ul.createEl('li', { text: 'Minimum Text Length: Set how many characters trigger the search (default: 3)' });
            ul.createEl('li', { text: 'Maximum Suggestions: Control how many results appear in popup' });
            ul.createEl('li', { text: 'Exclude Current Note: Prevent suggesting links to the note you\'re editing' });
        });

        // SECTION 2: AI SEMANTIC SEARCH
        containerEl.createEl('h2', { text: '🧠 2. AI Semantic Search' });
        containerEl.createEl('p', {
            text: 'Advanced AI-powered suggestions that understand the meaning and context of what you\'re writing, not just text matching.'
        });

        containerEl.createEl('h3', { text: 'Setup & Requirements' });
        containerEl.createEl('ul', {}, (ul: HTMLElement) => {
            ul.createEl('li', { text: 'One-time download of AI model (~118MB)' });
            ul.createEl('li', { text: 'Models are stored locally in your plugin folder' });
            ul.createEl('li', { text: 'No data is sent to external servers - 100% private' });
            ul.createEl('li', { text: 'Automatic background indexing after setup' });
        });

        containerEl.createEl('h3', { text: 'Features' });
        containerEl.createEl('ul', {}, (ul: HTMLElement) => {
            ul.createEl('li', { text: '📊 Three indexing levels: Titles, Headings, and Full Content' });
            ul.createEl('li', { text: '🔄 Real-time indexing progress tracking' });
            ul.createEl('li', { text: '⚡ Sidebar view for AI suggestions (Ctrl+P → "Link Grabber Open AI Semantic Suggestions")' });
            ul.createEl('li', { text: '🔧 Configurable suggestion parameters' });
            ul.createEl('li', { text: '💾 Automatic index updates on note changes' });
        });

        containerEl.createEl('h3', { text: 'Indexing Options' });
        const aiIndexingTable = containerEl.createEl('table', { cls: 'ai-indexing-table' });
        const headerRow = aiIndexingTable.createEl('tr');
        headerRow.createEl('th', { text: 'Type' });
        headerRow.createEl('th', { text: 'Icon' });
        headerRow.createEl('th', { text: 'Speed' });
        headerRow.createEl('th', { text: 'Description' });
        headerRow.createEl('th', { text: 'Best For' });

        const rows = [
            ['Titles', '🔹', '⚡ Fast', 'Indexes note titles only', 'Quick searches, large vaults'],
            ['Headings', '🔖', '⏱️ Medium', 'Indexes all headings (H1, H2, etc.)', 'Structured documents'],
            ['Content', '📄', '⚠️ Slow', 'Indexes full note content', 'Deep semantic analysis']
        ];

        rows.forEach(row => {
            const tr = aiIndexingTable.createEl('tr');
            row.forEach(cell => {
                tr.createEl('td', { text: cell });
            });
        });

        // SECTION 3: SETTINGS REFERENCE
        containerEl.createEl('h2', { text: '⚙️ Settings Reference' });

        containerEl.createEl('h3', { text: 'Inline Search Settings' });
        containerEl.createEl('ul', {}, (ul: HTMLElement) => {
            ul.createEl('li', { text: 'Minimum text length: 3-50 characters (default: 3)' });
            ul.createEl('li', { text: 'Maximum suggestions: 1-20 results (default: 5)' });
            ul.createEl('li', { text: 'Search scopes: Mix and match titles, headings, and metadata' });
            ul.createEl('li', { text: 'Stop words: Filter common words using TXT files from URLs' });
        });

        containerEl.createEl('h3', { text: 'AI Settings' });
        containerEl.createEl('ul', {}, (ul: HTMLElement) => {
            ul.createEl('li', { text: 'Minimum text length: 50+ characters recommended for AI' });
            ul.createEl('li', { text: 'Maximum suggestions: 1-20 AI results (default: 7)' });
            ul.createEl('li', { text: 'Auto-update index: Keep database current when notes change' });
            ul.createEl('li', { text: 'Reset options: Clear databases or full AI reset' });
        });

        // SECTION 4: KEYBOARD SHORTCUTS & TIPS
        containerEl.createEl('h2', { text: '💡 Tips & Shortcuts' });

        containerEl.createEl('h3', { text: 'Performance Tips' });
        containerEl.createEl('ul', {}, (ul: HTMLElement) => {
            ul.createEl('li', { text: 'For large vaults: Start with Titles-only indexing' });
            ul.createEl('li', { text: 'Use headings indexing for structured documents' });
            ul.createEl('li', { text: 'Full content indexing is best for deep research projects' });
            ul.createEl('li', { text: 'Enable stop words to reduce noise in suggestions' });
        });

        containerEl.createEl('h3', { text: 'Workflow Tips' });
        containerEl.createEl('ul', {}, (ul: HTMLElement) => {
            ul.createEl('li', { text: 'Let AI indexing run in background - it won\'t block your work' });
            ul.createEl('li', { text: 'Combine inline and AI search for best results' });
            ul.createEl('li', { text: 'Use the sidebar for AI suggestions during focused writing sessions' });
            ul.createEl('li', { text: 'Reset databases if suggestions seem outdated' });
        });

        // SECTION 5: TROUBLESHOOTING
        containerEl.createEl('h2', { text: '🔧 Troubleshooting' });

        containerEl.createEl('h3', { text: 'Common Issues' });
        containerEl.createEl('ul', {}, (ul: HTMLElement) => {
            ul.createEl('li', { text: 'AI not working? Click "Enable AI" in settings to download models' });
            ul.createEl('li', { text: 'Slow performance? Disable content indexing or reduce suggestion count' });
            ul.createEl('li', { text: 'No suggestions appearing? Check minimum text length settings' });
            ul.createEl('li', { text: 'Reset options available if databases become corrupted' });
        });

        containerEl.createEl('h3', { text: 'Reset Options' });
        containerEl.createEl('ul', {}, (ul: HTMLElement) => {
            ul.createEl('li', { text: '🔄 Reset Databases: Clear all indexed data but keep AI model' });
            ul.createEl('li', { text: '🗑️ Reset All: Complete cleanup including downloaded AI model' });
        });

        // SECTION 6: PRIVACY & SECURITY
        containerEl.createEl('h2', { text: '🔒 Privacy & Security' });
        containerEl.createEl('p', {
            text: 'Link Grabber operates entirely on your local machine:'
        });
        containerEl.createEl('ul', {}, (ul: HTMLElement) => {
            ul.createEl('li', { text: '✅ All AI models are stored locally in your vault' });
            ul.createEl('li', { text: '✅ No data is sent to external servers' });
            ul.createEl('li', { text: '✅ Semantic analysis happens 100% offline' });
            ul.createEl('li', { text: '✅ Your notes remain completely private' });
        });

        // FOOTER
        const footer = containerEl.createDiv({ cls: 'guide-footer' });
        footer.createEl('p', {
            text: 'For additional help or to report issues, please check the plugin repository or community forums.'
        });
    }
}

// Modal to show the guide
export class RoadmapModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        RoadmapRenderer.renderRoadmap(contentEl);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
