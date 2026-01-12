// src/core/PluginCore.ts

import { Plugin } from 'obsidian';
import { AIManager } from '../AI/AIManager';
import { SuggestionManager } from '../inline/SuggestionManager';
import { SettingsManager } from '../settings/SettingsManager';
import { SettingTabManager } from '../settings/SettingTabManager';
import { StyleManager } from '../ui/StyleManager';
import { Logger } from '../utils/Logger';

export class PluginCore {
    public settingsManager: SettingsManager;
    public suggestionManager!: SuggestionManager;
    public aiManager: AIManager | null = null;
    public plugin: Plugin;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
        this.settingsManager = new SettingsManager(plugin);
    }

    async initialize(): Promise<void> {
        await this.settingsManager.loadSettings();
        Logger.setDebugMode(this.settingsManager.settings.debugMode);
        Logger.pluginLifecycle('loading');

        // ✅ Create SuggestionManager with proper context
        this.suggestionManager = new SuggestionManager({
            app: this.plugin.app,
            plugin: this.plugin,
            settings: this.settingsManager.settings,
            saveSettings: () => this.settingsManager.saveSettings()
        });

        // ✅ Initialize search engine (with stop words)
        await this.suggestionManager.initialize();

        // ✅ Register suggestion manager
        this.plugin.registerEditorSuggest(this.suggestionManager);

        // ✅ Add settings tab
        this.plugin.addSettingTab(new SettingTabManager(this.plugin.app, this));

        // ✅ Add styles (including AI styles)
        StyleManager.addStyles();

        // ✅ Initialize AI Manager
        await this.initializeAI();
    }

    /**
     * 🧠 Initialize AI Manager
     */
    private async initializeAI(): Promise<void> {
        try {
            Logger.info('[PluginCore] [AI] Initializing AI Manager...');

            this.aiManager = new AIManager(
                this.plugin,
                this.settingsManager.settings,
                () => this.settingsManager.saveSettings()
            );

            await this.aiManager.initialize();

            Logger.info('[PluginCore] [AI] AI Manager initialized successfully');

        } catch (err) {
            Logger.warn('[PluginCore] [AI] AI initialization failed (non-critical):', err);
            this.aiManager = null;
        }
    }

    /**
     * 🧹 Cleanup
     */
    async cleanup(): Promise<void> {
        Logger.info('Cleaning up PluginCore...');

        if (this.aiManager) {
            await this.aiManager.cleanup();
        }

        Logger.info('PluginCore cleanup complete');
    }

    /**
     * 🔍 Getters
     */
    getAIManager(): AIManager | null {
        return this.aiManager;
    }
}