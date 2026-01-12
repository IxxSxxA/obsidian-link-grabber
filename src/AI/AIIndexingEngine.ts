// src/AI/AIIndexingEngine.ts

import { Plugin, TFile } from 'obsidian';
import { Logger } from '../utils/Logger';
import type { AIEmbeddingDatabase } from './AIEmbeddingDatabase';
import type { AIService } from './AIService';

type IndexType = 'titles' | 'headings' | 'content';

export class AIIndexingEngine {
    private cancelIndexing = false;

    private readonly INDEXING_PARAMS = {
        titles: {
            chunkSize: 25,
            delayMs: 5,
            saveEvery: 25
        },
        headings: {
            chunkSize: 5,
            delayMs: 10,
            saveEvery: 15
        },
        content: {
            chunkSize: 2,
            delayMs: 50,
            saveEvery: 5
        }
    };

    constructor(
        private plugin: Plugin,
        private aiService: AIService,
        private database: AIEmbeddingDatabase,
        private settings: any
    ) { }

    async indexNote(file: TFile, save = true): Promise<void> {
        Logger.log(`📝 [IndexingEngine] Indexing: ${file.path}`);

        if (this.settings.aiIndexTitles) {
            await this.indexTitle(file);
        }

        if (this.settings.aiIndexHeadings) {
            await this.indexHeadings(file);
        }

        if (this.settings.aiIndexContent) {
            await this.indexContent(file);
        }

        if (save) {
            await this.database.save();
        }
    }

    private async indexTitle(file: TFile): Promise<void> {
        try {
            const existing = this.database.getTitleEmbedding(file.path);
            if (existing && existing.lastModified === file.stat.mtime) {
                return;
            }

            const embedding = await this.generatePassageEmbedding(file.basename);
            if (!embedding) {
                Logger.warn(`⚠️ [IndexingEngine] Failed embedding for ${file.path}`);
                return;
            }

            this.database.setTitleEmbedding(file.path, {
                path: file.path,
                embedding,
                lastModified: file.stat.mtime,
                title: file.basename
            });

            Logger.log(`✅ [IndexingEngine] Title indexed: ${file.basename}`);
        } catch (err) {
            Logger.error(`❌ [IndexingEngine] Title error for ${file.path}:`, err);
        }
    }

    private async indexHeadings(file: TFile): Promise<void> {
        try {
            const existing = this.database.getHeadingEmbedding(file.path);
            if (existing && existing.lastModified === file.stat.mtime) {
                return;
            }

            const cache = this.plugin.app.metadataCache.getFileCache(file);
            if (!cache?.headings || cache.headings.length === 0) {
                const current = this.database.getHeadingEmbedding(file.path);
                if (current) {
                    this.database.removeHeadingEmbedding(file.path);
                }
                return;
            }

            const headingsText = cache.headings.map(h => h.heading).join('\n');
            const embedding = await this.generatePassageEmbedding(headingsText);
            if (!embedding) {
                Logger.warn(`⚠️ [IndexingEngine] Failed headings for ${file.path}`);
                return;
            }

            this.database.setHeadingEmbedding(file.path, {
                path: file.path,
                embedding,
                lastModified: file.stat.mtime,
                headings: cache.headings.map(h => h.heading)
            });

            Logger.log(`✅ [IndexingEngine] Headings indexed: ${file.basename}`);
        } catch (err) {
            Logger.error(`❌ [IndexingEngine] Headings error for ${file.path}:`, err);
        }
    }

    private async indexContent(file: TFile): Promise<void> {
        try {
            const existing = this.database.getContentEmbedding(file.path);
            if (existing && existing.lastModified === file.stat.mtime) {
                return;
            }

            let content = await this.plugin.app.vault.cachedRead(file);

            const maxLength = 3000;
            if (content.length > maxLength) {
                content = content.substring(0, maxLength);
            }

            const embedding = await this.generatePassageEmbedding(content);
            if (!embedding) {
                Logger.warn(`⚠️ [IndexingEngine] Failed content for ${file.path}`);
                return;
            }

            this.database.setContentEmbedding(file.path, {
                path: file.path,
                embedding,
                lastModified: file.stat.mtime,
                excerpt: content.substring(0, 150).replace(/\n/g, ' ')
            });

            Logger.log(`✅ [IndexingEngine] Content indexed: ${file.basename}`);
        } catch (err) {
            Logger.error(`❌ [IndexingEngine] Content error for ${file.path}:`, err);
        }
    }

