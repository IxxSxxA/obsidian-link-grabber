// src/settings/AISettingsTab.ts

import { App, Notice, Setting } from 'obsidian';
import { AIConfirmModal, showAIConfirm } from '../AI/AIModal';
import { AISettingsService } from '../AI/AISettingsService';
import { Logger } from '../utils/Logger';
import { LinkGrabberSettings } from './types/PluginSettings';

export class AISettingsTab {
    private aiProgressEl: HTMLElement | null = null;
    private aiEnableButtonEl: HTMLElement | null = null;
    private aiContainerEl: HTMLElement | null = null;
    private indexingUpdateListener: ((evt: CustomEvent) => void) | null = null;

    // Service facade
    private service: AISettingsService;

    constructor(
        private app: App,
        private pluginCore: any,
        private settings: any,
        private saveSettings: () => Promise<void>
    ) {
        this.service = new AISettingsService(
            app,
            pluginCore,
            pluginCore.settingsManager
        );
    }


    // ═══════════════════════════════════════════════════════════════════════
    // UI RENDERING
    // ═══════════════════════════════════════════════════════════════════════

    render(containerEl: HTMLElement): void {
        this.aiContainerEl = containerEl;
        const isReady = this.service.isAIReady();

        this.renderEnableButton(containerEl, isReady);

        if (isReady) {
            this.renderAIStats(containerEl);
        }

        //this.addSectionHeader(containerEl, '📊 Index & Search');
        this.renderIndexingSettings(containerEl, isReady);

        //this.addSectionHeader(containerEl, '⚙️ AI settings');
        this.renderGeneralAISettings(containerEl, isReady);

        if (isReady) {
            this.renderResetButton(containerEl);
        }

        // ✅ Register event listener
        this.indexingUpdateListener = (data: any) => {
            const { type, isActive, progress, total } = data;
            Logger.log(`🔥 [AISettingsTab] Indexing update received: ${type}:${isActive} ${progress}/${total}`);
            this.handleStatsRefresh();
        };

        // @ts-ignore
        this.app.workspace.on('link-grabber:indexing-update', this.indexingUpdateListener);

        // @ts-ignore
        this.app.workspace.on('link-grabber:ai-settings-changed', () => {
            Logger.log('⚙️ [AISettingsTab] Settings changed, refreshing UI');
            this.handleStatsRefresh();
        });
    }

    private addSectionHeader(containerEl: HTMLElement, title: string): void {
        containerEl.createEl('h4', {
            text: title,
            cls: 'link-grabber-section-sub'
        });
    }

    private renderEnableButton(containerEl: HTMLElement, isReady: boolean): void {
        const enableSetting = new Setting(containerEl)
            .setName(isReady ? '✅ AI Enabled' : '🧠 Enable AI Semantic Search')
            .setDesc(isReady
                ? 'AI is active and ready to use'
                : 'Download and initialize AI model (~118MB, one-time setup)')
            .addButton(button => {
                if (isReady) {
                    button
                        .setButtonText('✅ Enabled')
                        .setDisabled(true)
                        .setCta();
                } else {
                    button
                        .setButtonText('🧠 Enable AI')
                        .setCta()
                        .onClick(() => {
                            this.startAISetup()
                                .catch(err => {
                                    Logger.error('❌ AI setup failed:', err);
                                });
                        });
                }
            });

        this.aiEnableButtonEl = enableSetting.settingEl;
    }

