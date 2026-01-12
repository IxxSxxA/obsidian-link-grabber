// src/AI/AIEmbeddingDatabase.ts

import { Plugin } from 'obsidian';
import { Logger } from '../utils/Logger';

export interface TitleEmbedding {
    path: string;
    embedding: number[];
    lastModified: number;
    title: string;
}

export interface HeadingEmbedding {
    path: string;
    embedding: number[];
    lastModified: number;
    headings: string[];
}

export interface ContentEmbedding {
    path: string;
    embedding: number[];
    lastModified: number;
    excerpt: string;
}

export interface IndexingState {
    isIndexing: boolean;
    progress: number;
    total: number;
    lastIndexed: number;
    lastHeartbeat: number;
}

export interface EmbeddingDatabases {
    version: string;
    lastUpdate: number;
    titles: Record<string, TitleEmbedding>;
    headings: Record<string, HeadingEmbedding>;
    content: Record<string, ContentEmbedding>;
    indexingStates: {
        titles: IndexingState;
        headings: IndexingState;
        content: IndexingState;
    };
}

export class AIEmbeddingDatabase {
    private dbPath = '.obsidian/plugins/link-grabber/AIcache/embeddings.json';
    private db: EmbeddingDatabases;

    constructor(private plugin: Plugin) {
        this.db = this.createEmptyDatabase();
    }

    private createEmptyDatabase(): EmbeddingDatabases {
        return {
            version: '2.0.0',
            lastUpdate: Date.now(),
            titles: {},
            headings: {},
            content: {},
            indexingStates: {
                titles: this.createEmptyState(),
                headings: this.createEmptyState(),
                content: this.createEmptyState()
            }
        };
    }

    private createEmptyState(): IndexingState {
        return {
            isIndexing: false,
            progress: 0,
            total: 0,
            lastIndexed: 0,
            lastHeartbeat: 0
        };
    }

    async load(): Promise<void> {
        try {
            const adapter = this.plugin.app.vault.adapter;
            if (await adapter.exists(this.dbPath)) {
                const data = await adapter.read(this.dbPath);
                const loaded = JSON.parse(data);

                if (loaded.version === '2.0.0') {
                    this.db = loaded;

                    for (const type of ['titles', 'headings', 'content'] as const) {
                        if (this.db.indexingStates[type].lastHeartbeat === undefined) {
                            this.db.indexingStates[type].lastHeartbeat = 0;
                        }

                        const state = this.db.indexingStates[type];
                        if (state.isIndexing) {
                            const isStale = state.lastHeartbeat > 0 &&
                                (Date.now() - state.lastHeartbeat > 30000);

                            if (isStale) {
                                Logger.log(`🔄 [Database] Auto-reset stale ${type} indexing`);
                                state.isIndexing = false;
                            }
                        }
                    }

                    Logger.log('✅ [Database] Loaded');
                } else {
                    Logger.log('⚠️ [Database] Old version detected, resetting');
                    await this.reset();
                }
            } else {
                Logger.log('📂 [Database] Not found, creating new');
                await this.reset();
            }
        } catch (err) {
            Logger.error('❌ [Database] Load error:', err);
        }
    }

    async save(): Promise<void> {
        try {
            const adapter = this.plugin.app.vault.adapter;
            this.db.lastUpdate = Date.now();

            await adapter.write(this.dbPath, JSON.stringify(this.db, null, 2));
            Logger.log('💾 [Database] Saved');
        } catch (err) {
            Logger.error('❌ [Database] Save error:', err);
        }
    }

    async reset(): Promise<void> {
        this.db = this.createEmptyDatabase();
        await this.save();
        Logger.log('🗑️ [Database] Reset complete');
    }

    setTitleEmbedding(path: string, embedding: TitleEmbedding): void {
        this.db.titles[path] = embedding;
    }

    getTitleEmbedding(path: string): TitleEmbedding | undefined {
        return this.db.titles[path];
    }

    removeTitleEmbedding(path: string): void {
        delete this.db.titles[path];
    }

    setHeadingEmbedding(path: string, embedding: HeadingEmbedding): void {
        this.db.headings[path] = embedding;
    }

    getHeadingEmbedding(path: string): HeadingEmbedding | undefined {
        return this.db.headings[path];
    }

    removeHeadingEmbedding(path: string): void {
        delete this.db.headings[path];
    }

    setContentEmbedding(path: string, embedding: ContentEmbedding): void {
        this.db.content[path] = embedding;
    }

    getContentEmbedding(path: string): ContentEmbedding | undefined {
        return this.db.content[path];
    }

    removeContentEmbedding(path: string): void {
        delete this.db.content[path];
    }

    getIndexingState(type: 'titles' | 'headings' | 'content'): IndexingState {
        return this.db.indexingStates[type];
    }

    setIndexingState(type: 'titles' | 'headings' | 'content', state: Partial<IndexingState>): void {
        Object.assign(this.db.indexingStates[type], state);
    }

    getAllTitles(): Record<string, TitleEmbedding> {
        return this.db.titles;
    }

    getAllHeadings(): Record<string, HeadingEmbedding> {
        return this.db.headings;
    }

    getAllContent(): Record<string, ContentEmbedding> {
        return this.db.content;
    }

    getStats() {
        const titlesCount = Object.keys(this.db.titles).length;
        const headingsCount = Object.keys(this.db.headings).length;
        const contentCount = Object.keys(this.db.content).length;

        const allPaths = new Set([
            ...Object.keys(this.db.titles),
            ...Object.keys(this.db.headings),
            ...Object.keys(this.db.content)
        ]);

        let activeType: 'titles' | 'headings' | 'content' | null = null;
        let activeProgress = 0;
        let activeTotal = 0;

        for (const type of ['titles', 'headings', 'content'] as const) {
            const state = this.db.indexingStates[type];
            if (state.isIndexing) {
                activeType = type;
                activeProgress = state.progress;
                activeTotal = state.total;
                break;
            }
        }

        return {
            titlesIndexed: titlesCount,
            headingsIndexed: headingsCount,
            contentIndexed: contentCount,
            totalNotes: allPaths.size,
            databaseSizeKB: Math.round(JSON.stringify(this.db).length / 1024),
            lastUpdate: new Date(this.db.lastUpdate).toLocaleString(),
            isIndexing: activeType !== null,
            currentIndexingType: activeType,
            currentIndexingProgress: activeProgress,
            totalIndexingItems: activeTotal
        };
    }

    getRawDatabase(): EmbeddingDatabases {
        return this.db;
    }
}