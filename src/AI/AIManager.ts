// src/AI/AIManager.ts

import { Notice, Plugin, TFile } from 'obsidian';
import type { LinkGrabberSettings } from '../settings/types/PluginSettings';
import { Logger } from "../utils/Logger";
import { AIEmbeddingStore } from './AIEmbeddingStore';
import { AIService } from "./AIService";
import { AISidebarView, AI_SIDEBAR_VIEW_TYPE } from './AISidebarView';

export class AIManager {
    private aiService: AIService | null = null;
    private embeddingStore: AIEmbeddingStore | null = null;
    private autoUpdateTimeout: Map<string, NodeJS.Timeout> = new Map();

    constructor(
        private plugin: Plugin,
        private settings: LinkGrabberSettings,
        private saveSettings: () => Promise<void>
    ) { }



    // ================ EVENT LISTENERS ==================

    private registerEventListeners(): void {

        // 1. Auto-update
        this.plugin.registerEvent(
            this.plugin.app.vault.on('modify', (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.scheduleAutoUpdate(file);
                }
            })
        );

        // 2. Remove embedding from index
        this.plugin.registerEvent(
            this.plugin.app.vault.on('delete', async (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    await this.handleFileDelete(file);
                }
            })
        );

        // 3. Index new note
        this.plugin.registerEvent(
            this.plugin.app.vault.on('create', (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.scheduleAutoUpdate(file);
                }
            })
        );

        // 4. Rename/remove event
        this.plugin.registerEvent(
            this.plugin.app.vault.on('rename', async (file, oldPath) => {
                if (file instanceof TFile && file.extension === 'md') {
                    await this.handleFileRename(file, oldPath);
                }
            })
        );

        Logger.log('✅ [AIManager] Event listeners registered');
    }


    // ================ INITIALIZATION ==================

    /**
     * 🚀 INITIALIZATION
     */
    async initialize(): Promise<void> {
        Logger.log('🚀 [AIManager] Initialization');

        try {

            // 0 Register sidebar immediately
            // Let Obsidian knows sidebar is not dead
            this.registerSidebarView();

            // 1
            this.aiService = await AIService.getInstance(
                this.plugin,
                this.settings,
                this.saveSettings
            );

            // 2
            this.embeddingStore = new AIEmbeddingStore(
                this.plugin,
                this.aiService,
                this.settings
            );

            await this.embeddingStore.loadDatabase();

            // 3 AUTO-LOAD if model downloaded
            if (this.aiService) {
                const isModelDownloaded = await this.aiService.isModelDownloaded();
                if (isModelDownloaded) {
                    Logger.log('🔍 [AIManager] Model already downloaded, auto-loading');

                    // 1. Initialize transformers
                    const initSuccess = await this.aiService.initializeXenova();
                    if (initSuccess) {
                        // 2. Load model
                        const loadSuccess = await this.aiService.loadModel();
                        if (loadSuccess) {
                            Logger.log('✅ [AIManager] Model auto-loaded successfully');
                            //new Notice('🧠 AI Model auto-loaded from cache');
                        }
                    }
                }
            }

            // 4
            this.registerCommands();

            // 5
            this.registerEventListeners();

            // 6
            await this.performInitialCheck();

            // 7 
            await this.checkStateConsistency();

            // 8
            this.notifySidebarReady();

            Logger.log('✅ [AIManager] Initialization complete');

        } catch (err) {
            Logger.error('❌ [AIManager] Error during initialization:', err);
            // Don't stop if errors
            this.aiService = null;
        }
    }


    /**
     * 🔍 INITIAL CHECK
     */
    private async performInitialCheck(): Promise<void> {
        if (!this.aiService || !this.embeddingStore) return;

        const stats = this.embeddingStore.getStats();
        const isReady = this.aiService.isReady();

        Logger.log('📊 [AIManager] Initial Check:');
        Logger.log('  - AI Ready:', isReady);
        Logger.log('  - Notes Indexed:', stats.totalNotes);
        Logger.log('  - Database Size:', stats.databaseSizeKB, 'KB');

        // Suggest indexing if no notes and model ready
        // if (isReady && stats.totalNotes === 0) {
        //new Notice('💡 AI ready! Run "AI: Index All Notes" to enable suggestions.');
        // }
    }


    /**
     * 🔍 Check state consistency between settings and database
     * Runs at plugin startup to recover from crashes/interruptions
     */
    private async checkStateConsistency(): Promise<void> {
        const embeddingStore = this.getEmbeddingStore();
        if (!embeddingStore) return;

        const stats = embeddingStore.getStats();
        const states = embeddingStore.getIndexingStates();

        Logger.log('🔍 [checkStateConsistency] Starting check...');

        // Check lock
        const hasAnyActiveIndexing =
            states.titles.isIndexing ||
            states.headings.isIndexing ||
            states.content.isIndexing;

        // NO lock | DB empty → first run -> skip
        if (!hasAnyActiveIndexing && stats.totalNotes === 0) {
            Logger.log('🎯 [checkStateConsistency] Clean first run, skipping');
            return;
        }

        // No lock | DB not empty
        const checks = [
            { type: 'titles' as const, wantedByUser: this.settings.aiIndexTitles, currentCount: stats.titlesIndexed },
            { type: 'headings' as const, wantedByUser: this.settings.aiIndexHeadings, currentCount: stats.headingsIndexed },
            { type: 'content' as const, wantedByUser: this.settings.aiIndexContent, currentCount: stats.contentIndexed }
        ];

        for (const { type, wantedByUser, currentCount } of checks) {
            if (!wantedByUser) {
                Logger.log(`⏭️ [checkStateConsistency] ${type}: disabled by user`);
                continue;
            }

            const state = states[type];
            const totalFiles = this.plugin.app.vault.getMarkdownFiles().length;

            const hasActiveLock = state.isIndexing;
            const hasNoData = currentCount === 0;
            const isIncomplete = currentCount > 0 && currentCount < totalFiles;

            // Release lock
            if (hasActiveLock) {
                Logger.log(`🔓 [checkStateConsistency] ${type}: releasing lock`);
                embeddingStore['database'].setIndexingState(type, { isIndexing: false });
            }

            // Recovery
            if (hasActiveLock || hasNoData) {
                Logger.log(`🔄 [checkStateConsistency] ${type}: starting indexing...`);
                await embeddingStore.indexSpecificType(type);
            }
            else if (isIncomplete) {
                Logger.log(`🔄 [checkStateConsistency] ${type}: completing (${currentCount}/${totalFiles})...`);
                await embeddingStore.indexSpecificType(type);
            }
            else {
                Logger.log(`✅ [checkStateConsistency] ${type}: consistent`);
            }
        }

        await embeddingStore.saveDatabase();
        Logger.log('✅ [checkStateConsistency] Complete');
    }

    /**
     * 🔥 Notice to sidebar AI is ready
     */
    private notifySidebarReady(): void {
        // Method 1: Window event
        window.dispatchEvent(new CustomEvent('link-grabber:ai-ready'));

        // Method 2: Find sidebar
        const sidebarLeaves = this.plugin.app.workspace.getLeavesOfType(AI_SIDEBAR_VIEW_TYPE);
        sidebarLeaves.forEach(leaf => {
            const view = leaf.view;
            if (view instanceof AISidebarView) {
                view.refreshHeader();
                Logger.log('✅ [AIManager] Sidebar notified and refreshed');
            }
        });
    }


    /**
     * 🎪 REGISTER SIDEBAR
     */
    private registerSidebarView(): void {
        this.plugin.registerView(
            AI_SIDEBAR_VIEW_TYPE,
            (leaf) => new AISidebarView(
                leaf,
                this.aiService!,
                this.embeddingStore!,
                this.settings
            )
        );
        Logger.log('✅ [AIManager] Sidebar view registered');
    }

    /**
     * 🎪 SIDEBAR OPEN
     */
    async openSidebar(): Promise<void> {
        const { workspace } = this.plugin.app;

        if (!this.aiService?.isReady()) {
            //new Notice('⚠️ AI model not loaded. Open "AI Activation Panel" first.');
            return;
        }

        // Existing sidebar
        let leaf = workspace.getLeavesOfType(AI_SIDEBAR_VIEW_TYPE)[0];

        if (!leaf) {
            // Create sidebar
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                await rightLeaf.setViewState({
                    type: AI_SIDEBAR_VIEW_TYPE,
                    active: true
                });
                leaf = rightLeaf;
            }
        }

        // Focus
        if (leaf) {
            workspace.revealLeaf(leaf);
            Logger.log('✅ [AIManager] Sidebar opened');
        }
    }

    /**
     * 📚 INDEX ALL NOTES
     */
    private async indexAllNotes(): Promise<void> {

        if (!this.aiService?.isReady()) {
            //new Notice('⚠️ AI model not loaded');
            return;
        }

        try {
            await this.embeddingStore?.indexAllNotes((current, total) => {
                // if (notice) notice.setMessage(`📚 Indexing: ${current}/${total} notes`);
                Logger.log(`[AIManager][indexAllNotes] 📚 Indexing: ${current}/${total} notes`);
            });

            Logger.log('✅ Indexing complete!');

        } catch (err) {
            Logger.error('❌ [AIManager] Indexing error:', err);
        }
    }

    /**
     * 📝 INDEX CURRENT NOTE
     */
    private async indexCurrentNote(): Promise<void> {

        if (!this.aiService?.isReady()) {
            Logger.log('⚠️ AI model not loaded');
            return;
        }

        const activeFile = this.plugin.app.workspace.getActiveFile();

        if (!activeFile) {
            Logger.log('⚠️ No active note');
            return;
        }

        try {

            Logger.log(`📝 Indexing ${activeFile.basename}`);
            await this.embeddingStore?.indexNote(activeFile);
            Logger.log(`✅ ${activeFile.basename} indexed!`);

        } catch (err) {
            Logger.error('❌ [AIManager] Index note error:', err);
        }
    }

    /**
     * 📊 STATS
     */
    private showStats(): void {

        if (!this.embeddingStore) {
            //new Notice('⚠️ AI not initialized');
            return;
        }

        const stats = this.embeddingStore.getStats();
        const message = [
            '📊 AI Statistics:',
            `📚 Notes indexed: ${stats.totalNotes}`,
            `💾 Database size: ${stats.databaseSizeKB} KB`,
            `🕒 Last update: ${stats.lastUpdate}`
        ].join('\n');

        Logger.log('📊 [AIManager] Stats:', stats);
        Logger.log(message);
    }

    /**
     * 🗑️ RESET DATABASE
     */
    private async resetDatabase(): Promise<void> {

        const confirmed = confirm(
            'Are you sure you want to reset the AI database?\n\n' +
            'All embeddings will be deleted and you\'ll need to reindex your notes.'
        );

        if (!confirmed) return;

        try {
            await this.embeddingStore?.resetDatabase();
            //new Notice('✅ AI database reset complete');
            Logger.log('🗑️ [AIManager] Database reset');

        } catch (err) {
            //new Notice('❌ Reset failed');
            Logger.error('❌ [AIManager] Reset error:', err);
        }
    }

    /**
     * ⏱️ AUTO-UPDATE DEBOUNCE
     */
    private scheduleAutoUpdate(file: TFile): void {

        const existingTimeout = this.autoUpdateTimeout.get(file.path);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        const timeout = setTimeout(async () => {
            try {
                await this.embeddingStore?.updateNoteIfNeeded(file);
                Logger.log(`🔄 [AIManager] Auto-updated: ${file.path}`);
            } catch (err) {
                Logger.warn(`⚠️ [AIManager] Auto-update failed for ${file.path}:`, err);
            } finally {
                this.autoUpdateTimeout.delete(file.path);
            }
        }, 5000);

        this.autoUpdateTimeout.set(file.path, timeout);
    }

    /**
     * 🗑️ 
     */
    private async handleFileDelete(file: TFile): Promise<void> {
        try {
            await this.embeddingStore?.removeNote(file.path);
            Logger.log(`🗑️ [AIManager] Removed from index: ${file.path}`);
        } catch (err) {
            Logger.warn(`⚠️ [AIManager] Failed to remove ${file.path}:`, err);
        }
    }

    /**
     * 🔄 
     */
    private async handleFileRename(file: TFile, oldPath: string): Promise<void> {
        try {
            Logger.log(`🔄 [AIManager] File renamed: ${oldPath} → ${file.path}`);

            await this.embeddingStore?.removeNote(oldPath);
            await this.embeddingStore?.indexNote(file);

            Logger.log(`✅ [AIManager] Rename handled successfully`);
        } catch (err) {
            Logger.warn(`⚠️ [AIManager] Failed to handle rename:`, err);
        }
    }

    /**
     * 🧹 CLEANUP
     */
    async cleanup(): Promise<void> {
        Logger.log('🧹 [AIManager] Cleanup');


        for (const timeout of this.autoUpdateTimeout.values()) {
            clearTimeout(timeout);
        }
        this.autoUpdateTimeout.clear();


        if (this.embeddingStore) {
            await this.embeddingStore.saveDatabase();
        }


        if (this.aiService) {
            this.aiService.cleanup();
        }

        Logger.log('✅ [AIManager] Cleanup complete');
    }

    /**
     * 🔍 GETTERS
     */
    getAIService(): AIService | null {
        return this.aiService;
    }

    getEmbeddingStore(): AIEmbeddingStore | null {
        return this.embeddingStore;
    }

    isReady(): boolean {
        return this.aiService?.isReady() ?? false;
    }


    // ==== COMMANDS ====

    /**
     * ⌨️ CTRL + P Commands
     */
    private registerCommands(): void {
        // 1. Apri AI Sidebar
        this.plugin.addCommand({
            id: 'open-ai-sidebar',
            name: '🧠 Open AI Semantic Suggestions',
            callback: () => this.openSidebar()
        });

        // 2. Index all
        this.plugin.addCommand({
            id: 'ai-index-all-notes',
            name: '📚 AI Index All Notes',
            callback: async () => await this.indexAllNotes()
        });

        // 3. Index current note
        this.plugin.addCommand({
            id: 'ai-index-current-note',
            name: '📝 AI Index Current Note',
            callback: async () => await this.indexCurrentNote()
        });

        // 4. Show Stats
        this.plugin.addCommand({
            id: 'ai-show-stats',
            name: '📊 AI Show Statistics',
            callback: () => this.showStats()
        });

        // 5. Reset database
        this.plugin.addCommand({
            id: 'ai-reset-database',
            name: '🗑️ AI Reset Database',
            callback: async () => await this.resetDatabase()
        });

        // 6. Force manual reset
        this.plugin.addCommand({
            id: 'ai-force-reset-worker',
            name: '🔄 AI: Force Reset Worker',
            callback: async () => {
                const service = this.getAIService();
                if (service) {
                    const success = await (service as any).aiWorkerService?.forceReset();
                    new Notice(success ? '✅ Worker reset' : '❌ Reset failed');
                }
            }
        });

        Logger.log('✅ [AIManager] Commands registered');
    }
}