    async indexSpecificType(
        type: IndexType,
        onProgress?: (current: number, total: number) => void
    ): Promise<void> {
        if (this.isAnyIndexing()) {
            Logger.warn('⚠️ [IndexingEngine] Already indexing');
            return;
        }

        this.cancelIndexing = false;
        const files = this.plugin.app.vault.getMarkdownFiles();
        const totalFiles = files.length;

        this.database.setIndexingState(type, {
            isIndexing: true,
            progress: 0,
            total: totalFiles,
            lastHeartbeat: Date.now()
        });

        // ✅ 2. Save to disk IMMEDIATELY
        await this.database.save();

        Logger.log(`✅ [AISettingsTab] ${type} marked as indexing in database`);
        Logger.log(`📝 [IndexingEngine] Starting ${type} for ${totalFiles} notes`);

        try {
            switch (type) {
                case 'titles':
                    await this.indexAllTitles(files, (current, total) => {
                        if (onProgress) onProgress(current, total);
                        this.triggerIndexingUpdate('titles', current, total);
                    });
                    break;
                case 'headings':
                    await this.indexAllHeadings(files, (current, total) => {
                        if (onProgress) onProgress(current, total);
                        this.triggerIndexingUpdate('headings', current, total);
                    });
                    break;
                case 'content':
                    await this.indexAllContent(files, (current, total) => {
                        if (onProgress) onProgress(current, total);
                        this.triggerIndexingUpdate('content', current, total);
                    });
                    break;
            }

            this.database.setIndexingState(type, {
                isIndexing: false,
                lastIndexed: Date.now()
            });

            await this.database.save();
            this.triggerIndexingUpdate(type);
            this.triggerStatsRefresh();
            this.plugin.app.workspace.trigger('link-grabber:ai-settings-changed');

            this.database.setIndexingState(type, {
                progress: 0,
                total: 0
            });

            Logger.log(`✅ [IndexingEngine] ${type} complete`);

        } catch (err) {
            this.database.setIndexingState(type, {
                isIndexing: false,
                progress: 0,
                total: 0
            });

            this.triggerIndexingUpdate(type);
            Logger.error(`❌ [IndexingEngine] ${type} failed:`, err);
            throw err;
        }
    }

    private async indexAllTitles(
        files: TFile[],
        onProgress?: (current: number, total: number) => void
    ): Promise<void> {
        const { chunkSize, delayMs, saveEvery } = this.INDEXING_PARAMS.titles;
        let indexed = 0;

        for (let i = 0; i < files.length; i += chunkSize) {
            if (this.cancelIndexing) {
                Logger.log('🛑 [IndexingEngine] Titles cancelled');
                return;
            }

            await new Promise(resolve => setTimeout(resolve, delayMs));

            const chunk = files.slice(i, Math.min(i + chunkSize, files.length));

            for (const file of chunk) {
                try {
                    await this.indexTitle(file);
                } catch (err) {
                    Logger.warn(`⚠️ [IndexingEngine] Title error for ${file.path}:`, err);
                }
            }

            indexed += chunk.length;

            this.database.setIndexingState('titles', {
                progress: indexed,
                lastHeartbeat: Date.now()
            });

            if (onProgress) {
                onProgress(indexed, files.length);
            }

            if (indexed % saveEvery === 0) {
                await this.database.save();
                this.triggerIndexingUpdate('titles', indexed, files.length);
                Logger.log(`💾 [IndexingEngine] Titles: ${indexed}/${files.length}`);
            }
        }

        Logger.log(`✅ [IndexingEngine] Titles: ${indexed}`);
    }

    private async indexAllHeadings(
        files: TFile[],
        onProgress?: (current: number, total: number) => void
    ): Promise<void> {
        const { chunkSize, delayMs, saveEvery } = this.INDEXING_PARAMS.headings;
        let indexed = 0;

        for (let i = 0; i < files.length; i += chunkSize) {
            if (this.cancelIndexing) {
                Logger.log('🛑 [IndexingEngine] Headings cancelled');
                return;
            }

            await new Promise(resolve => setTimeout(resolve, delayMs));

            const chunk = files.slice(i, Math.min(i + chunkSize, files.length));

            for (const file of chunk) {
                try {
                    await this.indexHeadings(file);
                } catch (err) {
                    Logger.warn(`⚠️ [IndexingEngine] Headings error for ${file.path}:`, err);
                }
            }

            indexed += chunk.length;

            this.database.setIndexingState('headings', {
                progress: indexed,
                lastHeartbeat: Date.now()
            });

            if (onProgress) {
                onProgress(indexed, files.length);
            }

            if (indexed % saveEvery === 0) {
                await this.database.save();
                this.triggerIndexingUpdate('headings', indexed, files.length);
                //this.plugin.app.workspace.trigger('link-grabber:ai-settings-changed');
                Logger.log(`💾 [IndexingEngine] Headings: ${indexed}/${files.length}`);
            }
        }

        Logger.log(`✅ [IndexingEngine] Headings: ${indexed}`);
    }

