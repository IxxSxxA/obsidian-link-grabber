// src/core/SuggestionManager.ts

import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, TFile } from 'obsidian';
import { SearchResultItem } from '../settings/types/PluginSettings';
import { Logger } from '../utils/Logger';
import { SearchEngine } from './SearchEngine';
import { SuggestionRenderer } from './SuggestionRenderer';
import { TextUtils } from './TextUtils';

interface PluginContext {
    app: any;
    plugin: any;
    settings: any;
    saveSettings: () => Promise<void>;
}

export class SuggestionManager extends EditorSuggest<SearchResultItem> {
    private lastTriggerTime: number = 0;
    public searchEngine: SearchEngine;
    private suggestionRenderer: SuggestionRenderer;
    private pluginContext: PluginContext;

    constructor(pluginContext: PluginContext) {
        super(pluginContext.app);
        this.pluginContext = pluginContext;

        // ✅ Initialize search engine with plugin reference
        this.searchEngine = new SearchEngine(
            pluginContext.app,
            pluginContext.settings,
            pluginContext.saveSettings,
            pluginContext.plugin
        );

        this.suggestionRenderer = new SuggestionRenderer(pluginContext.app);
    }

    /**
     * ✅ Initialize search engine (called from PluginCore)
     */
    async initialize(): Promise<void> {
        await this.searchEngine.initialize();
        Logger.info('[SuggestionManager] Initialized with index manager');
    }

    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null) {
        const now = Date.now();
        if (now - this.lastTriggerTime < 100) {
            return null;
        }
        this.lastTriggerTime = now;

        const currentWord = TextUtils.extractCurrentWord(editor, cursor);

        if (!currentWord || currentWord.length < this.pluginContext.settings.minTextLength) {
            return null;
        }

        const context = {
            start: { ...cursor, ch: cursor.ch - currentWord.length },
            end: cursor,
            query: currentWord
        };

        Logger.debug(`Trigger context:`, {
            word: currentWord,
            start: context.start,
            end: context.end,
            range: `chars ${context.start.ch}-${context.end.ch}`
        });

        return context;
    }

    async getSuggestions(context: EditorSuggestContext): Promise<SearchResultItem[]> {
        const results = await this.searchEngine.searchFiles(
            context.query,
            this.pluginContext.settings,
            context.file
        );

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, this.pluginContext.settings.maxSuggestions);
    }

    renderSuggestion(item: SearchResultItem, el: HTMLElement): void {
        this.suggestionRenderer.renderSuggestion(item, el);
    }

    async selectSuggestion(item: SearchResultItem, evt: MouseEvent | KeyboardEvent): Promise<void> {
        this.onChooseSuggestion(item, evt);
    }

    async onChooseSuggestion(item: SearchResultItem, evt: MouseEvent | KeyboardEvent): Promise<void> {
        const editor = this.context?.editor;
        if (!editor || !this.context?.start || !this.context?.end) {
            return;
        }

        const completedWord = await this.suggestionRenderer.getCompletedWord(item, this.context.query);

        editor.replaceRange(completedWord, this.context.start, this.context.end);
        const linkText = ` [[${item.file.basename}]]`;
        const endPos = {
            line: this.context.start.line,
            ch: this.context.start.ch + completedWord.length
        };
        editor.replaceRange(linkText, endPos, endPos);
        editor.setCursor({ line: endPos.line, ch: endPos.ch + linkText.length });
    }
}