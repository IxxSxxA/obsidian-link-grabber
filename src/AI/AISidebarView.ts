// src/AI/AISidebarView.ts - WITH SOURCE BADGES FOR 3 DB SYSTEM

import { ItemView, MarkdownView, TFile, WorkspaceLeaf } from 'obsidian';
import { Logger } from "../utils/Logger";
import type { AIEmbeddingStore } from './AIEmbeddingStore';
import type { AIService } from "./AIService";

export const AI_SIDEBAR_VIEW_TYPE = 'ai-semantic-suggestions';

interface SearchResult {
  path: string;
  score: number;
  title: string;
  excerpt: string;
  source: 'title' | 'heading' | 'content';
}

export class AISidebarView extends ItemView {
  public containerEl!: HTMLElement;
  private suggestionsEl!: HTMLElement;
  private headerEl: HTMLElement | null = null;
  private currentFile: TFile | null = null;
  private updateTimeout: NodeJS.Timeout | null = null;
  private lastSuggestions: SearchResult[] = [];
  private lastActiveEditor: any = null;

  constructor(
    leaf: WorkspaceLeaf,
    private aiService: AIService,
    private embeddingStore: AIEmbeddingStore,
    private settings: any
  ) {
    super(leaf);
  }

  getViewType(): string {
    return AI_SIDEBAR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return '🧠 AI Suggestions';
  }

  getIcon(): string {
    return 'brain-circuit';
  }

