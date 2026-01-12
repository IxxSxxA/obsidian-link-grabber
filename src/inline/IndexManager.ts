// src/core/InlineIndexManager.ts

import { App, CachedMetadata, TAbstractFile, TFile } from 'obsidian';
import { Logger } from '../utils/Logger';


export interface IndexedFile {
    file: TFile;
    title: string;
    headings: string[];
    tags: string[];
    frontmatter: string; // Stringified key:value pairs
    lastModified: number;
}

export interface SearchableItem {
    type: 'title' | 'heading' | 'tag' | 'frontmatter';
    text: string;
    priority: number; // Weight for scoring
    filePath: string;
}

export class InlineIndexManager {
    private index: Map<string, IndexedFile> = new Map();
    private searchableItems: SearchableItem[] = [];
    private isInitialized = false;

    constructor(
        private app: App,
        private settings: any
    ) { }

    /**
     * Initialize or rebuild the entire index
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            Logger.debug('[InlineIndex] Already initialized');
            return;
        }

        Logger.info('[InlineIndex] Building search index...');
        const startTime = Date.now();

        const files = this.app.vault.getMarkdownFiles();
        let indexedCount = 0;

        for (const file of files) {
            await this.indexFile(file);
            indexedCount++;
        }

        this.buildSearchableItems();

        const elapsed = Date.now() - startTime;
        Logger.info(`[InlineIndex] Index built: ${indexedCount} files, ${this.searchableItems.length} items (${elapsed}ms)`);

        this.isInitialized = true;
        this.setupEventListeners();
    }

    /**
     * Index a single file
     */
    private async indexFile(file: TFile): Promise<void> {
        const cache = this.app.metadataCache.getFileCache(file);
        const now = Date.now();

        const indexedFile: IndexedFile = {
            file,
            title: file.basename,
            headings: this.extractHeadings(cache),
            tags: this.extractTags(cache),
            frontmatter: this.extractFrontmatter(cache),
            lastModified: now
        };

        this.index.set(file.path, indexedFile);
    }

    /**
     * Extract headings from cache
     */
    private extractHeadings(cache: CachedMetadata | null): string[] {
        if (!cache || !cache.headings) return [];
        return cache.headings.map(h => h.heading.trim());
    }

    /**
     * Extract tags from cache (without #)
     */
    private extractTags(cache: CachedMetadata | null): string[] {
        if (!cache || !cache.tags) return [];
        return cache.tags.map(t => t.tag.substring(1).trim()); // Remove #
    }

    /**
     * Extract frontmatter as searchable string
     */
    private extractFrontmatter(cache: CachedMetadata | null): string {
        if (!cache || !cache.frontmatter) return '';

        const items: string[] = [];
        for (const [key, value] of Object.entries(cache.frontmatter)) {
            if (typeof value === 'string') {
                items.push(`${key}: ${value}`);
            } else if (Array.isArray(value)) {
                items.push(`${key}: ${value.join(', ')}`);
            } else {
                items.push(`${key}: ${JSON.stringify(value)}`);
            }
        }
        return items.join(' | ');
    }

    /**
     * Build flat array of searchable items for fast searching
     */
    private buildSearchableItems(): void {
        this.searchableItems = [];

        for (const [filePath, data] of this.index) {
            // Title (high priority)
            this.searchableItems.push({
                type: 'title',
                text: data.title,
                priority: 1.5,
                filePath
            });

            // Headings (medium priority)
            for (const heading of data.headings) {
                this.searchableItems.push({
                    type: 'heading',
                    text: heading,
                    priority: 1.2,
                    filePath
                });
            }

            // Tags (low priority)
            for (const tag of data.tags) {
                this.searchableItems.push({
                    type: 'tag',
                    text: tag,
                    priority: 1.0,
                    filePath
                });
            }

            // Frontmatter (low priority)
            if (data.frontmatter) {
                this.searchableItems.push({
                    type: 'frontmatter',
                    text: data.frontmatter,
                    priority: 0.8,
                    filePath
                });
            }
        }
    }

    /**
     * Search through the index
     */
    search(query: string, enabledTypes: Set<string>): SearchableItem[] {
        const queryLower = query.toLowerCase();
        const results: SearchableItem[] = [];

        for (const item of this.searchableItems) {
            if (!enabledTypes.has(item.type)) continue;

            // Split words and find if any word matches query from start
            const words = item.text.toLowerCase().split(/\s+/);
            const matchingWord = words.find(word => word.startsWith(queryLower));

            if (matchingWord) {
                // Score: query length vs word length matched
                const score = (queryLower.length / matchingWord.length) * item.priority;
                results.push({ ...item, priority: score });
            }
        }

        return results.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Get indexed file by path
     */
    getIndexedFile(filePath: string): IndexedFile | undefined {
        return this.index.get(filePath);
    }

    /**
     * Update index when files change
     */
    private setupEventListeners(): void {
        Logger.info('[InlineIndex] Setting up event listeners...');

        // arrow functions and type checking
        this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.handleRename(file, oldPath);
            }
        });

        this.app.vault.on('create', (file: TAbstractFile) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.handleCreate(file);
            }
        });

        this.app.vault.on('delete', (file: TAbstractFile) => {
            if (file instanceof TFile) {
                this.handleDelete(file);
            }
        });

        this.app.metadataCache.on('changed', (file: TFile) => {
            if (file.extension === 'md') {
                this.handleMetadataChange(file);
            }
        });

        Logger.info('[InlineIndex] Event listeners registered');
    }

    private handleRename(file: TFile, oldPath: string): void {
        Logger.info(`[InlineIndex] File renamed: ${oldPath} → ${file.path}`);

        this.index.delete(oldPath);
        this.indexFile(file);
        this.buildSearchableItems();
    }

    private handleCreate(file: TFile): void {
        Logger.debug(`[InlineIndex] File created: ${file.path}`);
        this.indexFile(file);
        this.buildSearchableItems();
    }

    private handleDelete(file: TFile): void {
        Logger.debug(`[InlineIndex] File deleted: ${file.path}`);
        this.index.delete(file.path);
        this.buildSearchableItems();
    }

    private handleMetadataChange(file: TFile): void {
        Logger.debug(`[InlineIndex] Metadata changed: ${file.path}`);
        this.indexFile(file);
        this.buildSearchableItems();
    }

    /**
     * Clear and rebuild index
     */
    async rebuild(): Promise<void> {
        this.index.clear();
        this.searchableItems = [];
        this.isInitialized = false;

        await this.initialize();
    }

    /**
     * Get statistics
     */
    getStats(): { files: number; items: number; types: Record<string, number> } {
        const types: Record<string, number> = {
            title: 0,
            heading: 0,
            tag: 0,
            frontmatter: 0
        };

        for (const item of this.searchableItems) {
            types[item.type]++;
        }

        return {
            files: this.index.size,
            items: this.searchableItems.length,
            types
        };
    }
}