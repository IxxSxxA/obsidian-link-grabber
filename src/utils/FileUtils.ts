//src/utils/FileUtils.ts

import { App, TFile } from 'obsidian';
import { Logger } from "../utils/Logger";

export class FileUtils {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    async readFileContent(file: TFile): Promise<string> {
        try {
            return await this.app.vault.read(file);
        } catch (error) {
            Logger.error(`Error reading file ${file.path}:`, error);
            return '';
        }
    }

    getMarkdownFiles(): TFile[] {
        return this.app.vault.getMarkdownFiles();
    }

    async extractContextPreview(file: TFile, matches: any[], contextLength: number = 25): Promise<string> {
        try {
            const content = await this.readFileContent(file);
            const [start, end] = matches[0];

            const contextStart = Math.max(0, start - contextLength);
            const contextEnd = Math.min(content.length, end + contextLength);
            let contextText = content.substring(contextStart, contextEnd)
                .replace(/\n/g, ' ')
                .trim();

            const dotsStart = contextStart > 0 ? '...' : '';
            const dotsEnd = contextEnd < content.length ? '...' : '';

            return `${dotsStart}${contextText}${dotsEnd}`;
        } catch (error) {
            return '[read error]';
        }
    }
}