  async onOpen(): Promise<void> {
    this.containerEl = this.contentEl;
    this.containerEl.empty();
    this.containerEl.addClass('ai-sidebar-container');


    this.renderHeader();
    this.renderSuggestions();


    // Event listeners

    if (this.aiService.isReady()) {
      this.handleActiveFileChange();
    } else {
      this.showPlaceholder('⚙️ AI model loading...');
      Logger.log('⏳ [AISidebarView] AI not ready at startup, waiting');
    }


    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        Logger.log('🏗️ [AISidebarView] layout-change detected');
        this.checkIfNoNotesOpen();
      })
    );


    this.registerEvent(
      // @ts-ignore - Custom event
      this.app.workspace.on('link-grabber:ai-state-changed', () => {
        Logger.log('🎯 [AISidebarView] AI state changed event received');
        this.refreshHeader();

        // ✅ SE PRIMA ERAVAMO IN ATTESA, ORA PROVACI
        if (this.aiService.isReady()) {
          Logger.log('✅ [AISidebarView] AI ready now, updating...');
          this.handleActiveFileChange();
        }
      })
    );


    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        Logger.log('📄 [AISidebarView] active-leaf-change');
        this.handleActiveFileChange();
      })
    );


    this.registerEvent(
      this.app.workspace.on('editor-change', () => {
        Logger.log('✏️ [AISidebarView] editor-change');
        this.scheduleUpdate();
      })
    );


    this.registerEvent(
      // @ts-ignore - Custom event
      this.app.workspace.on('link-grabber:ai-settings-changed', () => {
        Logger.log('⚙️ [AISidebarView] Settings changed - forcing refresh');
        // ✅ RESET CACHE per forzare refresh completo
        this.lastSuggestions = [];
        this.refreshHeader();
        this.updateSuggestions();
      })
    );


    // ✅ UNIFIED LISTENER   
    this.registerEvent(
      // @ts-ignore - Custom event
      this.app.workspace.on('link-grabber:indexing-update', (data: any) => {
        Logger.log(`📥 [AISidebarView] Indexing update: ${data.type} ${data.progress}/${data.total}`);
        this.refreshHeader();
      })
    );

    Logger.log('✅ [AISidebarView] Sidebar opened');
  }



  // ════════════════════════════════════════════════════════════════════════════
  // HEADER
  // ════════════════════════════════════════════════════════════════════════════

  private renderHeader(): void {
    if (!this.headerEl) {
      this.headerEl = this.containerEl.createDiv({ cls: 'ai-sidebar-header' });

      if (this.containerEl.firstChild !== this.headerEl) {
        this.containerEl.insertBefore(this.headerEl, this.containerEl.firstChild);
      }
    }

    this.headerEl.empty();

    this.headerEl.createEl('h3', {
      text: '🧠 AI Semantic Suggestions',
      cls: 'ai-sidebar-title'
    });

    const statusDiv = this.headerEl.createDiv({ cls: 'ai-sidebar-status' });
    const status = this.aiService.getStatus();
    const statusIcon = status.status === 'ready' ? '✅' : '⏳';
    statusDiv.createEl('span', {
      text: `${statusIcon} ${status.message}`,
      cls: 'ai-status-text'
    });

    const stats = this.embeddingStore.getStats();

    // ✅ Active search
    const searchModes: string[] = [];
    if (this.settings.aiIndexTitles) searchModes.push('Titles');
    if (this.settings.aiIndexHeadings) searchModes.push('Headings');
    if (this.settings.aiIndexContent) searchModes.push('Content');

    const searchInfo = searchModes.length > 0
      ? ` • Searching: ${searchModes.join(' + ')}`
      : ' • No search enabled';

    this.headerEl.createDiv({ cls: 'ai-sidebar-stats' }).createEl('small', {
      text: `📊 ${stats.totalNotes} notes • T:${stats.titlesIndexed} H:${stats.headingsIndexed} C:${stats.contentIndexed}${searchInfo}`
    });
  }

  public refreshHeader(): void {
    if (!this.headerEl) {
      this.headerEl = this.containerEl.querySelector('.ai-sidebar-header');
    }

    if (this.headerEl) {
      const oldHeader = this.headerEl;
      this.headerEl = null;
      oldHeader.remove();
      this.renderHeader(); // Questo ricrea con stats aggiornate
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SUGGESTIONS
  // ════════════════════════════════════════════════════════════════════════════

  private renderSuggestions(): void {
    this.suggestionsEl = this.containerEl.createDiv({ cls: 'ai-suggestions-container' });
    this.showPlaceholder('Click in your note or write something to get AI suggestions');
  }

  private showPlaceholder(message: string): void {
    this.suggestionsEl.empty();
    this.suggestionsEl.createDiv({ cls: 'ai-placeholder' }).createEl('p', {
      text: message
    });
  }

  private scheduleUpdate(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    this.updateTimeout = setTimeout(() => {
      Logger.log('⏰ [AISidebarView] Update scheduled - executing now');
      this.updateSuggestions();
    }, 2000);
  }


  // Check if no notes are open
  private checkIfNoNotesOpen(): void {
    const noNotesOpen = this.app.workspace.getLeavesOfType('markdown');

    if (noNotesOpen.length === 0) {
      // Non c'è nessuna nota markdown aperta
      if (this.currentFile) {
        Logger.log('📭 [AISidebarView] All notes closed, clearing current file');
        this.currentFile = null;
        this.lastActiveEditor = null;
        this.lastSuggestions = [];
        this.showPlaceholder('📂 Open a note to get AI suggestions...');
      }
    } else {
      Logger.log(`📚 [AISidebarView] ${noNotesOpen.length} note(s) still open, not clearing`);
    }
  }

  // ✅ MODIFICA: handleActiveFileChange più robusto
  private async handleActiveFileChange(): Promise<void> {
    // 🔥 SEMPLICE: Ottieni file attivo
    const { file, editor } = this.getCurrentFile();

    // Se non c'è file, pulisci
    if (!file) {
      this.clearState();
      const hasOpenNotes = this.app.workspace.getLeavesOfType('markdown').length > 0;
      this.showPlaceholder(hasOpenNotes
        ? '📂 Select a note to get suggestions...'
        : '📂 Open a note to get AI suggestions...');
      return;
    }

    // File change -> Update
    if (!this.currentFile || this.currentFile.path !== file.path) {
      this.currentFile = file;
      this.lastActiveEditor = editor;
      await this.updateSuggestions();
    }
    // Same file new suggestions -> Update
    else if (this.lastSuggestions.length === 0) {
      await this.updateSuggestions();
    }
  }


  private async updateSuggestions(): Promise<void> {

    // Check if AI is ready
    if (!this.aiService.isReady()) {
      this.showPlaceholder('⚙️ AI model loading...');
      return;
    }

    // 🔥 FIX: Get active file before using this.currentFile
    const { file, editor } = this.getCurrentFile();
    Logger.log('🔍 [AISidebarView] updateSuggestions called for:', file?.path);

    // 🔥 CASO 1: No file active
    if (!file) {
      const hasOpenNotes = this.app.workspace.getLeavesOfType('markdown').length > 0;
      this.showPlaceholder(hasOpenNotes
        ? '📂 Select a note to get suggestions...'
        : '📂 Open a note to get AI suggestions...');
      this.clearState();
      return;
    }

    // 🔥 Update before using this.currentFile
    this.currentFile = file;
    this.lastActiveEditor = editor;

    Logger.log('🔄 [AISidebarView] Updating suggestions for:', this.currentFile.path);

    // ✅ CHECK ANY DB IS ON
    if (!this.settings.aiIndexTitles &&
      !this.settings.aiIndexHeadings &&
      !this.settings.aiIndexContent) {
      this.showPlaceholder('🔍 Enable at least one Index & Search in settings');
      return;
    }

    try {
      const hadSuggestions = this.lastSuggestions.length > 0;

      if (!hadSuggestions) {
        this.showPlaceholder('🔍 Analyzing...');
      }

      const content = await this.app.vault.cachedRead(this.currentFile);
      Logger.log('✅ [AISidebarView] Content loaded -> length is:', content.length);

      if (content.length < this.settings.aiMinTextLength) {
        this.showPlaceholder(`Write more content (min ${this.settings.aiMinTextLength} characters)...`);
        return;
      }

      const embedding = await this.aiService.generateEmbedding(content, 'query');

      if (!embedding) {
        this.showPlaceholder('⏳ AI model loading...');
        return;
      }

      const similar = await this.embeddingStore.findSimilar(
        embedding,
        this.settings.aiMaxSuggestions,
        this.currentFile.path
      );

      if (this.areSuggestionsSame(similar, this.lastSuggestions)) {
        Logger.log('✅ [AISidebarView] Suggestions unchanged, skip render');
        return;
      }

      this.lastSuggestions = similar;
      this.renderSuggestionsList(similar);

      Logger.log('✅ [AISidebarView] Suggestions updated:', similar.length);

    } catch (err) {
      Logger.error('❌ [AISidebarView] Update error:', err);
      this.showPlaceholder('❌ Error analyzing content');
    }
  }

  private clearState(): void {
    this.currentFile = null;
    this.lastActiveEditor = null;
    this.lastSuggestions = [];
  }

  private areSuggestionsSame(
    newSuggestions: SearchResult[],
    oldSuggestions: SearchResult[]
  ): boolean {
    if (newSuggestions.length !== oldSuggestions.length) {
      return false;
    }

    for (let i = 0; i < newSuggestions.length; i++) {
      if (newSuggestions[i].path !== oldSuggestions[i].path) {
        return false;
      }

      const scoreDiff = Math.abs(newSuggestions[i].score - oldSuggestions[i].score);
      if (scoreDiff > 0.01) {
        return false;
      }
    }

    return true;
  }

  private truncateExcerpt(excerpt: string, maxLength: number = 150): string {
    if (excerpt.length <= maxLength) {
      return excerpt;
    }

    const truncated = excerpt.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER SUGGESTIONS LIST WITH SOURCE BADGES
  // ════════════════════════════════════════════════════════════════════════════

  private renderSuggestionsList(suggestions: SearchResult[]): void {
    Logger.log('🎨 [AISidebarView] Rendering', suggestions.length, 'suggestions');

    this.suggestionsEl.empty();

    const MIN_QUALITY = 0.5;
    const goodSuggestions = suggestions.filter(s => s.score >= MIN_QUALITY);

    if (goodSuggestions.length === 0) {
      const message = suggestions.length > 0
        ? `No good matches. Found ${suggestions.length} notes but all are below ${MIN_QUALITY * 100}% similarity`
        : 'No semantic similar notes found';
      this.showPlaceholder(message);
      return;
    }

    const header = this.suggestionsEl.createDiv({ cls: 'ai-suggestions-header' });

    if (goodSuggestions.length < suggestions.length) {
      header.createEl('h4', {
        text: `🎯 ${goodSuggestions.length} good matches found`,
        cls: 'ai-main-header'
      });
      header.createEl('small', {
        text: `(${suggestions.length - goodSuggestions.length} low-quality results filtered out)`,
        cls: 'ai-filter-hint'
      });
    } else {
      header.createEl('h4', { text: `Found ${goodSuggestions.length} similar notes` });
    }

    const listEl = this.suggestionsEl.createDiv({ cls: 'ai-suggestions-list' });

    goodSuggestions.forEach((sug, index) => {
      const item = listEl.createDiv({ cls: 'ai-suggestion-item' });
      item.style.cursor = 'default';
      item.style.pointerEvents = 'auto';

      const scorePercent = Math.round(sug.score * 100);
      const scoreClass =
        scorePercent > 80 ? 'high' :
          scorePercent > 60 ? 'medium' : 'low';

      const content = item.createDiv({ cls: 'ai-suggestion-content' });

      // ✅ HEADER TITLE + SOURCE BADGE
      const headerDiv = content.createDiv({ cls: 'ai-suggestion-header' });

      const titleEl = headerDiv.createEl('div', {
        text: `${index + 1}. ${sug.title}`,
        cls: 'ai-suggestion-title-text'
      });
      titleEl.style.cursor = 'default';
      titleEl.style.userSelect = 'text';

      // ✅ SOURCE BADGE
      const badge = headerDiv.createEl('span', {
        cls: `ai-source-badge source-${sug.source}`
      });

      switch (sug.source) {
        case 'title':
          badge.textContent = '📝 Title';
          break;
        case 'heading':
          badge.textContent = '🔖 Heading';
          break;
        case 'content':
          badge.textContent = '📄 Content';
          break;
      }

      // SCORE BAR
      const scoreBar = content.createDiv({ cls: 'ai-suggestion-score' });
      scoreBar.createDiv({ cls: `ai-score-bar ${scoreClass}` }).style.width = `${scorePercent}%`;
      scoreBar.createEl('span', {
        text: `${scorePercent}% similar`,
        cls: 'ai-score-text'
      });

      // EXCERPT
      const excerptEl = content.createDiv({ cls: 'ai-suggestion-excerpt' });
      excerptEl.createEl('small', {
        text: this.truncateExcerpt(sug.excerpt)
      });
      excerptEl.style.cursor = 'default';

      // ACTIONS
      const actions = content.createDiv({ cls: 'ai-suggestion-actions' });

      const btnInsert = actions.createEl('button', {
        text: '🔗 Insert',
        cls: 'ai-action-btn ai-btn-insert'
      });

      btnInsert.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        Logger.log('🔗 [AISidebarView] INSERT clicked for:', sug.title);
        this.handleInsertLink(sug.title);
      });

      const btnOpen = actions.createEl('button', {
        text: '📂 Open',
        cls: 'ai-action-btn ai-btn-open'
      });

      btnOpen.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        Logger.log('📂 [AISidebarView] OPEN clicked for:', sug.path);
        this.handleOpenNote(sug.path);
      });
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ════════════════════════════════════════════════════════════════════════════


  private handleInsertLink(noteTitle: string): void {
    Logger.log('🔗 [AISidebarView] handleInsertLink START:', noteTitle);

    try {
      let editor = this.lastActiveEditor;

      if (!editor) {
        Logger.log('⚠️ [AISidebarView] No saved editor, trying to get active view...');
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

        if (!activeView) {
          Logger.warn('❌ [AISidebarView] No active editor found');
          //new Notice('⚠️ No active editor. Click in your note first, then try again.');
          return;
        }

        editor = activeView.editor;
      }

      Logger.log('✅ [AISidebarView] Editor found');

      const cursor = editor.getCursor();
      Logger.log('📍 [AISidebarView] Cursor position:', cursor);

      const link = `[[${noteTitle}]]`;
      editor.replaceRange(link, cursor);

      Logger.log('✅ [AISidebarView] Link inserted:', link);

      const newCursor = {
        line: cursor.line,
        ch: cursor.ch + link.length
      };
      editor.setCursor(newCursor);

      setTimeout(() => {
        editor.focus();
        Logger.log('✅ [AISidebarView] Editor focused');
      }, 50);

      //new Notice(`✅ Link inserted: ${noteTitle}`);
      Logger.log('🎉 [AISidebarView] handleInsertLink COMPLETE');

    } catch (err) {
      Logger.error('❌ [AISidebarView] handleInsertLink ERROR:', err);
      //new Notice('❌ Failed to insert link');
    }
  }

  private async handleOpenNote(path: string): Promise<void> {
    Logger.log('📂 [AISidebarView] handleOpenNote START:', path);

    try {
      const file = this.app.vault.getAbstractFileByPath(path);

      if (!(file instanceof TFile)) {
        Logger.error('❌ [AISidebarView] File not found:', path);
        //new Notice('❌ Note not found');
        return;
      }

      Logger.log('✅ [AISidebarView] File found:', file.basename);

      const leaf = this.app.workspace.getLeaf('tab');
      await leaf.openFile(file);

      //new Notice(`📂 Opened: ${file.basename}`);
      Logger.log('🎉 [AISidebarView] handleOpenNote COMPLETE');

    } catch (err) {
      Logger.error('❌ [AISidebarView] handleOpenNote ERROR:', err);
      //new Notice('❌ Failed to open note');
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  private getCurrentFile(): { file: TFile | null; editor: any } {
    // Logger.log('🔍 [AISidebarView] getCurrentFile called');

    // 1.
    const activeFile = this.app.workspace.getActiveFile();
    Logger.log('🔍 [AISidebarView] [getCurrentFile] Active file:', activeFile?.path);

    // 2.
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (!activeFile) {
      Logger.log('📭 [AISidebarView] No active file');
      return { file: null, editor: null };
    }

    // 3.
    const fileExists = this.app.vault.cachedRead(activeFile);
    if (!fileExists) {
      Logger.log('⚠️ [AISidebarView] File not found in vault');
      return { file: null, editor: null };
    }

    Logger.log(`✅ [AISidebarView] Active file: ${activeFile.path}`);

    return {
      file: activeFile,
      editor: activeView?.editor || null
    };
  }

  async onClose(): Promise<void> {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    Logger.log('👋 [AISidebarView] Sidebar closed');
  }
}