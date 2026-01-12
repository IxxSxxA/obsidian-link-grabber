// src/AI/AISemanticSearch.ts

import { Logger } from '../utils/Logger';
import type { AIEmbeddingDatabase } from './AIEmbeddingDatabase';
import type { AIService } from './AIService';

export interface SearchResult {
    path: string;
    score: number;
    title: string;
    excerpt: string;
    source: 'title' | 'heading' | 'content';
}

export interface SearchOptions {
    topK?: number;
    excludePath?: string;
    minScore?: number;
}

export class AISemanticSearch {
    constructor(
        private aiService: AIService,
        private database: AIEmbeddingDatabase,
        private settings: any
    ) { }

    async searchByEmbedding(
        queryEmbedding: number[],
        options: SearchOptions = {}
    ): Promise<SearchResult[]> {
        const {
            topK = 5,
            excludePath,
            minScore = 0.0
        } = options;

        return this.findSimilar(queryEmbedding, topK, excludePath, minScore);
    }

    async searchByText(
        queryText: string,
        options: SearchOptions = {}
    ): Promise<SearchResult[]> {
        const queryEmbedding = await this.generateQueryEmbedding(queryText);
        if (!queryEmbedding) {
            Logger.warn('⚠️ [Search] Failed to generate query embedding');
            return [];
        }

        return this.searchByEmbedding(queryEmbedding, options);
    }

    private async findSimilar(
        queryEmbedding: number[],
        topK: number,
        excludePath?: string,
        minScore?: number
    ): Promise<SearchResult[]> {
        const allResults: SearchResult[] = [];

        if (this.settings.aiIndexTitles === true) {
            const titles = this.database.getAllTitles();
            if (Object.keys(titles).length > 0) {
                for (const [path, data] of Object.entries(titles)) {
                    if (excludePath && path === excludePath) continue;

                    const score = this.cosineSimilarity(queryEmbedding, data.embedding);
                    allResults.push({
                        path,
                        score,
                        title: data.title,
                        excerpt: data.title,
                        source: 'title'
                    });
                }
            }
        }

        if (this.settings.aiIndexHeadings === true) {
            const headings = this.database.getAllHeadings();
            if (Object.keys(headings).length > 0) {
                for (const [path, data] of Object.entries(headings)) {
                    if (excludePath && path === excludePath) continue;

                    const score = this.cosineSimilarity(queryEmbedding, data.embedding);
                    allResults.push({
                        path,
                        score,
                        title: this.getFileTitle(path),
                        excerpt: data.headings.join(' • '),
                        source: 'heading'
                    });
                }
            }
        }

        if (this.settings.aiIndexContent === true) {
            const content = this.database.getAllContent();
            if (Object.keys(content).length > 0) {
                for (const [path, data] of Object.entries(content)) {
                    if (excludePath && path === excludePath) continue;

                    const score = this.cosineSimilarity(queryEmbedding, data.embedding);
                    allResults.push({
                        path,
                        score,
                        title: this.getFileTitle(path),
                        excerpt: data.excerpt,
                        source: 'content'
                    });
                }
            }
        }

        const bestByPath = new Map<string, SearchResult>();

        for (const result of allResults) {
            const existing = bestByPath.get(result.path);
            if (!existing || result.score > existing.score) {
                bestByPath.set(result.path, result);
            }
        }

        const merged = Array.from(bestByPath.values());
        merged.sort((a, b) => b.score - a.score);

        Logger.log(`🔍 [Search] Found ${merged.length} unique results from ${allResults.length} matches`);

        let filtered = merged;
        if (minScore !== undefined && minScore > 0) {
            filtered = merged.filter(r => r.score >= minScore);
        }

        return filtered.slice(0, topK);
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Vectors must have same length');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        return denominator === 0 ? 0 : dotProduct / denominator;
    }

    private getFileTitle(path: string): string {
        return path.split('/').pop()?.replace('.md', '') || path;
    }

    private async generateQueryEmbedding(text: string): Promise<number[] | null> {
        Logger.log('🔎 [SemanticSearch] 🔥 GENERATING QUERY EMBEDDING 🔥');
        Logger.log(`🔎 [SemanticSearch] Text: "${text.substring(0, 100)}..."`);
        Logger.log('🔎 [SemanticSearch] Type: QUERY (for search)');

        const result = await this.aiService.generateEmbedding(text, 'query');

        Logger.log('🔎 [SemanticSearch] Query embedding generated!');
        return result;
    }
}