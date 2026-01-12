// src/ui/SuggestionRenderer.ts

import { App } from 'obsidian';
import { SearchResultItem } from '../settings/types/PluginSettings';
import { Logger } from "../utils/Logger";
import { TextUtils } from './TextUtils';

export class SuggestionRenderer {
    constructor(private app: App) { }

    renderSuggestion(item: SearchResultItem, el: HTMLElement): void {
        const container = el.createDiv({ cls: 'link-grabber-suggestion' });

        // File path and match type
        const pathEl = container.createDiv({ cls: 'link-grabber-path' });
        pathEl.setText(this.getPathDisplay(item));

        // Match content with highlighting
        const contextEl = container.createDiv({ cls: 'link-grabber-context' });
        this.renderMatchContent(item, contextEl);
    }

    private getPathDisplay(item: SearchResultItem): string {
        const typeLabels = {
            title: '📝 Title',
            heading: '📑 Heading',
            tag: '🏷️ Tag',
            frontmatter: '📋 Frontmatter'
        };

        const label = typeLabels[item.matchType] || item.matchType;
        return `${item.file.path} [${label}]`;
    }

    private renderMatchContent(item: SearchResultItem, el: HTMLElement): void {
        const matchText = item.matchedText || this.getDefaultText(item);

        switch (item.matchType) {
            case 'title':
                el.innerHTML = `Title: <strong>${this.highlightText(matchText, item.matches)}</strong>`;
                break;

            case 'heading':
                el.innerHTML = `Heading: <strong>${this.highlightText(matchText, item.matches)}</strong>`;
                break;

            case 'tag':
                el.innerHTML = `Tag: <strong>#${this.highlightText(matchText, item.matches)}</strong>`;
                break;

            case 'frontmatter':
                el.innerHTML = `Frontmatter: ${this.highlightText(matchText, item.matches)}`;
                break;

            default:
                el.setText(`Match in ${item.file.basename}`);
        }
    }

    private getDefaultText(item: SearchResultItem): string {
        switch (item.matchType) {
            case 'title':
                return item.file.basename;
            case 'heading':
            case 'tag':
            case 'frontmatter':
                return item.matchType;
            default:
                return '';
        }
    }

    private highlightText(text: string, matches: any[]): string {
        if (!matches || matches.length === 0) return text;

        const [start, end] = matches[0];
        const before = text.substring(0, start);
        const matched = text.substring(start, end);
        const after = text.substring(end);

        return `${before}<span class="link-grabber-match">${matched}</span>${after}`;
    }

    async getCompletedWord(item: SearchResultItem, partialWord: string): Promise<string> {

        if (item.matchedText && item.matches && item.matches.length > 0) {
            const completed = this.extractCompleteWordFromMatch(item, partialWord);
            if (completed) return completed;
        }

        // Caso 2: Fallback to partial
        return partialWord;
    }


    private extractCompleteWordFromMatch(item: SearchResultItem, partialWord: string): string {
        try {
            const [matchStart, matchEnd] = item.matches[0];
            const matchedText = item.matchedText!;

            // TAG (#project → project)
            if (item.matchType === 'tag') {
                return matchedText.replace(/^#/, '');
            }

            // FRONTMATTER (key: value → extract value)
            if (item.matchType === 'frontmatter') {
                const colonIndex = matchedText.indexOf(':');
                if (colonIndex !== -1 && matchStart > colonIndex) {
                    // Match after ":"
                    const valuePart = matchedText.substring(colonIndex + 1);
                    const valueMatchStart = matchStart - colonIndex - 1;
                    const valueMatchEnd = matchEnd - colonIndex - 1;

                    return TextUtils.extractCompleteWord(valuePart, valueMatchStart, valueMatchEnd)
                        .replace(/^[\s:]+|[\s:]+$/g, '');
                }
            }

            // General case -> use TextUtils
            return TextUtils.extractCompleteWord(matchedText, matchStart, matchEnd);

        } catch (error) {
            Logger.error('Error extracting word from match:', error);
            return partialWord;
        }
    }
}