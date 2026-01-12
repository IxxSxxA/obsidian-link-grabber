// src/AI/AIService.ts - MODIFICATO per usare Worker

import { Plugin } from "obsidian";
import type { LinkGrabberSettings } from "../settings/types/PluginSettings";
import { Logger } from "../utils/Logger";
import { AIWorkerService } from "./AIWorkerService";

// ✅ Only 3 possible states
type AIState = "not-configured" | "ready" | "error";

export class AIService {
  private static instance: AIService | null = null;
  private aiWorkerService: AIWorkerService;

  public status: AIState = "not-configured";
  public message = "Not configured";

  private constructor(
    public plugin: Plugin,
    public settings: LinkGrabberSettings,
    private saveSettingsCallback: () => Promise<void>,
  ) {

    this.aiWorkerService = AIWorkerService.getInstance(plugin);


    if (this.settings?.aiState?.status) {
      this.status = this.settings.aiState.status as AIState;
      this.message = this.settings.aiState.message ?? this.message;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SINGLETON
  // ═══════════════════════════════════════════════════════════

  static async getInstance(
    plugin: Plugin,
    settings: LinkGrabberSettings,
    saveSettings: () => Promise<void>,
  ): Promise<AIService> {
    if (this.instance === null) {
      Logger.log("🚀 [AIService] Creating singleton instance");
      this.instance = new AIService(plugin, settings, saveSettings);
      Logger.log("✅ [AIService] Singleton ready (Worker-based)");
    }
    return this.instance;
  }

  // ═══════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════

  /**
   * Refresh AI state
   */
  public async setState(state: AIState, message: string, persist = true): Promise<void> {
    Logger.log(`📄 [AIService] STATE: ${this.status} → ${state} (${message})`);

    this.status = state;
    this.message = message;

    if (persist) {
      try {
        this.settings.aiState = { status: state, message };
        await this.saveSettingsCallback();
        Logger.log("💾 [AIService] State persisted");
      } catch (err) {
        Logger.warn("⚠️ [AIService] Failed to persist state:", err);
      }
    }

    // Trigger event UI updates
    this.plugin.app.workspace.trigger("link-grabber:ai-state-changed");
  }

  /**
   * Step 1: Initialize Worker (initializeXenova)
   */
  public async initializeXenova(): Promise<boolean> {
    try {
      Logger.log("🔧 [AIService] Initializing AI Worker");

      // Initialize Worker Service
      const success = await this.aiWorkerService.initialize();

      if (success) {
        Logger.log("✅ [AIService] AI Worker ready");
        return true;
      } else {
        throw new Error("Worker initialization failed");
      }

    } catch (err: any) {
      Logger.error("❌ [AIService] Worker initialization failed:", err);
      await this.setState("error", `Init failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Step 2: Load AI model (now worker auto load)
   */
  public async loadModel(): Promise<boolean> {
    try {
      Logger.log("🎯 [AIService] Loading AI model in Worker...");

      const isReady = this.aiWorkerService.isWorkerReady();

      if (isReady) {
        await this.setState("ready", "AI Model loaded in Worker");
        Logger.log("✅ [AIService] AI model loaded (Worker-based)");
        return true;
      } else {
        throw new Error("Worker not ready after initialization");
      }

    } catch (err: any) {
      Logger.error("❌ [AIService] Model loading failed:", err);
      await this.setState("error", `Load failed: ${err.message}`);
      return false;
    }
  }

  /**
   * 
   */
  public async isModelDownloaded(): Promise<boolean> {
    Logger.log("📂 [AIService] Checking for model files...");

    await this.createModelFolders();

    const requiredFiles = [
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'onnx/model_quantized.onnx'
    ];

    for (const file of requiredFiles) {
      const fullPath = this.getModelFilePath(file);
      const exists = await this.fileExists(fullPath);

      if (!exists) {
        Logger.log(`❌ [AIService] Missing file: ${file}`);
        return false;
      }
    }

    Logger.log("✅ [AIService] All model files exist");
    return true;
  }

  /**
   * 
   */
  public async downloadModel(
    progressCallback?: (msg: string, percent: number) => void
  ): Promise<boolean> {

    Logger.log("📥 [AIService] Starting model download...");

    try {

      const filesToDownload = [
        {
          url: 'https://huggingface.co/Xenova/multilingual-e5-small/resolve/main/config.json',
          path: 'config.json',
          isBinary: false,
          sizeMB: 1
        },
        {
          url: 'https://huggingface.co/Xenova/multilingual-e5-small/resolve/main/tokenizer.json',
          path: 'tokenizer.json',
          isBinary: false,
          sizeMB: 1
        },
        {
          url: 'https://huggingface.co/Xenova/multilingual-e5-small/resolve/main/tokenizer_config.json',
          path: 'tokenizer_config.json',
          isBinary: false,
          sizeMB: 1
        },
        {
          url: 'https://huggingface.co/Xenova/multilingual-e5-small/resolve/main/onnx/model_quantized.onnx',
          path: 'onnx/model_quantized.onnx',
          isBinary: true,
          sizeMB: 118
        }
      ];

      // 
      await this.createModelFolders();

      // 
      for (let i = 0; i < filesToDownload.length; i++) {
        const file = filesToDownload[i];
        const progressPercent = Math.floor((i / filesToDownload.length) * 40);

        if (progressCallback) {
          const fileName = file.path.split('/').pop() || file.path;
          const sizeInfo = file.sizeMB ? ` (${file.sizeMB}MB)` : '';
          progressCallback(
            `Downloading ${fileName}${sizeInfo}...`,
            10 + progressPercent
          );
        }

        Logger.log(`📥 [AIService] Downloading: ${file.url}`);

        const success = await this.downloadFile(
          file.url,
          file.path,
          file.isBinary
        );

        if (!success) {
          throw new Error(`Failed to download: ${file.path}`);
        }

        Logger.log(`✅ [AIService] Downloaded: ${file.path}`);

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      Logger.log("🎉 [AIService] All model files downloaded successfully");
      return true;

    } catch (err: any) {
      Logger.error("❌ [AIService] Download failed:", err);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // EMBEDDING GENERATION
  // ═══════════════════════════════════════════════════════════

  /**
 * Generate embedding from text
 * @param text - Text to embed
 * @param textType - 'query' for search queries, 'passage' for indexed content (AI E5 optimization)
 */
  public async generateEmbedding(
    text: string,
    textType: 'query' | 'passage' = 'passage'
  ): Promise<number[] | null> {
    if (!this.isReady()) {
      Logger.warn("⚠️ [AIService] AI not ready");
      return null;
    }

    try {
      Logger.log(`🔍 [AIService] Generating embedding via Worker (${textType})...`, text.substring(0, 50) + "...");

      const embedding = await this.aiWorkerService.generateEmbedding(text, textType);

      Logger.log(`✅ [AIService] Embedding generated (${embedding.length} dims)`);
      return embedding;

    } catch (err: any) {
      Logger.error("❌ [AIService] Embedding generation failed:", err);
      return null;
    }
  }

  /**
   * Eembedding batch (for indexing optimization)
   */
  public async generateEmbeddingsBatch(texts: string[]): Promise<number[][] | null> {
    if (!this.isReady()) {
      Logger.warn("⚠️ [AIService] AI not ready for batch");
      return null;
    }

    try {
      Logger.log(`📚 [AIService] Generating batch embeddings via Worker: ${texts.length} texts`);

      const embeddings = await this.aiWorkerService.generateEmbeddingsBatch(texts);

      Logger.log(`✅ [AIService] Batch generated: ${embeddings.length} embeddings`);
      return embeddings;

    } catch (err: any) {
      Logger.error("❌ [AIService] Batch embedding generation failed:", err);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════

  private getModelFilePath(filename: string): string {
    const pluginId = this.plugin.manifest.id;
    return `.obsidian/plugins/${pluginId}/AIcache/models/Xenova/multilingual-e5-small/${filename}`;
  }

  private async createModelFolders(): Promise<void> {
    Logger.log("📁 [AIService] Creating folder structure...");

    const vault = this.plugin.app.vault;
    const pluginId = this.plugin.manifest.id;
    const basePath = `.obsidian/plugins/${pluginId}/AIcache/models/Xenova/multilingual-e5-small`;

    Logger.log(`📁 [AIService] Target path: ${basePath}`);

    try {
      await vault.createFolder(basePath);
      Logger.log(`✅ [AIService] Main folder created: ${basePath}`);

      await vault.createFolder(`${basePath}/onnx`);
      Logger.log(`✅ [AIService] ONNX folder created: ${basePath}/onnx`);

    } catch (err: any) {
      if (err.message.includes("already exists")) {
        Logger.log("📁 [AIService] Folder already exists, continuing...");
      } else {
        Logger.error("❌ [AIService] Failed to create folders:", err);
        throw err;
      }
    }
  }

  private async downloadFile(
    url: string,
    relativePath: string,
    isBinary: boolean
  ): Promise<boolean> {
    try {
      const fullPath = this.getModelFilePath(relativePath);
      const adapter = this.plugin.app.vault.adapter;

      Logger.log(`🔽 [AIService] Fetching: ${url}`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
      }

      if (isBinary) {
        Logger.log(`💾 [AIService] Writing binary file: ${fullPath}`);
        const arrayBuffer = await response.arrayBuffer();
        await adapter.writeBinary(fullPath, arrayBuffer);
        Logger.log(`✅ [AIService] Binary file saved: ${fullPath} (${arrayBuffer.byteLength} bytes)`);
      } else {
        Logger.log(`📝 [AIService] Writing text file: ${fullPath}`);
        const text = await response.text();
        await adapter.write(fullPath, text);
        Logger.log(`✅ [AIService] Text file saved: ${fullPath} (${text.length} chars)`);
      }

      return true;
    } catch (err: any) {
      Logger.error(`❌ [AIService] Download failed for ${url}:`, err);
      return false;
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      const adapter = this.plugin.app.vault.adapter;
      return await adapter.exists(path);
    } catch (err) {
      Logger.log(`🔍 [AIService] File exists check failed for ${path}:`, err);
      return false;
    }
  }

  /**
   * Test AI 
   */
  public async testAI(): Promise<void> {
    Logger.log("🧪 [AIService] Starting AI test (Worker-based)...");

    if (!this.isReady()) {
      return;
    }

    const testText = "This is a test for semantic embedding generation";
    const embedding = await this.generateEmbedding(testText);

    if (embedding) {
      Logger.log("🎯 TEST RESULT (Worker-based):");
      Logger.log("  Length:", embedding.length);
      Logger.log("  First 3:", embedding.slice(0, 3));
    } else {
      Logger.error("❌ Test failed");
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════

  /**
   * 
   */
  public isReady(): boolean {
    const workerReady = this.aiWorkerService?.isWorkerReady() ?? false;
    const statusReady = this.status === "ready";

    Logger.log(`🔍 [AIService] isReady check:`);
    Logger.log(`  - status: ${this.status} (${statusReady ? '✅' : '❌'})`);
    Logger.log(`  - worker: ${workerReady ? '✅' : '❌'}`);
    Logger.log(`  - combined: ${statusReady && workerReady ? '✅' : '❌'}`);

    return this.status === "ready";
  }

  /**
   * 
   */
  public getStatus(): { status: string; message: string } {
    return {
      status: this.status,
      message: this.message
    };
  }

  /**
   * 🧹 Cleanup
   */
  public cleanup(): void {
    this.aiWorkerService.cleanup();
    Logger.log("🧹 [AIService] Cleanup completed");
  }
}