    private renderAIStats(containerEl: HTMLElement): void {
        const existingStats = containerEl.querySelector('.ai-status-display-3db');
        if (existingStats) {
            existingStats.remove();
        }

        // ✅ Use service for stats
        const stats = this.service.getStats();
        const isIndexingLocally = stats.isIndexing;

        const statusDiv = containerEl.createDiv({ cls: 'ai-status-display-3db' });

        // Dynamic header
        if (isIndexingLocally && stats.currentIndexingType) {
            statusDiv.createEl('h4', {
                text: `🔄 Indexing ${stats.currentIndexingType}...`,
                cls: 'ai-stats-header'
            });
        } else {
            statusDiv.createEl('h4', {
                text: `📊 ${stats.totalNotes} unique notes indexed`,
                cls: 'ai-stats-header'
            });
        }

        const gridDiv = statusDiv.createDiv({ cls: 'ai-stats-grid' });

        this.renderStatCard(gridDiv, 'titles', '🔹 Titles', stats);
        this.renderStatCard(gridDiv, 'headings', '📖 Headings', stats);
        this.renderStatCard(gridDiv, 'content', '📄 Content', stats);

        // Footer
        const footerDiv = statusDiv.createDiv({ cls: 'ai-stats-footer' });

        const searchDbs: string[] = [];
        if (this.settings.aiIndexTitles) searchDbs.push('Titles');
        if (this.settings.aiIndexHeadings) searchDbs.push('Headings');
        if (this.settings.aiIndexContent) searchDbs.push('Content');

        footerDiv.createEl('small', {
            text: `🔍 Searching in: ${searchDbs.length > 0
                ? searchDbs.join(' + ')
                : 'None (enable below)'}`,
            cls: 'ai-stats-footer-text'
        });

        footerDiv.createEl('small', {
            text: `📝 Headings and Titles have different numbers? Maybe not all notes have Headings inside!`,
            cls: 'ai-stats-footer-text'
        });

        footerDiv.createEl('small', {
            text: `💾 Database: ${stats.databaseSizeKB} KB • Last update: ${stats.lastUpdate}`,
            cls: 'ai-stats-footer-text'
        });
    }

