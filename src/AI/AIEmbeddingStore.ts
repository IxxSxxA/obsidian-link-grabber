// src/AI/AIEmbeddingStore.ts

import { Plugin, TFile } from 'obsidian';
import { AIEmbeddingDatabase } from './AIEmbeddingDatabase';
import { AIIndexingEngine } from './AIIndexingEngine';
import { AISemanticSearch, SearchResult } from './AISemanticSearch';
import type { AIService } from './AIService';

export class AIEmbeddingStore {
    private database: AIEmbeddingDatabase;
    private indexer: AIIndexingEngine;
    private searcher: AISemanticSearch;

    constructor(
        private plugin: Plugin,
        private aiService: AIService,
        private settings: any
    ) {
        this.database = new AIEmbeddingDatabase(plugin);
        this.indexer = new AIIndexingEngine(plugin, aiService, this.database, settings);
        this.searcher = new AISemanticSearch(aiService, this.database, settings);
    }

    async loadDatabase(): Promise<void> {
        await this.database.load();
    }

    async saveDatabase(): Promise<void> {
        await this.database.save();
    }

    async resetDatabase(): Promise<void> {
        await this.database.reset();
    }

    async indexNote(file: TFile, save = true): Promise<void> {
        return this.indexer.indexNote(file, save);
    }

    async indexSpecificType(
        type: 'titles' | 'headings' | 'content',
        onProgress?: (current: number, total: number) => void
    ): Promise<void> {
        return this.indexer.indexSpecificType(type, onProgress);
    }
    async indexAllNotes(onProgress?: (current: number, total: number) => void): Promise<void> {
        const files = this.plugin.app.vault.getMarkdownFiles();
        const totalFiles = files.length;
        let indexedSoFar = 0;

        const updateProgress = (increment: number) => {
            indexedSoFar += increment;
            if (onProgress) onProgress(indexedSoFar, totalFiles);
        };

        if (this.settings.aiIndexTitles) {
            await this.indexer.indexSpecificType('titles', (current) => {
                updateProgress(current - indexedSoFar);
            });
        }

        if (this.settings.aiIndexHeadings) {
            await this.indexer.indexSpecificType('headings', (current) => {
                updateProgress(current - indexedSoFar);
            });
        }

        if (this.settings.aiIndexContent) {
            await this.indexer.indexSpecificType('content', (current) => {
                updateProgress(current - indexedSoFar);
            });
        }
    }

    async removeNote(path: string): Promise<void> {
        return this.indexer.removeNote(path);
    }

    async updateNoteIfNeeded(file: TFile): Promise<void> {
        return this.indexer.updateNoteIfNeeded(file);
    }

    cancelBackgroundIndexing(): void {
        this.indexer.cancelBackgroundIndexing();
    }

    async findSimilar(
        queryEmbedding: number[],
        topK = 5,
        excludePath?: string
    ): Promise<SearchResult[]> {
        return this.searcher.searchByEmbedding(queryEmbedding, {
            topK,
            excludePath
        });
    }

    getStats() {
        return this.database.getStats();
    }

    getIndexingStates() {
        const db = this.database.getRawDatabase();
        return {
            titles: { ...db.indexingStates.titles },
            headings: { ...db.indexingStates.headings },
            content: { ...db.indexingStates.content }
        };
    }
}