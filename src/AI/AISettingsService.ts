// src/AI/AISettingsService.ts

import { App } from 'obsidian';
import type { SettingsManager } from '../settings/SettingsManager';
import type { LinkGrabberSettings } from '../settings/types/PluginSettings';
import { Logger } from '../utils/Logger';

/**
 * AISettingsService - Facade for AI settings business logic
 * 
 * Responsibilities:
 * - State queries (is indexing enabled? has data?)
 * - Stats retrieval and calculations
 * - Enable/disable indexing operations
 * - Reset operations (soft + nuclear)
 * - Index management
 * 
 * Does NOT handle:
 * - UI rendering
 * - Event listeners
 * - Modal interactions
 * - Progress callbacks for UI
 */

export class AISettingsService {
    constructor(
        private app: App,
        private pluginCore: any,
        private settingsManager: SettingsManager
    ) {
        Logger.log('🎯 [AISettingsService] Initialized');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STATE QUERIES
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Check if AI is ready to use
     */
    isAIReady(): boolean {
        const status = this.getAIStatus();
        return status.status === 'ready';
    }

    /**
     * Get current AI status
     */
    getAIStatus(): { status: string; message: string } {
        const settings = this.settingsManager.settings;
        return settings.aiState ?? { status: 'not-configured', message: 'Not configured' };
    }

    /**
     * Check if a specific indexing type is enabled
     */
    isIndexingEnabled(type: 'Titles' | 'Headings' | 'Content'): boolean {
        const settings = this.settingsManager.settings;

        switch (type) {
            case 'Titles': return settings.aiIndexTitles;
            case 'Headings': return settings.aiIndexHeadings;
            case 'Content': return settings.aiIndexContent;
            default: return false;
        }
    }

    /**
     * Check if there's existing index data for a type
     */
    async hasExistingIndex(type: string): Promise<boolean> {
        const embeddingStore = this.pluginCore.aiManager.getEmbeddingStore();
        if (!embeddingStore) return false;

        const stats = embeddingStore.getStats();

        switch (type) {
            case 'Titles': return stats.titlesIndexed > 0;
            case 'Headings': return stats.headingsIndexed > 0;
            case 'Content': return stats.contentIndexed > 0;
            default: return false;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STATS OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Get current indexing statistics
     */
    getStats() {
        const embeddingStore = this.pluginCore.aiManager.getEmbeddingStore();
        if (!embeddingStore) {
            return {
                titlesIndexed: 0,
                headingsIndexed: 0,
                contentIndexed: 0,
                totalNotes: 0,
                databaseSizeKB: 0,
                lastUpdate: 'N/A',
                isIndexing: false,
                currentIndexingType: null,
                currentIndexingProgress: 0,
                totalIndexingItems: 0
            };
        }

        return embeddingStore.getStats();
    }

    /**
     * Get indexing states for all types
     */
    getIndexingStates() {
        const embeddingStore = this.pluginCore.aiManager.getEmbeddingStore();
        if (!embeddingStore) {
            return {
                titles: { isIndexing: false, progress: 0, total: 0 },
                headings: { isIndexing: false, progress: 0, total: 0 },
                content: { isIndexing: false, progress: 0, total: 0 }
            };
        }

        return embeddingStore.getIndexingStates();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INDEXING OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Enable indexing for a specific type and start indexing
     */
    async enableIndexing(type: 'Titles' | 'Headings' | 'Content'): Promise<void> {
        Logger.log(`📄 [AISettingsService] Enabling ${type} indexing`);

        const embeddingStore = this.pluginCore.aiManager.getEmbeddingStore();
        if (!embeddingStore) {
            throw new Error('Embedding store not available');
        }

        // Check if already indexing
        const stats = embeddingStore.getStats();
        if (stats.isIndexing) {
            throw new Error(`${stats.currentIndexingType} already indexing. Please wait.`);
        }

        // Update settings
        const update: Partial<LinkGrabberSettings> = {};
        switch (type) {
            case 'Titles': update.aiIndexTitles = true; break;
            case 'Headings': update.aiIndexHeadings = true; break;
            case 'Content': update.aiIndexContent = true; break;
        }

        await this.settingsManager.updateSettings(update);

        // Start indexing
        await this.reindexVault(type);

        Logger.log(`✅ [AISettingsService] ${type} indexing enabled and completed`);
    }

    /**
     * Disable indexing for a specific type
     */
    async disableIndexing(type: 'Titles' | 'Headings' | 'Content'): Promise<void> {
        Logger.log(`📄 [AISettingsService] Disabling ${type} indexing`);

        // Stop any active indexing
        await this.stopIndexing(type);

        // Update settings
        const update: Partial<LinkGrabberSettings> = {};
        switch (type) {
            case 'Titles': update.aiIndexTitles = false; break;
            case 'Headings': update.aiIndexHeadings = false; break;
            case 'Content': update.aiIndexContent = false; break;
        }

        await this.settingsManager.updateSettings(update);

        Logger.log(`✅ [AISettingsService] ${type} indexing disabled`);
    }

    /**
     * Stop active indexing for a specific type
     */
    private async stopIndexing(type: string): Promise<void> {
        const embeddingStore = this.pluginCore.aiManager.getEmbeddingStore();
        if (!embeddingStore) return;

        if (embeddingStore.getStats().isIndexing) {
            embeddingStore.cancelBackgroundIndexing();
            Logger.log(`🛑 Stopped ${type} indexing`);

            // Wait a bit for cancellation to complete
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    /**
     * Reindex vault for a specific type
     */
    async reindexVault(type: string): Promise<void> {
        const embeddingStore = this.pluginCore.aiManager.getEmbeddingStore();
        if (!embeddingStore) {
            throw new Error('Embedding store not available');
        }

        Logger.log(`📚 [AISettingsService] Starting ${type} indexing...`);

        const typeLower = type.toLowerCase() as 'titles' | 'headings' | 'content';
        await embeddingStore.indexSpecificType(typeLower);

        Logger.log(`✅ ${type} indexing complete!`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RESET OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Soft reset - Delete only embeddings databases
     */
    async softReset(): Promise<void> {
        Logger.log('🔄 [AISettingsService] Starting soft reset...');

        const embeddingStore = this.pluginCore.aiManager.getEmbeddingStore();
        if (!embeddingStore) {
            throw new Error('Embedding store not available');
        }

        // Stop any active indexing
        embeddingStore.cancelBackgroundIndexing();
        await new Promise(resolve => setTimeout(resolve, 500));

        // Disable all indexing
        await this.settingsManager.updateSettings({
            aiIndexTitles: false,
            aiIndexHeadings: false,
            aiIndexContent: false
        });

        // Delete database file from disk
        const pluginId = this.pluginCore.plugin.manifest.id;
        const { softReset: softResetUtil } = await import('./AIUtils');
        await softResetUtil(this.pluginCore.plugin, pluginId);

        // Reset database in memory
        await embeddingStore.resetDatabase();
        await embeddingStore.loadDatabase();

        Logger.log('✅ [AISettingsService] Soft reset complete');
    }

    /**
     * Nuclear reset - Delete everything including AI model
     */
    async nuclearReset(): Promise<void> {
        Logger.log('🗑️ [AISettingsService] Starting nuclear reset...');

        const pluginId = this.pluginCore.plugin.manifest.id;
        const { nuclearReset: nuclearResetUtil } = await import('./AIUtils');
        const filesDeleted = await nuclearResetUtil(this.pluginCore.plugin, pluginId);

        if (!filesDeleted) {
            throw new Error('Failed to delete AI files');
        }

        // Reset settings to defaults
        const { DEFAULT_SETTINGS } = await import('../settings/types/PluginSettings');

        await this.settingsManager.updateSettings({
            aiState: {
                status: 'not-configured',
                message: 'Reset complete. Enable AI to start again.'
            },
            aiIndexTitles: false,
            aiIndexHeadings: false,
            aiIndexContent: false,
            aiMinTextLength: DEFAULT_SETTINGS.aiMinTextLength,
            aiMaxSuggestions: DEFAULT_SETTINGS.aiMaxSuggestions,
            aiAutoIndex: DEFAULT_SETTINGS.aiAutoIndex,
            cachePath: DEFAULT_SETTINGS.cachePath
        });

        // Reset AI service state
        const aiService = this.pluginCore.aiManager.getAIService();
        if (aiService) {
            await aiService.setState('not-configured', 'Reset complete');
        }

        Logger.log('✅ [AISettingsService] Nuclear reset complete');
    }

    /**
     * Close AI sidebar if open
     */
    closeAISidebar(): void {
        try {
            const sidebarLeaves = this.app.workspace.getLeavesOfType('ai-semantic-suggestions');
            if (sidebarLeaves.length > 0) {
                sidebarLeaves.forEach(leaf => leaf.detach());
                Logger.log('✅ [AISettingsService] AI sidebar closed');
            }
        } catch (err) {
            Logger.warn('⚠️ [AISettingsService] Could not close sidebar:', err);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Get icon for indexing type
     */
    getIconForType(type: 'Titles' | 'Headings' | 'Content'): string {
        switch (type) {
            case 'Titles': return '🔹';
            case 'Headings': return '📖';
            case 'Content': return '📄';
            default: return '📝';
        }
    }

    /**
     * Get description for indexing type
     */
    getDescriptionForType(type: 'Titles' | 'Headings' | 'Content'): string {
        switch (type) {
            case 'Titles':
                return '⚡ Fast • Index Titles only';
            case 'Headings':
                return '⏱️ Medium • Index Headings only';
            case 'Content':
                return '⚠️ Slow • Index full note Content';
            default:
                return 'Index for semantic search';
        }
    }

    /**
     * Get time description for indexing type
     */
    getTimeDescriptionForType(type: string): string {
        switch (type) {
            case 'Titles':
                return 'Super fast indexing. Only Titles are indexed.';
            case 'Headings':
                return 'Overall fast indexing. Only Headings are indexed.';
            case 'Content':
                return 'It will take time to index the Content for all your notes.';
            default:
                return 'depending on your vault size';
        }
    }
}