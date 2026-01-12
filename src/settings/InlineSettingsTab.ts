// src/settings/InlineSettingsTab.ts

import { App, Setting } from 'obsidian';
import { Logger } from '../utils/Logger';

export class InlineSettingsTab {
    constructor(
        private app: App,
        private pluginCore: any,
        private settings: any,
        private saveSettings: () => Promise<void>
    ) { }

    render(containerEl: HTMLElement): void {
        this.renderInlineSearchSettings(containerEl);
        this.renderStopWordsSection(containerEl);
        this.renderIndexStats(containerEl);
    }

    private renderInlineSearchSettings(containerEl: HTMLElement): void {

        // Minimum text length
        new Setting(containerEl)
            .setName('Minimum text length')
            .setDesc('Minimum number of characters to activate search')
            .addText(text => text
                .setPlaceholder('3')
                .setValue(this.settings.minTextLength.toString())
                .onChange(async (value) => {
                    this.settings.minTextLength = parseInt(value) || 3;
                    await this.saveSettings();
                }));

        // Maximum suggestions
        new Setting(containerEl)
            .setName('Maximum suggestions')
            .setDesc('How many results to show in the popup')
            .addText(text => text
                .setPlaceholder('5')
                .setValue(this.settings.maxSuggestions.toString())
                .onChange(async (value) => {
                    this.settings.maxSuggestions = parseInt(value) || 5;
                    await this.saveSettings();
                }));

        // Exclude current note
        new Setting(containerEl)
            .setName('Exclude current note')
            .setDesc('Prevent suggesting links to the currently open note')
            .addToggle(toggle => toggle
                .setValue(this.settings.excludeCurrentNote)
                .onChange(async (value) => {
                    this.settings.excludeCurrentNote = value;
                    await this.saveSettings();
                }));

        // Tips
        const desc = containerEl.createDiv({ cls: 'setting-item-description' });
        //desc.style.marginBottom = '16px';
        desc.innerHTML = `
            <p><strong>Performance tip:</strong> Titles (fastest) → Headings → Tags & Frontmatter</p>
        `;

        // Search scopes - Titles
        new Setting(containerEl)
            .setName('🔤 Search in note titles')
            .setDesc('Find matches in note titles (always recommended)')
            .addToggle(toggle => toggle
                .setValue(this.settings.searchInTitles)
                .onChange(async (value) => {
                    this.settings.searchInTitles = value;
                    await this.saveSettings();
                }));

        // Search scopes - Headings
        new Setting(containerEl)
            .setName('📑 Search in headings')
            .setDesc('Find matches in headings (H1, H2, H3, etc.)')
            .addToggle(toggle => toggle
                .setValue(this.settings.searchInHeadings)
                .onChange(async (value) => {
                    this.settings.searchInHeadings = value;
                    await this.saveSettings();
                }));

        // Search scopes - Tags & Frontmatter
        new Setting(containerEl)
            .setName('🏷️ Search in tags & frontmatter')
            .setDesc('Find matches in tags (#tag) and frontmatter metadata')
            .addToggle(toggle => toggle
                .setValue(this.settings.searchInMetadata)
                .onChange(async (value) => {
                    this.settings.searchInMetadata = value;
                    await this.saveSettings();
                }));
    }