    private renderStatCard(
        container: HTMLElement,
        type: 'titles' | 'headings' | 'content',
        label: string,
        stats: any
    ): void {
        const card = container.createDiv({ cls: 'ai-stat-card' });
        card.createEl('div', { text: label, cls: 'ai-stat-label' });

        const isIndexingThis = stats.isIndexing && stats.currentIndexingType === type;

        if (isIndexingThis) {
            card.createEl('div', {
                text: `${stats.currentIndexingProgress}/${stats.totalIndexingItems}`,
                cls: 'ai-stat-value ai-progress-value'
            });
        } else {
            const count = type === 'titles' ? stats.titlesIndexed :
                type === 'headings' ? stats.headingsIndexed :
                    stats.contentIndexed;
            card.createEl('div', { text: count.toString(), cls: 'ai-stat-value' });
        }

        const settingKey = `aiIndex${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof LinkGrabberSettings;
        const isEnabled = this.settings[settingKey];

        card.createEl('div', {
            text: isEnabled ? '✅ Index' : '⏸️ Paused',
            cls: 'ai-stat-status'
        });
    }

    private renderIndexingSettings(containerEl: HTMLElement, enabled: boolean): void {


        this.createIndexButton(containerEl, 'Titles', enabled);
        this.createIndexButton(containerEl, 'Headings', enabled);
        this.createIndexButton(containerEl, 'Content', enabled);


        const desc = containerEl.createDiv({ cls: 'setting-item-description' });
        desc.style.marginBottom = '12px';

        const reindexDesc = containerEl.createDiv({ cls: 'setting-item-description' });
        reindexDesc.style.marginBottom = '12px';
        reindexDesc.style.padding = '8px';
        reindexDesc.style.background = 'var(--background-secondary)';
        reindexDesc.style.borderRadius = '4px';
        reindexDesc.createEl('small', {
            text: '💡 Index will enable search functions too. You may enable all three.'
        });
        reindexDesc.createEl('br');
        reindexDesc.createEl('small', {
            text: '⚠️ Enabling indexing will automatically re-index your vault for that type.'
        });
        reindexDesc.createEl('br');
        reindexDesc.createEl('small', {
            text: 'For large vaults this may take some time.'
        });
        reindexDesc.createEl('br');
        reindexDesc.createEl('small', {
            text: 'You can continue your work. AI sidebar will update once indexing is complete.'
        });
        reindexDesc.createEl('br');
        reindexDesc.createEl('small', {
            text: 'To open the sidebar use CTRL + P and search for Link Grabber Open AI Semantic Suggestions.'
        });
    }

    private createIndexButton(
        containerEl: HTMLElement,
        type: 'Titles' | 'Headings' | 'Content',
        aiEnabled: boolean
    ): void {
        // ✅ Use service
        const isActive = this.service.isIndexingEnabled(type);
        const buttonText = isActive
            ? 'Active - Click to Disable'
            : 'Click to Enable';
        const icon = this.service.getIconForType(type);
        const description = this.service.getDescriptionForType(type);

        const setting = new Setting(containerEl)
            .setName(`${icon} ${type}`)
            .setDesc(description);

        if (!aiEnabled) {
            setting.setClass('setting-disabled');
            setting.addButton(btn => btn
                .setButtonText('🔴 Enable AI First')
                .setDisabled(true)
            );
            return;
        }

        setting.addButton(btn => {
            if (isActive) {
                btn
                    .setButtonText(buttonText)
                    .setCta()
                    .onClick(() => {
                        this.handleDisableIndexing(type)
                            .catch(err => {
                                Logger.error(`Error disabling ${type}:`, err);
                            });
                    });
            } else {
                btn
                    .setButtonText(buttonText)
                    .setCta()
                    .onClick(() => {
                        this.handleEnableIndexing(type)
                            .catch(err => {
                                Logger.error(`Error enabling ${type}:`, err);
                            });
                    });
            }
        });
    }

    private renderGeneralAISettings(containerEl: HTMLElement, enabled: boolean): void {
        const minLengthSetting = new Setting(containerEl)
            .setName('Minimum text length')
            .setDesc('Minimum characters needed to trigger AI suggestions');

        if (!enabled) minLengthSetting.setClass('setting-disabled');

        minLengthSetting.addText(text => text
            .setPlaceholder('50')
            .setValue(this.settings.aiMinTextLength.toString())
            .setDisabled(!enabled)
            .onChange(async (value) => {
                this.settings.aiMinTextLength = parseInt(value) || 50;
                await this.saveSettings();
            }));

        const maxSugSetting = new Setting(containerEl)
            .setName('Maximum suggestions')
            .setDesc('How many AI suggestions to show in sidebar');

        if (!enabled) maxSugSetting.setClass('setting-disabled');

        maxSugSetting.addText(text => text
            .setPlaceholder('7')
            .setValue(this.settings.aiMaxSuggestions.toString())
            .setDisabled(!enabled)
            .onChange(async (value) => {
                this.settings.aiMaxSuggestions = parseInt(value) || 7;
                await this.saveSettings();
            }));

        const autoIndexSetting = new Setting(containerEl)
            .setName('Auto-update index on save')
            .setDesc('Automatically reindex notes when you make changes (recommended)');

        if (!enabled) autoIndexSetting.setClass('setting-disabled');

        autoIndexSetting.addToggle(toggle => toggle
            .setValue(this.settings.aiAutoIndex)
            .setDisabled(!enabled)
            .onChange(async (value) => {
                this.settings.aiAutoIndex = value;
                await this.saveSettings();
            }));
    }

    private renderResetButton(containerEl: HTMLElement): void {
        const resetSetting = new Setting(containerEl)
            .setName('🗑️ Reset Options')
            .setDesc('Reset Databases only or perform a full reset');

        resetSetting.addButton(button => button
            .setButtonText('🔄 Reset Databases')
            .setTooltip('Delete only embeddings databases (keep AI model)')
            .onClick(() => {
                this.softResetAI()
                    .catch(err => {
                        Logger.error('❌ Soft reset failed:', err);
                    });
            })
        );

        resetSetting.addButton(button => button
            .setButtonText('🗑️ Reset All')
            .setWarning()
            .setTooltip('Delete ALL AI data including downloaded model')
            .onClick(() => {
                this.nuclearResetAI()
                    .catch(err => {
                        Logger.error('❌ Nuclear reset failed:', err);
                    });
            })
        );

        const descDiv = containerEl.createDiv({ cls: 'setting-item-description' });
        descDiv.style.marginTop = '8px';
        descDiv.style.marginBottom = '8px';
        descDiv.style.padding = '8px';
        descDiv.style.background = 'var(--background-secondary)';
        descDiv.style.borderRadius = '4px';

        descDiv.createEl('small', {
            text: '🔄 Reset Databases but keep downloaded AI model. '
        });
        descDiv.createEl('br');
        descDiv.createEl('small', {
            text: '🗑️ Delete everything including AI model.'
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // REFRESH & STATS UPDATE
    // ═══════════════════════════════════════════════════════════════════════

    public async refresh(): Promise<void> {
        Logger.log('🔄 [AISettingsTab] Refreshing AI section...');

        try {
            if (!this.aiContainerEl) {
                Logger.warn('⚠️ No AI container found');
                return;
            }

            await this.pluginCore.settingsManager.loadSettings();
            this.settings = this.pluginCore.settingsManager.settings;

            Logger.log('✅ Settings reloaded:', {
                titles: this.settings.aiIndexTitles,
                headings: this.settings.aiIndexHeadings,
                content: this.settings.aiIndexContent
            });

            this.aiContainerEl.empty();

            // ✅ Use service
            const isReady = this.service.isAIReady();

            this.renderEnableButton(this.aiContainerEl, isReady);

            if (isReady) {
                this.renderAIStats(this.aiContainerEl);
            }

            //this.addSectionHeader(this.aiContainerEl, '📊 Index & Search');
            this.renderIndexingSettings(this.aiContainerEl, isReady);

            //this.addSectionHeader(this.aiContainerEl, '⚙️ AI settings');
            this.renderGeneralAISettings(this.aiContainerEl, isReady);

            if (isReady) {
                this.renderResetButton(this.aiContainerEl);
            }

            Logger.log('✅ AI section refreshed successfully');

        } catch (err) {
            Logger.error('❌ [AISettingsTab] Refresh failed:', err);
        }
    }

    private statsRefreshTimeout: NodeJS.Timeout | null = null;

    private handleStatsRefresh(): void {
        if (this.statsRefreshTimeout) {
            clearTimeout(this.statsRefreshTimeout);
        }

        this.statsRefreshTimeout = setTimeout(() => {
            if (!this.aiContainerEl) return;

            try {
                // ✅ Use service
                const stats = this.service.getStats();
                const statsSection = this.aiContainerEl.querySelector('.ai-status-display-3db');

                if (!statsSection) {
                    this.renderAIStats(this.aiContainerEl);
                } else {
                    this.updateStatsNumbers(statsSection, stats);
                }

            } catch (err) {
                Logger.error('❌ Failed to refresh stats:', err);
            }
        }, 100);
    }

    private updateStatsNumbers(statsSection: Element, stats: any): void {
        const header = statsSection.querySelector('.ai-stats-header');
        if (stats.isIndexing && stats.currentIndexingType) {
            const type = stats.currentIndexingType.charAt(0).toUpperCase() +
                stats.currentIndexingType.slice(1);
            if (header) header.textContent = `🔄 Indexing ${type}...`;
        } else {
            if (header) header.textContent = `📊 ${stats.totalNotes} unique notes indexed`;
        }

        const cards = statsSection.querySelectorAll('.ai-stat-card');

        const titleValue = cards[0]?.querySelector('.ai-stat-value');
        if (titleValue) {
            titleValue.textContent = stats.currentIndexingType === 'titles'
                ? `${stats.currentIndexingProgress}/${stats.totalIndexingItems}`
                : stats.titlesIndexed.toString();
        }

        const headingValue = cards[1]?.querySelector('.ai-stat-value');
        if (headingValue) {
            headingValue.textContent = stats.currentIndexingType === 'headings'
                ? `${stats.currentIndexingProgress}/${stats.totalIndexingItems}`
                : stats.headingsIndexed.toString();
        }

        const contentValue = cards[2]?.querySelector('.ai-stat-value');
        if (contentValue) {
            contentValue.textContent = stats.currentIndexingType === 'content'
                ? `${stats.currentIndexingProgress}/${stats.totalIndexingItems}`
                : stats.contentIndexed.toString();
        }

        const dbText = statsSection.querySelector('.ai-stats-footer-text:last-child');
        if (dbText) {
            dbText.textContent = `💾 Database: ${stats.databaseSizeKB} KB • Last update: ${stats.lastUpdate}`;
        }
    }

    public cleanup(): void {
        if (this.indexingUpdateListener) {
            // @ts-ignore
            this.app.workspace.off('link-grabber:indexing-update', this.indexingUpdateListener);
            this.indexingUpdateListener = null;
            Logger.log('🧹 [AISettingsTab] Listener cleaned up');
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // COMPLEX UI OPERATIONS (Modal confirmations, AI setup with progress)
    // ═══════════════════════════════════════════════════════════════════════

    private async handleEnableIndexing(type: 'Titles' | 'Headings' | 'Content'): Promise<void> {
        const stats = this.service.getStats();

        if (stats.isIndexing) {
            Logger.warn(`⚠️ [AISettingsTab] ${stats.currentIndexingType} already indexing, blocked!`);
            new Notice(`⚠️ ${stats.currentIndexingType} indexing in progress. Please wait.`);
            return;
        }

        const confirmed = await this.askStartIndexing(type);
        if (!confirmed) return;

        Logger.log(`🔄 [AISettingsTab] Enabling ${type}`);

        try {

            await this.service.enableIndexing(type);

            // ✅ Trigger refresh UI
            this.app.workspace.trigger('link-grabber:ai-settings-changed');

            // ✅ Refresh UI
            await this.refresh();

            Logger.log(`✅ [AISettingsTab] ${type} indexing started`);

        } catch (err) {
            Logger.error(`❌ [AISettingsTab] Failed to enable ${type}:`, err);
            new Notice(`❌ Failed to enable ${type} indexing`);
        }
    }

    private async handleDisableIndexing(type: 'Titles' | 'Headings' | 'Content'): Promise<void> {
        const confirmed = await this.askStopIndexing(type);
        if (!confirmed) return;

        Logger.log(`🔄 [AISettingsTab] Disabling ${type}`);

        // ✅ Use service for disable operation
        try {
            await this.service.disableIndexing(type);

            this.app.workspace.trigger('link-grabber:ai-settings-changed');
            await this.refresh();

            Logger.log(`✅ [AISettingsTab] ${type} disabled`);
        } catch (err) {
            Logger.error(`❌ [AISettingsTab] Failed to disable ${type}:`, err);
            new Notice(`❌ Failed to disable ${type} indexing`);
        }
    }

    private async softResetAI(): Promise<void> {
        const confirmed = await showAIConfirm(
            this.app,
            '🔄 Reset Databases',
            'This will DELETE ONLY the embeddings databases:\n' +
            '• Titles database\n' +
            '• Headings database\n' +
            '• Content database\n\n' +
            '⚠️ All indexing will be disabled.\n' +
            '✅ The AI model (~118MB) will be KEPT.\n\n' +
            'You can re-enable indexing after reset.',
            'Reset Databases',
            'Exit'
        );

        if (!confirmed) return;

        try {
            // ✅ Use service
            await this.service.softReset();

            this.app.workspace.trigger('link-grabber:ai-settings-changed');
            await this.refresh();

            Logger.log('✅ Soft reset complete - all indexing disabled');
        } catch (err) {
            Logger.error('❌ Soft reset failed:', err);
            new Notice('❌ Soft reset failed');
        }
    }

    private async nuclearResetAI(): Promise<void> {
        const confirmed = await showAIConfirm(
            this.app,
            '⚠️ NUCLEAR RESET',
            'This will PERMANENTLY DELETE:\n' +
            '• All AI model files (~118MB)\n' +
            '• All Databases\n' +
            '• Any AI configuration\n\n' +
            'You will need to re-download everything.',
            'Reset AI',
            'Exit'
        );

        if (!confirmed) return;

        try {
            // ✅ Use service
            await this.service.nuclearReset();

            await this.refresh();

            this.service.closeAISidebar();

            this.app.workspace.trigger('link-grabber:ai-reset-complete');

            Logger.log('✅ [AISettings] AI system completely reset and UI refreshed');
        } catch (err) {
            Logger.error('❌ [AISettings] Nuclear reset failed:', err);
            new Notice('❌ Nuclear reset failed');
        }
    }

    private async startAISetup(): Promise<void> {
        Logger.log("🚀 [AISettings] Starting AI setup...");

        if (!this.aiEnableButtonEl) {
            return;
        }

        this.aiProgressEl = document.createElement('div');
        this.aiProgressEl.className = 'ai-progress-container';
        this.aiEnableButtonEl.insertAdjacentElement('afterend', this.aiProgressEl);

        try {
            const aiService = this.pluginCore.aiManager?.getAIService();
            if (!aiService) throw new Error('AI Service not available');

            this.renderProgress('Checking for AI model files...', 5);
            const modelExists = await aiService.isModelDownloaded();

            if (!modelExists) {
                this.renderProgress('Downloading AI model (~118MB total)...', 10);
                const downloadSuccess = await aiService.downloadModel(
                    (msg: string, percent: number) => {
                        const mappedPercent = 10 + Math.floor(percent * 1.0);
                        this.renderProgress(msg, mappedPercent);
                    }
                );
                if (!downloadSuccess) throw new Error('Model download failed');
                this.renderProgress('✅ AI model downloaded!', 50);
            } else {
                this.renderProgress('✅ AI model already downloaded', 20);
            }

            this.renderProgress('Initializing transformers.js...', 60);
            const initSuccess = await aiService.initializeXenova();
            if (!initSuccess) throw new Error('Initialization failed');

            this.renderProgress('Loading AI model into memory...', 80);
            const loadSuccess = await aiService.loadModel();
            if (!loadSuccess) throw new Error('Model loading failed');

            await aiService.setState('ready', 'AI model loaded');
            Logger.log("✅ [AISettings] AI marked as ready");

            this.renderProgress('✅ AI Ready!', 100);

            setTimeout(async () => {
                if (this.aiProgressEl) {
                    this.aiProgressEl.remove();
                    this.aiProgressEl = null;
                }

                await this.refresh();

                setTimeout(() => {
                    // @ts-ignore
                    this.app.commands.executeCommandById('link-grabber:open-ai-sidebar');
                }, 500);
            }, 1000);

        } catch (err) {
            Logger.error('❌ [AISettings] AI setup failed:', err);

            const aiService = this.pluginCore.aiManager?.getAIService();
            if (aiService) {
                await aiService.setState('error', `Setup failed: ${err}`);
            }

            if (this.aiProgressEl) {
                this.aiProgressEl.empty();
                this.aiProgressEl.createEl('p', {
                    text: `❌ Setup failed: ${err}`,
                    cls: 'ai-error-text'
                });
            }
        }
    }

    private renderProgress(message: string, percent: number): void {
        if (!this.aiProgressEl) return;

        this.aiProgressEl.empty();
        this.aiProgressEl.createEl('p', { text: message, cls: 'ai-progress-text' });

        const barContainer = this.aiProgressEl.createDiv({ cls: 'ai-progress-bar-container' });
        const bar = barContainer.createDiv({ cls: 'ai-progress-bar' });
        bar.style.width = `${percent}%`;
    }

    private async askStartIndexing(type: string): Promise<boolean> {
        // ✅ Use service
        const hasExistingData = await this.service.hasExistingIndex(type);
        const timeDesc = this.service.getTimeDescriptionForType(type);

        let title: string;
        let message: string;
        let confirmText: string;

        if (!hasExistingData) {
            title = `Initial ${type.toUpperCase()} Indexing`;
            message = `This will index all your existing ${type.toUpperCase()}.\n` +
                `${timeDesc}\n\n` +
                `Proceed with initial indexing?`;
            confirmText = 'Start Indexing';
        } else {
            title = `Enable ${type.toUpperCase()} Auto-Indexing?`;
            message = `Auto-indexing for ${type.toUpperCase()} will be enabled.\n` +
                `New and modified notes will be indexed automatically.`;
            confirmText = `Enable`;
        }

        return new Promise((resolve) => {
            let userConfirmed = false;
            let userCancelled = false;

            new AIConfirmModal(
                this.app,
                title,
                message,
                confirmText,
                'Cancel',
                () => {
                    userConfirmed = true;
                    resolve(true);
                },
                () => {
                    userCancelled = true;
                    resolve(false);
                },
                () => {
                    if (!userConfirmed && !userCancelled) {
                        resolve(false);
                    }
                }
            ).open();
        });
    }

    private async askStopIndexing(type: string): Promise<boolean> {
        return new Promise((resolve) => {
            let userConfirmed = false;
            let userCancelled = false;

            new AIConfirmModal(
                this.app,
                `Disable ${type.toUpperCase()} Auto-Indexing?`,
                `Auto-indexing for ${type.toUpperCase()} will be stopped.\n\n` +
                `Existing database will be preserved.\n` +
                `You can enable it again later.`,
                'Disable',
                'Keep Enabled',
                () => {
                    userConfirmed = true;
                    resolve(true);
                },
                () => {
                    userCancelled = true;
                    resolve(false);
                },
                () => {
                    if (!userConfirmed && !userCancelled) {
                        resolve(false);
                    }
                }
            ).open();
        });
    }
}