    private async indexAllContent(
        files: TFile[],
        onProgress?: (current: number, total: number) => void
    ): Promise<void> {
        const { chunkSize, delayMs, saveEvery } = this.INDEXING_PARAMS.content;
        let indexed = 0;

        for (let i = 0; i < files.length; i += chunkSize) {
            if (this.cancelIndexing) {
                Logger.log('🛑 [IndexingEngine] Content cancelled');
                return;
            }

            await new Promise(resolve => setTimeout(resolve, delayMs));

            const chunk = files.slice(i, Math.min(i + chunkSize, files.length));

            for (const file of chunk) {
                try {
                    await this.indexContent(file);
                } catch (err) {
                    Logger.warn(`⚠️ [IndexingEngine] Content error for ${file.path}:`, err);
                }
            }

            indexed += chunk.length;

            this.database.setIndexingState('content', {
                progress: indexed,
                lastHeartbeat: Date.now()
            });

            if (onProgress) {
                onProgress(indexed, files.length);
            }

            if (indexed % saveEvery === 0) {
                await this.database.save();
                this.triggerIndexingUpdate('content', indexed, files.length);
                Logger.log(`💾 [IndexingEngine] Content: ${indexed}/${files.length}`);
            }
        }

        Logger.log(`✅ [IndexingEngine] Content: ${indexed}`);
    }

    async removeNote(path: string): Promise<void> {
        let removed = false;

        if (this.database.getTitleEmbedding(path)) {
            this.database.removeTitleEmbedding(path);
            removed = true;
        }

        if (this.database.getHeadingEmbedding(path)) {
            this.database.removeHeadingEmbedding(path);
            removed = true;
        }

        if (this.database.getContentEmbedding(path)) {
            this.database.removeContentEmbedding(path);
            removed = true;
        }

        if (removed) {
            await this.database.save();
            Logger.log(`🗑️ [IndexingEngine] Removed: ${path}`);
        }
    }

    async updateNoteIfNeeded(file: TFile): Promise<void> {
        const titleExists = this.database.getTitleEmbedding(file.path);
        const headingExists = this.database.getHeadingEmbedding(file.path);
        const contentExists = this.database.getContentEmbedding(file.path);

        const needsUpdate =
            (titleExists && titleExists.lastModified !== file.stat.mtime) ||
            (headingExists && headingExists.lastModified !== file.stat.mtime) ||
            (contentExists && contentExists.lastModified !== file.stat.mtime) ||
            (!titleExists && !headingExists && !contentExists);

        if (needsUpdate) {
            await this.indexNote(file);
        }
    }

    cancelBackgroundIndexing(): void {
        if (this.isAnyIndexing()) {
            this.cancelIndexing = true;
            Logger.log('🛑 [IndexingEngine] Cancellation requested');

            setTimeout(async () => {
                this.setAllIndexingFalse();
                await this.database.save();
                Logger.log('✅ [IndexingEngine] Cancelled and saved');
            }, 100);
        }
    }

    private isAnyIndexing(): boolean {
        return this.database.getIndexingState('titles').isIndexing ||
            this.database.getIndexingState('headings').isIndexing ||
            this.database.getIndexingState('content').isIndexing;
    }

    private setAllIndexingFalse(): void {
        this.database.setIndexingState('titles', { isIndexing: false });
        this.database.setIndexingState('headings', { isIndexing: false });
        this.database.setIndexingState('content', { isIndexing: false });
    }

    private async generatePassageEmbedding(text: string): Promise<number[] | null> {
        return this.aiService.generateEmbedding(text, 'passage');
    }

    private triggerIndexingUpdate(
        type: IndexType,
        progress?: number,
        total?: number
    ): void {
        try {
            const state = this.database.getIndexingState(type);

            const actualProgress = progress !== undefined ? progress : state.progress;
            const actualTotal = total !== undefined ? total : state.total;

            this.plugin.app.workspace.trigger('link-grabber:indexing-update', {
                type: type,
                isActive: state.isIndexing,
                progress: actualProgress,
                total: actualTotal
            });

            Logger.log(`📢 [IndexingEngine] Update: ${type} ${actualProgress}/${actualTotal}`);
        } catch (err) {
            Logger.warn('⚠️ [IndexingEngine] Trigger update failed:', err);
        }
    }

    private triggerStatsRefresh(): void {
        try {
            //this.plugin.app.workspace.trigger('link-grabber:refresh-stats');
            Logger.log('📈 [IndexingEngine] Stats refresh triggered');
        } catch (err) {
            Logger.warn('⚠️ [IndexingEngine] Stats refresh failed:', err);
        }
    }
}