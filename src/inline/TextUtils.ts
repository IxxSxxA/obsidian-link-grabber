// src/utils/TextUtils.ts

import { Editor, EditorPosition } from 'obsidian';
import { Logger } from '../utils/Logger';


export class TextUtils {

    static extractCurrentWord(editor: Editor, cursor: EditorPosition): string {
        const lineContent = editor.getLine(cursor.line);
        const textUntilCursor = lineContent.substring(0, cursor.ch);

        const words = textUntilCursor.split(/[\s\.,;:!?()\[\]{}"'`-]+/);
        const currentWord = words[words.length - 1] || '';

        Logger.debug(`Word extraction: "${currentWord}" from position ${cursor.ch}`);
        return currentWord;
    }

    static extractCompleteWord(content: string, matchStart: number, matchEnd: number): string {
        let wordStart = matchStart;
        let wordEnd = matchEnd;

        while (wordStart > 0 && !this.isWordBoundary(content[wordStart - 1])) {
            wordStart--;
        }

        while (wordEnd < content.length && !this.isWordBoundary(content[wordEnd])) {
            wordEnd++;
        }

        const fullWord = content.substring(wordStart, wordEnd).trim();
        return fullWord.replace(/^[.,;:!?()\[\]{}"'-]+|[.,;:!?()\[\]{}"'-]+$/g, '');
    }

    static isWordBoundary(char: string): boolean {
        return /[\s\.,;:!?()\[\]{}"'-]/.test(char);
    }

    static highlightMatches(text: string, matches: any[]): string {
        if (!matches || matches.length === 0) return text;

        const [start, end] = matches[0];
        const beforeMatch = text.substring(0, start);
        const matchedText = text.substring(start, end);
        const afterMatch = text.substring(end);

        return `${beforeMatch}<span class="link-grabber-match">${matchedText}</span>${afterMatch}`;
    }
}