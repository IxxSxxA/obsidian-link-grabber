// src/AI/AIWorkerService.ts
import { Plugin } from 'obsidian';
import { Logger } from '../utils/Logger';

export class AIWorkerService {
    private static instance: AIWorkerService | null = null;
    private worker: Worker | null = null;
    private isReady: boolean = false;
    private pendingRequests: Map<string, { resolve: (value: any) => void, reject: (error: any) => void }> = new Map();
    private plugin: Plugin;

    // ✅ Tracking restart
    private restartAttempts: number = 0;
    private readonly MAX_RESTART_ATTEMPTS = 3;
    private lastRestartTime: number = 0;
    private readonly MIN_RESTART_INTERVAL = 5000;

    private constructor(plugin: Plugin) {
        this.plugin = plugin;
    }

    static getInstance(plugin: Plugin): AIWorkerService {
        if (!this.instance) {
            this.instance = new AIWorkerService(plugin);
        }
        return this.instance;
    }

    /**
     * 🚀 Initialization Worker and load model
     */

    async initialize(): Promise<boolean> {
        if (this.worker) {
            Logger.log('✅ [AIWorkerService] Worker is already initialized');
            return this.isReady;
        }

        Logger.log('👷 [AIWorkerService] Initialization Web Worker...');

        try {
            // 🔥 
            // @ts-ignore
            const WorkerClass = (await import('./AIWorker.worker.ts')).default;

            this.worker = new (WorkerClass as any)();

            if (!this.worker) {
                throw new Error('Worker creation returned null/undefined');
            }

            Logger.log('✅ [AIWorkerService] Worker created!');

            // 🔥 CONFIGURE HANDLERS (IMPORTANT: before sending files)
            this.worker.onmessage = this.handleWorkerMessage.bind(this);
            this.worker.onerror = this.handleWorkerError.bind(this);


            Logger.log('📦 [AIWorkerService] Send model to worker...');
            await this.loadModelFiles();


            const ready = await this.waitForReady();

            if (ready) {
                this.isReady = true;
                Logger.log('✅ [AIWorkerService] Worker initialized and ready!');
            } else {
                Logger.error('❌ [AIWorkerService] Worker not ready');
            }

            return ready;

        } catch (error) {
            Logger.error('❌ [AIWorkerService] Worker initialization error:', error);
            return false;
        }
    }

    /**
     * 📦 Send all files to worker
     */
    private async loadModelFiles(): Promise<void> {
        Logger.log('📦 [AIWorkerService] Loading model to worker...');

        const adapter = this.plugin.app.vault.adapter;
        const pluginId = this.plugin.manifest.id;
        const basePath = `.obsidian/plugins/${pluginId}/AIcache/models/Xenova/multilingual-e5-small`;

        const files = [
            { name: 'config.json', isBinary: false },
            { name: 'tokenizer.json', isBinary: false },
            { name: 'tokenizer_config.json', isBinary: false },
            { name: 'onnx/model_quantized.onnx', isBinary: true }
        ];

        let filesLoaded = 0;
        const totalFiles = files.length;

        for (const file of files) {
            try {
                const fullPath = `${basePath}/${file.name}`;

                if (file.isBinary) {
                    const binaryData = await adapter.readBinary(fullPath);
                    this.worker?.postMessage({
                        type: 'receive-file',
                        filename: file.name,
                        data: binaryData,
                        isBinary: true
                    }, [binaryData]);
                } else {
                    const text = await adapter.read(fullPath);
                    const encoder = new TextEncoder();
                    const buffer = encoder.encode(text);
                    this.worker?.postMessage({
                        type: 'receive-file',
                        filename: file.name,
                        data: buffer.buffer,
                        isBinary: false
                    }, [buffer.buffer]);
                }

                filesLoaded++;
                Logger.log(`📁 [AIWorkerService] File ${filesLoaded}/${totalFiles}: ${file.name}`);

            } catch (error) {
                Logger.error(`❌ [AIWorkerService] Load error ${file.name}:`, error);
                throw error;
            }
        }

        Logger.log(`✅ [AIWorkerService] ${filesLoaded}/${totalFiles} files loaded`);
    }

