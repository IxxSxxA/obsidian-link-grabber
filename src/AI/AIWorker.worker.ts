// AIWorker.worker.ts

import { Logger } from 'src/utils/Logger';

Logger.log('🧠 AI Worker starting...');

const fileCache = new Map();
let extractor: any = null;
let filesReceived = 0;

// 🔥 PATCH FETCH for local files
const originalFetch = self.fetch;
self.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input.toString();

    if (url.includes('Xenova/multilingual-e5-small')) {
        let filename = url.split('/').pop();

        if (filename === 'model.onnx' || filename === 'model_quantized.onnx') {
            filename = 'onnx/model_quantized.onnx';
        }

        if (filename && fileCache.has(filename)) {
            const data = fileCache.get(filename);
            return new Response(data, {
                status: 200,
                headers: {
                    'Content-Type': filename.endsWith('.json') ? 'application/json' : 'application/octet-stream'
                }
            });
        }
    }

    return originalFetch(input, init);
};

self.onmessage = self.onmessage =
    self.onmessage = async (e: MessageEvent) => {
        const data = e.data;

        if (data.type === 'receive-file') {
            handleReceiveFile(data);
            return;
        }

        if (data.type === 'load-pipeline') {
            Logger.log('🔄 [Worker] Loading pipeline by request...');
            await loadPipeline();
            return;
        }

        if (data.type === 'generate-embedding') {

            await handleGenerateEmbedding(
                data.requestId,
                data.text,
                data.textType || 'passage'
            );
            return;
        }
    };


function handleReceiveFile(data: any): void {
    if (data.isBinary) {
        fileCache.set(data.filename, data.data);
    } else {
        const decoder = new TextDecoder();
        fileCache.set(data.filename, decoder.decode(data.data));
    }

    filesReceived++;
    Logger.log(`📁 [Worker] File cached: ${data.filename} (${filesReceived}/4)`);

    if (filesReceived >= 4) {
        Logger.log('✅ [Worker] All model files received');
        self.postMessage({ type: 'all-files-received' });

        setTimeout(async () => {
            Logger.log('🚀 [Worker] Auto-loading pipeline...');
            try {
                await loadPipeline();
            } catch (error) {
                Logger.error('❌ [Worker] Auto-load failed:', error);
                self.postMessage({
                    type: 'error',
                    error: 'Pipeline loading failed: ' + (error instanceof Error ? error.message : String(error))
                });
            }
        }, 500);
    }
}

// 🔥 PIPELINE
async function loadPipeline(): Promise<void> {
    Logger.log('🔄 [Worker] Loading transformers.js pipeline...');

    try {
        // Patch process
        Object.defineProperty(globalThis, "process", {
            get: () => undefined,
            configurable: true,
        });

        // @ts-ignore
        const { pipeline, env } = await import('@huggingface/transformers');

        env.useFS = false;
        env.allowLocalModels = true;
        env.useFSCache = false;
        env.useBrowserCache = false;
        env.allowRemoteModels = false;

        extractor = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');

        Logger.log('✅ [Worker] Pipeline loaded successfully');

        self.postMessage({
            type: 'transformers-loaded',
            success: true,
            message: 'Pipeline ready'
        });

    } catch (error: any) {
        Logger.error('❌ [Worker] Failed to load pipeline:', error);

        self.postMessage({
            type: 'error',
            error: error.message || 'Pipeline loading failed'
        });

        throw error;
    }
}


// 🔥 EMBEDDING
async function handleGenerateEmbedding(
    requestId: string,
    text: string,
    textType: 'query' | 'passage' = 'passage'
): Promise<void> {
    Logger.log(`🔍 [Worker] Generating embedding (${textType}): "${text.substring(0, 50)}..."`);

    try {
        if (!extractor) {
            await loadPipeline();
        }

        const startTime = Date.now();

        // 🔥 Use textType for prefix
        let processedText = text;

        // If not prefix -> Add it based on textType
        if (!text.startsWith('query: ') && !text.startsWith('passage: ')) {
            processedText = textType + ': ' + text;
            Logger.log(`🔧 [Worker] Added prefix "${textType}:"`);
        } else {
            Logger.log(`✅ [Worker] Text already has prefix`);
        }

        // Use processedText instead of text

        Logger.log(`🎯 [Worker] Final text to embed: "${processedText.substring(0, 80)}..."`);
        const result = await extractor(processedText, { pooling: 'mean', normalize: true });
        const embedding = result.tolist ? result.tolist()[0] : Array.from(result.data);
        const timeMs = Date.now() - startTime;

        Logger.log(`✅ [Worker] Embedding generated in ${timeMs}ms`);

        self.postMessage({
            type: 'embedding-result',
            requestId: requestId,
            success: true,
            embedding: embedding,
            timeMs: timeMs
        });

    } catch (error: any) {
        Logger.error('❌ [Worker] Failed:', error);
        self.postMessage({
            type: 'embedding-result',
            requestId: requestId,
            success: false,
            error: error.message
        });
    }
}

