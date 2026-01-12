// src/inline/StopWordsManager.ts

import { Logger } from "src/utils/Logger";

export class StopWordsManager {
    private stopWordsSet: Set<string> = new Set();

    constructor(
        private settings: any,
        private saveSettings: () => Promise<void>,
        private plugin: any
    ) { }

    /**
     * Initialize: load ONLY from separate file
     */
    async initialize(): Promise<void> {
        if (!this.settings.useStopWords) {
            Logger.debug('[StopWords] Disabled, skipping');
            return;
        }

        // Try to load from file
        if (await this.loadFromFile()) {
            Logger.info(`[StopWords] Loaded ${this.stopWordsSet.size} words from file`);
        } else {
            // File doesn't exist, download fresh
            Logger.info('[StopWords] No cache file found, downloading...');
            await this.downloadVocabulary();
        }

        // Add custom words
        this.loadCustomWords();
    }

    // StopWordsManager.ts - saveToFile()

    private async saveToFile(): Promise<boolean> {
        if (!this.plugin) return false;

        try {
            // ✅ CORRETTO: Salva nella cartella del plugin
            const pluginFolder = this.plugin.manifest.dir;
            const fileName = `${pluginFolder}/stopwords.json`;

            const data = {
                words: Array.from(this.stopWordsSet),
                lastUpdated: Date.now(),
                source: 'Link Grabber Plugin'
            };

            await this.plugin.app.vault.adapter.write(fileName, JSON.stringify(data, null, 2));

            Logger.debug(`[StopWords] Saved ${data.words.length} words to plugin folder`);
            return true;

        } catch (err) {
            Logger.error('[StopWords] Error saving to file:', err);
            return false;
        }
    }

    private async loadFromFile(): Promise<boolean> {
        if (!this.plugin) return false;

        try {

            const pluginFolder = this.plugin.manifest.dir;
            const fileName = `${pluginFolder}/stopwords.json`;

            const exists = await this.plugin.app.vault.adapter.exists(fileName);
            if (!exists) return false;

            const content = await this.plugin.app.vault.adapter.read(fileName);
            const data = JSON.parse(content);

            if (data.words && Array.isArray(data.words)) {
                this.stopWordsSet = new Set(data.words);
                return true;
            }
        } catch (err) {
            Logger.error('[StopWords] Error loading from file:', err);
        }

        return false;
    }

    /**
     * Download vocabulary from URLs
     */
    async downloadVocabulary(): Promise<boolean> {
        if (!this.settings.stopWordsURLs) {
            Logger.warn('[StopWords] No URLs configured');
            return false;
        }

        const urls = this.settings.stopWordsURLs
            .split('\n')
            .map((u: string) => u.trim())
            .filter((u: string) => u.length > 0);

        if (urls.length === 0) {
            Logger.warn('[StopWords] No valid URLs found');
            return false;
        }

        Logger.info(`[StopWords] Downloading from ${urls.length} sources...`);

        const allWords: string[] = [];
        let successCount = 0;

        for (const url of urls) {
            try {
                Logger.debug(`[StopWords] Fetching: ${url}`);
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const text = await response.text();
                const words = this.parseVocabulary(text);
                allWords.push(...words);
                successCount++;

                Logger.info(`[StopWords] ✅ ${url} - ${words.length} words`);

            } catch (err) {
                Logger.error(`[StopWords] ❌ Failed: ${url}`, err);
            }
        }

        if (allWords.length === 0) {
            return false;
        }

        // Deduplicate
        const uniqueWords = [...new Set(allWords)];

        // Update memory cache
        this.stopWordsSet = new Set(uniqueWords);

        // Save to file
        const saved = await this.saveToFile();

        if (saved) {
            Logger.info(`[StopWords] ${uniqueWords.length} words from ${successCount}/${urls.length} sources saved to file`);
        }

        return saved;
    }

    /**
     * Load custom words from settings
     */
    private loadCustomWords(): void {
        if (!this.settings.customStopWords) return;

        const customWords = this.settings.customStopWords
            .split(',')
            .map((w: string) => w.toLowerCase().trim())
            .filter((w: string) => w.length > 0);

        customWords.forEach((word: string) => this.stopWordsSet.add(word));
        Logger.debug(`[StopWords] Added ${customWords.length} custom words`);
    }

    /**
     * Check if a word is a stop word
     */
    isStopWord(word: string): boolean {
        if (!this.settings.useStopWords) return false;
        return this.stopWordsSet.has(word.toLowerCase());
    }

    /**
     * Get all stop words
     */
    getStopWords(): string[] {
        return Array.from(this.stopWordsSet);
    }

    /**
     * Refresh: re-download vocabulary
     */
    async refresh(): Promise<boolean> {
        this.stopWordsSet.clear();

        // Delete old file if exists
        if (this.plugin) {
            try {
                const fileName = 'stopwords.json';
                await this.plugin.app.vault.adapter.remove(fileName);
            } catch (err) {
                // File may not exist, ignore
            }
        }

        return await this.downloadVocabulary();
    }

    /**
     * Clear cache
     */
    async clearCache(): Promise<void> {
        this.stopWordsSet.clear();

        // Delete file
        if (this.plugin) {
            try {
                const fileName = 'stopwords.json';
                await this.plugin.app.vault.adapter.remove(fileName);
            } catch (err) {
                // Ignore
            }
        }

        Logger.info('[StopWords] Cache cleared');
    }

    /**
     * Get statistics
     */
    getStats() {
        const customStr = this.settings.customStopWords || '';
        const custom = customStr.split(',').filter((w: string) => w.trim()).length;
        const total = this.stopWordsSet.size;

        return { custom, total };
    }

    /**
     * Parse vocabulary text
     */
    private parseVocabulary(text: string): string[] {
        text = text.trim();

        // Try JSON first
        if (text.startsWith('{') || text.startsWith('[')) {
            try {
                const json = JSON.parse(text);
                if (Array.isArray(json)) {
                    return json.map(w => w.toLowerCase().trim()).filter(Boolean);
                }
                if (json.words && Array.isArray(json.words)) {
                    return json.words.map((w: string) => w.toLowerCase().trim()).filter(Boolean);
                }
            } catch (e) {
                Logger.debug('[StopWords] Not valid JSON, trying plain text');
            }
        }

        // Plain text: one word per line
        return text.split(/[\n\r]+/)
            .map(line => line.toLowerCase().trim())
            .filter(word => word.length > 0);
    }



}