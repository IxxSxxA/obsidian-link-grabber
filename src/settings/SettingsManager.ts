// src/settings/SettingsManager.ts

import { Plugin } from 'obsidian';
import { Logger } from '../utils/Logger';
import { DEFAULT_SETTINGS, LinkGrabberSettings } from './types/PluginSettings';

export class SettingsManager {
    private plugin: Plugin;
    public settings: LinkGrabberSettings;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
        this.settings = DEFAULT_SETTINGS;
    }

    async loadSettings(): Promise<void> {
        const loadedData = await this.plugin.loadData() || {};

        // ✅ Modify Existent Object -> NOT OVERWRITE
        Object.assign(this.settings, DEFAULT_SETTINGS);
        Object.assign(this.settings, loadedData);

        Logger.log('🔄 [SettingsManager] Settings loaded:', {
            titles: this.settings,
            sameObject: this.settings
        });
    }


    async saveSettings(): Promise<void> {
        await this.plugin.saveData(this.settings);
        Logger.log('💾 [SettingsManager] Settings saved:', {
            titles: this.settings
        });
    }

    async updateSettings(newSettings: Partial<LinkGrabberSettings>): Promise<void> {

        // ✅ Modify Existent Object -> NOT OVERWRITE
        Object.assign(this.settings, newSettings);
        Logger.log('✏️ [SettingsManager] Updating settings:', newSettings);
        await this.saveSettings();
    }
}