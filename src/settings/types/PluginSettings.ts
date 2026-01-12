// src/settings/types/PluginSettings.ts

import { TFile } from 'obsidian';

export interface LinkGrabberSettings {

    // ════════════════════════════════════════════════════════════════════════════
    // INLINE SEARCH SETTINGS
    // ════════════════════════════════════════════════════════════════════════════

    minTextLength: number;
    maxSuggestions: number;
    debounceDelay: number;

    // What to search in
    searchInTitles: boolean;          // Search in note titles
    searchInHeadings: boolean;        // Search in headings (H1, H2, etc.)
    searchInMetadata: boolean;        // Search in tags and frontmatter

    // Custom word filters
    customIncludeWords: string;
    customExcludeWords: string;

    // Other options
    excludeCurrentNote: boolean;
    debugMode: boolean;

    // ════════════════════════════════════════════════════════════════════════════
    // INLINE SEARCH STOPWORDS
    // ════════════════════════════════════════════════════════════════════════════

    useStopWords: boolean;
    stopWordsURLs: string;
    customStopWords: string;

    // ════════════════════════════════════════════════════════════════════════════
    // AI SETTINGS - INDEXING (WHAT TO INDEX & SEARCH)
    // ════════════════════════════════════════════════════════════════════════════

    aiIndexTitles: boolean;      // Index note titles
    aiIndexHeadings: boolean;    // Index note headings
    aiIndexContent: boolean;     // Index full note content

    // ════════════════════════════════════════════════════════════════════════════
    // AI SETTINGS - GENERAL
    // ════════════════════════════════════════════════════════════════════════════

    aiMinTextLength: number;     // Minimum text length to trigger AI suggestions
    aiMaxSuggestions: number;    // Maximum number of suggestions to show
    aiAutoIndex: boolean;        // Auto-index notes on save

    // ════════════════════════════════════════════════════════════════════════════
    // AI STATE
    // ════════════════════════════════════════════════════════════════════════════

    aiState: {
        status: "not-configured" | "ready" | "error";
        message: string;
    };
    cachePath: string;
}

export interface SearchResultItem {
    file: TFile;
    score: number;
    matches: any[];
    matchType: 'title' | 'heading' | 'tag' | 'frontmatter';
    matchedText?: string;
}

export const DEFAULT_SETTINGS: LinkGrabberSettings = {
    // ════════════════════════════════════════════════════════════════════════════
    // INLINE DEFAULTS
    // ════════════════════════════════════════════════════════════════════════════

    minTextLength: 4,
    maxSuggestions: 5,
    debounceDelay: 200,

    // Search types
    searchInTitles: true,
    searchInHeadings: false,
    searchInMetadata: false,

    customIncludeWords: "",
    customExcludeWords: "",

    excludeCurrentNote: true,
    debugMode: true,    // SET TO FALSE IN PRODUCTION

    // ════════════════════════════════════════════════════════════════════════════
    // INLINE DEFAULTS - STOP WORDS DEFAULTS
    // ════════════════════════════════════════════════════════════════════════════

    useStopWords: false,
    stopWordsURLs: 'https://raw.githubusercontent.com/stopwords-iso/stopwords-en/master/stopwords-en.txt',
    customStopWords: '',


    // ════════════════════════════════════════════════════════════════════════════
    // AI DEFAULTS - INDEXING & SEARCH
    // ════════════════════════════════════════════════════════════════════════════

    aiIndexTitles: false,
    aiIndexHeadings: false,
    aiIndexContent: false,

    // ════════════════════════════════════════════════════════════════════════════
    // AI DEFAULTS - GENERAL
    // ════════════════════════════════════════════════════════════════════════════

    aiMinTextLength: 50,
    aiMaxSuggestions: 7,
    aiAutoIndex: true,

    // ════════════════════════════════════════════════════════════════════════════
    // AI STATE DEFAULTS
    // ════════════════════════════════════════════════════════════════════════════

    aiState: {
        status: 'not-configured',
        message: 'Not configured'
    },
    cachePath: '.obsidian/plugins/link-grabber/AIcache'
};