    private renderStopWordsSection(containerEl: HTMLElement): void {
        // Header
        containerEl.createEl('h4', {
            text: '🚫 Use stop words for in line suggestions',
            cls: 'link-grabber-section-sub'
        });

        // Instructions
        const instructionsDiv = containerEl.createDiv({ cls: 'setting-item-description' });
        instructionsDiv.style.marginBottom = '16px';
        instructionsDiv.style.padding = '12px';
        instructionsDiv.style.background = 'var(--background-secondary)';
        instructionsDiv.style.borderRadius = '6px';

        instructionsDiv.createEl('p', {
            text: 'Stop words are common words (like "the", "and", "is") that will be ignored during search.'
        });

        instructionsDiv.createEl('p', {
            text: 'How to download and manage vocabularies:'
        });

        const howToList = instructionsDiv.createEl('ul');
        howToList.createEl('li', {
            text: 'Use .TXT files with one word per line (GitHub, Pastebin, etc.)'
        });
        howToList.createEl('li', {
            text: 'For GitHub: use RAW file URLs (click "Raw" button on GitHub)'
        });
        howToList.createEl('li', {
            text: 'Valid URL example: https://raw.githubusercontent.com/stopwords-iso/stopwords-en/master/stopwords-en.txt'
        });
        howToList.createEl('li', {
            text: 'DO NOT use regular GitHub page URLs (will cause CORS errors)'
        });
        howToList.createEl('li', {
            text: 'To delete a vocabulary just delete its URL from the textarea below and press Update Cache'
        });

        // Enable toggle
        new Setting(containerEl)
            .setName('Enable stop words filtering')
            .setDesc('Ignore common words when typing for better results')
            .addToggle(toggle => toggle
                .setValue(this.settings.useStopWords)
                .onChange(async (value) => {
                    this.settings.useStopWords = value;
                    await this.saveSettings();

                    if (value) {
                        await this.pluginCore.suggestionManager.searchEngine.stopWordsManager.initialize();
                    }
                }));

        // URLs textarea
        new Setting(containerEl)
            .setName('Vocabulary URLs')
            .setDesc('Multiple URLs supported (one URL per line).')
            .addTextArea(text => {
                text.setPlaceholder(
                    'https://raw.githubusercontent.com/stopwords-iso/stopwords-en/master/stopwords-en.txt\n' +
                    'https://raw.githubusercontent.com/stopwords-iso/stopwords-it/master/stopwords-it.txt'
                );
                text.setValue(this.settings.stopWordsURLs);
                text.onChange(async (value) => {
                    this.settings.stopWordsURLs = value;
                    await this.saveSettings();
                });

                (text.inputEl as HTMLTextAreaElement).rows = 4;
            });

        // Download button
        const downloadSetting = new Setting(containerEl)
            .setName('Download vocabularies')
            .setDesc(this.getStopWordsStatus())
            .addButton(button => button
                .setButtonText('🔄 Update Cache')
                .setTooltip('Download all vocabularies and merge with custom words')
                .onClick(async () => {
                    button.setDisabled(true);
                    await this.pluginCore.suggestionManager.searchEngine.stopWordsManager.refresh();
                    downloadSetting.setDesc(this.getStopWordsStatus());
                    button.setDisabled(false);
                }));

        // Custom stop words
        new Setting(containerEl)
            .setName('Custom stop words')
            .setDesc('Add your own words to ignore, separated by commas (example: meeting, todo, draft)')
            .addTextArea(text => {
                text.setPlaceholder('meeting, todo, draft, wip, test, notes');
                text.setValue(this.settings.customStopWords);
                text.onChange(async (value) => {
                    this.settings.customStopWords = value;
                    await this.saveSettings();

                    if (this.settings.useStopWords) {
                        await this.pluginCore.suggestionManager.searchEngine.stopWordsManager.initialize();
                    }
                });

                (text.inputEl as HTMLTextAreaElement).rows = 2;
            });
    }

    private renderIndexStats(containerEl: HTMLElement): void {
        if (!this.settings.debugMode) return;

        try {
            const engine = this.pluginCore.suggestionManager?.searchEngine;
            if (!engine) return;

            const stats = engine.getIndexStats();

            const statsDiv = containerEl.createDiv({ cls: 'link-grabber-stats' });
            statsDiv.style.marginTop = '20px';
            statsDiv.style.padding = '12px';
            statsDiv.style.background = 'var(--background-secondary)';
            statsDiv.style.borderRadius = '6px';
            statsDiv.style.fontSize = '0.9em';

            statsDiv.createEl('h5', { text: '📊 Index Statistics' });
            statsDiv.createEl('p', { text: `Files indexed: ${stats.files}` });
            statsDiv.createEl('p', { text: `Searchable items: ${stats.items}` });

            const typesList = statsDiv.createEl('ul');
            for (const [type, count] of Object.entries(stats.types) as [string, number][]) {
                if (count > 0) {
                    typesList.createEl('li', { text: `${type}: ${count}` });
                }
            }

        } catch (err) {
            Logger.debug('[InlineSettings] Could not load index stats:', err);
        }
    }

    private getStopWordsStatus(): string {
        const manager = this.pluginCore.suggestionManager?.searchEngine?.stopWordsManager;

        if (!manager) {
            return 'Status: ⏳ Initializing...';
        }

        try {
            const stats = manager.getStats();

            // How many URLs
            const urls = (this.settings.stopWordsURLs || '')
                .split('\n')
                .map((u: string) => u.trim())
                .filter((u: string) => u.length > 0);

            const sourceInfo = urls.length > 0
                ? `from ${urls.length} source${urls.length > 1 ? 's' : ''}`
                : 'no sources configured';

            return `Status: ${stats.total > 0 ? '✅' : '❌'} ${stats.total} words ${sourceInfo} (${stats.custom} custom)`;

        } catch (err) {
            Logger.error('[InlineSettings] Error getting stop words status:', err);
            return 'Status: ❌ Error';
        }
    }
}