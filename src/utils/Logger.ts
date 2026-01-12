// src/utils/Logger.ts

export class Logger {
    private static debugMode = false;
    private static pluginName = '[Link-G]';

    static setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
        console.log(`🔧 ${this.pluginName} Debug: ${enabled ? 'ON' : 'OFF'}`);
    }

    // 🔴 ERRORS - Always ON
    static error(...args: any[]): void {
        console.error('❌', this.pluginName, ...args);
    }

    // 🟡 WARNINGS - Always ON
    static warn(...args: any[]): void {
        console.warn('⚠️', this.pluginName, ...args);
    }

    // 🟢 Only if debug ON
    static log(...args: any[]): void {
        if (this.debugMode) {
            console.log('🔍', this.pluginName, ...args);
        }
    }

    static info(...args: any[]): void {
        if (this.debugMode) {
            console.log('ℹ️', this.pluginName, ...args);
        }
    }

    static debug(...args: any[]): void {
        if (this.debugMode) {
            console.log('🔍', this.pluginName, ...args);
        }
    }

    // ✅ Some methods
    static searchStart(query: string): void {
        this.debug(`========== SEARCH START: "${query}" ==========`);
    }

    static searchSummary(query: string, filesProcessed: number, resultsCount: number, searchType: string): void {
        this.debug(`📊 SEARCH SUMMARY "${query}" - Files: ${filesProcessed}, Results: ${resultsCount}, Type: ${searchType}`);
    }

    static searchResult(rank: number, fileName: string, matchType: string, score: number): void {
        this.debug(`   ${rank}. "${fileName}" [${matchType}] score: ${score}`);
    }

    static searchNoResults(query: string): void {
        this.debug(`❌ No results found for "${query}"`);
    }

    static pluginLifecycle(action: 'loading' | 'unloading'): void {
        this.info(`🔗 ${action === 'loading' ? 'Loading' : 'Unloading'} Link Grabber plugin`);
    }
}