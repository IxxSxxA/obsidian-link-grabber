// src/core/SearchEngine.ts

import { App, TFile, prepareSimpleSearch } from 'obsidian';
import { SearchResultItem } from '../settings/types/PluginSettings';
import { Logger } from '../utils/Logger';
import { InlineIndexManager, SearchableItem } from './IndexManager';
import { StopWordsManager } from './StopWordsManager';

export class SearchEngine {
    private stopWordsManager: StopWordsManager;
    private indexManager: InlineIndexManager;

    constructor(
        private app: App,
        private settings: any,
        private saveSettings: () => Promise<void>,
        private plugin: any
    ) {
        this.stopWordsManager = new StopWordsManager(settings, saveSettings, plugin);
        this.indexManager = new InlineIndexManager(app, settings);
    }

    async initialize(): Promise<void> {
        await this.stopWordsManager.initialize();
        await this.indexManager.initialize();

        Logger.info('[SearchEngine] Initialized with index manager');
    }

    /**
     * Get enabled search types based on settings
     */
    private getEnabledTypes(): Set<string> {
        const enabled = new Set<string>();

        if (this.settings.searchInTitles) {
            enabled.add('title');
        }

        if (this.settings.searchInHeadings) {
            enabled.add('heading');
        }

        // Note: searchInMetadata controls both tags and frontmatter
        if (this.settings.searchInMetadata) {
            enabled.add('tag');
            enabled.add('frontmatter');
        }

        return enabled;
    }

    /**
     * Convert SearchableItem to SearchResultItem
     */
    private itemToResult(item: SearchableItem, query: string): SearchResultItem {
        const file = this.app.vault.getAbstractFileByPath(item.filePath);

        if (!(file instanceof TFile)) {
            throw new Error(`File not found: ${item.filePath}`);
        }

        // Create match data for highlighting
        const searchFn = prepareSimpleSearch(query.toLowerCase());
        const match = searchFn(item.text);

        return {
            file,
            score: item.priority * (match?.score || 0.5),
            matches: match?.matches || [],
            matchType: item.type as any,
            matchedText: item.text
        };
    }

    async searchFiles(
        query: string,
        settings: any,
        currentFile: TFile | null
    ): Promise<SearchResultItem[]> {
        // Check stop words
        if (this.stopWordsManager.isStopWord(query)) {
            Logger.debug(`[Search] "${query}" is stop word, ignoring`);
            return [];
        }

        Logger.searchStart(query);

        // Get enabled search types
        const enabledTypes = this.getEnabledTypes();
        if (enabledTypes.size === 0) {
            Logger.warn('[Search] No search types enabled');
            return [];
        }

        // Search through index
        const items = this.indexManager.search(query, enabledTypes);

        // Convert to SearchResultItem and filter current file
        const results: SearchResultItem[] = [];

        for (const item of items) {
            const file = this.app.vault.getAbstractFileByPath(item.filePath);

            if (!(file instanceof TFile)) continue;

            // Skip current file if configured
            if (settings.excludeCurrentNote && currentFile && file.path === currentFile.path) {
                continue;
            }

            const result = this.itemToResult(item, query);
            results.push(result);

            // Limit results early for performance
            if (results.length >= (settings.maxSuggestions * 3)) {
                break;
            }
        }

        // Sort and limit
        const sortedResults = results.sort((a, b) => b.score - a.score);
        const finalResults = sortedResults.slice(0, settings.maxSuggestions || 5);

        this.logSearchResults(query, finalResults);
        return finalResults;
    }

    /**
     * Get index statistics
     */
    getIndexStats(): { files: number; items: number; types: Record<string, number> } {
        return this.indexManager.getStats();
    }

    /**
     * Rebuild the index
     */
    async rebuildIndex(): Promise<void> {
        Logger.info('[SearchEngine] Rebuilding index...');
        await this.indexManager.rebuild();
    }

    private logSearchResults(
        query: string,
        results: SearchResultItem[]
    ): void {
        Logger.searchSummary(query, this.indexManager.getStats().files, results.length, 'indexed');

        if (results.length > 0) {
            results.forEach((r, i) => {
                Logger.searchResult(i + 1, r.file.basename, r.matchType, r.score);
            });
        } else {
            Logger.searchNoResults(query);
        }
    }
}