    /**
     * ⏳ Wait for worker ready
     */
    private waitForReady(): Promise<boolean> {
        return new Promise((resolve) => {
            const checkReady = () => {
                if (this.isReady) {
                    resolve(true);
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        });
    }

    /**
     * 📨 Handler messages worker
     */
    private handleWorkerMessage(event: MessageEvent): void {
        const data = event.data;
        const requestId = data.requestId;

        Logger.log(`📨 [AIWorkerService] Received: ${data.type}`);

        switch (data.type) {
            case 'all-files-received':
                Logger.log('✅ [AIWorkerService] Worker has all files');
                break;

            case 'transformers-loaded':
                Logger.log('✅ [AIWorkerService] Transformers loaded in worker');
                this.isReady = true;
                break;

            case 'embedding-result':
                const pending = this.pendingRequests.get(requestId);
                if (pending) {
                    if (data.success) {
                        pending.resolve(data.embedding);
                    } else {
                        pending.reject(new Error(data.error));
                    }
                    this.pendingRequests.delete(requestId);
                }
                break;

            case 'batch-progress':
                // Future use batch progress
                Logger.log(`📊 [AIWorkerService] Batch progress: ${data.current}/${data.total}`);
                break;

            case 'error':
                Logger.error('❌ [AIWorkerService] Worker error:', data.error);
                // Notice pending requests
                this.pendingRequests.forEach((pending, id) => {
                    pending.reject(new Error(data.error));
                    this.pendingRequests.delete(id);
                });
                break;
        }
    }

    /**
     * 💥 Handler for errors worker
     */
    private handleWorkerError(error: ErrorEvent): void {
        Logger.error('💥 [AIWorkerService] Worker error:', error);


        this.pendingRequests.forEach((pending) => {
            pending.reject(new Error('Worker crashed: ' + error.message));
        });
        this.pendingRequests.clear();
        this.isReady = false;


        const now = Date.now();
        const timeSinceLastRestart = now - this.lastRestartTime;


        if (timeSinceLastRestart > 60000) { // 1 min -> reset counter
            this.restartAttempts = 0;
        }


        if (this.restartAttempts >= this.MAX_RESTART_ATTEMPTS) {
            Logger.error('❌ [AIWorkerService] Max restart attempts reached. Worker disabled.');

            // Notice
            if (this.plugin.app) {
                // @ts-ignore
                new Notice('⚠️ AI Worker failed multiple times. Please reload Obsidian or disable/re-enable AI.');
            }

            return; // ✅ STOP here
        }

        // ✅ Check min restart
        if (timeSinceLastRestart < this.MIN_RESTART_INTERVAL) {
            Logger.warn('⚠️ [AIWorkerService] Too soon to restart, waiting...');
            return;
        }

        // ✅ Exponential backoff: 2s, 4s, 8s
        const backoffDelay = Math.min(2000 * Math.pow(2, this.restartAttempts), 10000);
        this.restartAttempts++;
        this.lastRestartTime = now;

        Logger.log(`🔄 [AIWorkerService] Restart attempt ${this.restartAttempts}/${this.MAX_RESTART_ATTEMPTS} in ${backoffDelay}ms...`);

        setTimeout(async () => {
            try {
                await this.initialize();

                // ✅ If restart ok -> reset counter
                if (this.isReady) {
                    Logger.log('✅ [AIWorkerService] Worker restarted successfully');
                    this.restartAttempts = 0;
                }
            } catch (err) {
                Logger.error('❌ [AIWorkerService] Restart failed:', err);
            }
        }, backoffDelay);
    }

    /**
     * 🔍 Embedding
     */
    async generateEmbedding(
        text: string,
        textType: 'query' | 'passage' = 'passage'
    ): Promise<number[]> {
        if (!this.worker || !this.isReady) {
            throw new Error('Worker not ready -> First try initialize().');
        }

        const requestId = `embed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        Logger.log(`🔍 [AIWorkerService] Embedding request (${textType}): "${text.substring(0, 50)}..."`);

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });

            // 🔥 SEND textType TO WORKER
            this.worker?.postMessage({
                type: 'generate-embedding',
                requestId: requestId,
                text: text,
                textType: textType
            });

            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Timeout embedding (10s)'));
                }
            }, 10000);
        });
    }

    /**
     * 📚 Embedding batch
     */
    async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
        if (!this.worker || !this.isReady) {
            throw new Error('Worker not ready -> First try initialize().');
        }

        const requestId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        Logger.log(`📚 [AIWorkerService] Batch request: ${texts.length} text`);

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });

            this.worker?.postMessage({
                type: 'generate-embeddings-batch',
                requestId: requestId,
                texts: texts
            });

            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Timeout batch embedding (30s)'));
                }
            }, 30000);
        });
    }

    /**
     * ✅ Check if worker is ready
     */
    isWorkerReady(): boolean {
        return this.isReady && this.worker !== null;
    }

    /**
     * 🧹 Clean up
     */
    cleanup(): void {
        if (this.worker) {
            Logger.log('🧹 [AIWorkerService] Shutting down worker...');
            this.worker.terminate();
            this.worker = null;
            this.isReady = false;
            this.pendingRequests.clear();
        }
    }

    /**
     * ✅ Force reset -> manual
     */
    public async forceReset(): Promise<boolean> {
        Logger.log('🔄 [AIWorkerService] Force reset requested');

        // Stop worker
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }

        // Reset state
        this.isReady = false;
        this.restartAttempts = 0;
        this.lastRestartTime = 0;
        this.pendingRequests.clear();

        // Re-initialize
        return await this.initialize();
    }
}