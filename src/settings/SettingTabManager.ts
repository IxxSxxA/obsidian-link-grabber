// src/settings/SettingTabManager.ts

import { App, PluginSettingTab } from 'obsidian';
import { RoadmapModal } from '../help';
import { Logger } from '../utils/Logger';
import { AISettingsTab } from './AISettingsTab';
import { InlineSettingsTab } from './InlineSettingsTab';

export class SettingTabManager extends PluginSettingTab {
    private settings: any;
    private saveSettings: () => Promise<void>;
    private pluginCore: any;

    private inlineTab: InlineSettingsTab;
    private aiTab: AISettingsTab;

    constructor(app: App, pluginCore: any) {
        super(app, pluginCore.plugin);
        this.pluginCore = pluginCore;
        this.settings = pluginCore.settingsManager.settings;
        this.saveSettings = () => pluginCore.settingsManager.saveSettings();

        Logger.setDebugMode(this.settings.debugMode);

        // Initialize sub-tabs
        this.inlineTab = new InlineSettingsTab(
            this.app,
            this.pluginCore,
            this.settings,
            this.saveSettings
        );

        this.aiTab = new AISettingsTab(
            this.app,
            this.pluginCore,
            this.settings,
            this.saveSettings
        );
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // ═══ INLINE SUGGESTIONS ═══
        this.addSectionHeader(containerEl, '🔗 In line suggestions as you type');
        const inlineContainer = containerEl.createDiv({ cls: 'inline-settings-section' });
        this.inlineTab.render(inlineContainer);

        // ═══ AI SEMANTIC SUGGESTIONS ═══
        this.addSectionHeader(containerEl, '🧠 AI semantic similarity');
        const aiContainer = containerEl.createDiv({ cls: 'ai-settings-section' });
        this.aiTab.render(aiContainer);

        // ═══ ADVANCED ═══
        //this.addSectionHeader(containerEl, '🔧 Advanced');
        this.renderAdvancedSettings(containerEl);

        // ═══ HELP ═══
        //this.addSectionHeader(containerEl, '❓ Help & Info');
        this.renderHelpSection(containerEl);
    }

    hide(): void {
        // Cleanup AI tab listeners
        this.aiTab.cleanup();
    }

    private addSectionHeader(containerEl: HTMLElement, title: string): void {
        containerEl.createEl('h3', {
            text: title,
            cls: 'link-grabber-section-main'
        });
    }

    private renderAdvancedSettings(containerEl: HTMLElement): void {
        const { Setting } = require('obsidian');

        new Setting(containerEl)
            .setName('🔧 Debug mode')
            .setDesc('Enable detailed console logging for troubleshooting')
            .addToggle((toggle: any) => toggle
                .setValue(this.settings.debugMode)
                .onChange(async (value: boolean) => {
                    this.settings.debugMode = value;
                    await this.saveSettings();
                    Logger.setDebugMode(value);
                }));
    }

    private renderHelpSection(containerEl: HTMLElement): void {
        const { Setting } = require('obsidian');

        new Setting(containerEl)
            .setName('📖 Help')
            .setDesc('Learn how to use Link Grabber')
            .addButton((button: any) => button
                .setButtonText('📖 Open Guide')
                .onClick(() => new RoadmapModal(this.app).open()));
    }
}