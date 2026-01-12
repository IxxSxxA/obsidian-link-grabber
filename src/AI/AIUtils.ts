// src/AI/AIUtils.ts
import { Plugin } from "obsidian";
import { Logger } from "../utils/Logger";

export function log(...args: any[]) {
    Logger.log("[AIUtils]", ...args);
}

export function getAdapter(plugin: Plugin): any {
    return (plugin.app.vault as any).adapter;
}

export async function adapterExists(plugin: Plugin, relPath: string): Promise<boolean> {
    const adapter = getAdapter(plugin);
    try {
        return await adapter.exists(relPath);
    } catch {
        return false;
    }
}

export async function ensureFolderRecursive(plugin: Plugin, relPath: string): Promise<void> {
    const adapter = getAdapter(plugin);
    if (!adapter.mkdir) return;

    try {
        await adapter.mkdir(relPath, true);
        log("Created folder:", relPath);
    } catch (e) {
        log("ensureFolderRecursive error:", relPath, e);
    }
}

/**
 * 🔥 NUCLEAR RESET
 */
export async function nuclearReset(plugin: Plugin, pluginId: string): Promise<boolean> {
    log("🚨 [nuclearReset] Starting AI reset...");

    const adapter = getAdapter(plugin);
    const aiCachePath = `.obsidian/plugins/${pluginId}/AIcache`;

    try {
        // 1. Verify folders
        if (!await adapter.exists(aiCachePath)) {
            log("📭 [nuclearReset] AIcache folder not found");
            return true;
        }

        log("🗑️ [nuclearReset] Deleting folders:", aiCachePath);

        if (typeof adapter.rmdir === 'function') {
            try {
                await adapter.rmdir(aiCachePath, true); // true = ricorsivo
                log("✅ [nuclearReset] AIcache folder deleted (rmdir recursive)");
                return true;
            } catch (err) {
                log("⚠️ [nuclearReset] rmdir recursive failed. Trying manual method:", err);
            }
        }

        // Method 2: If rmdir not working
        log("🔧 [nuclearReset] Using Method 2 ...");
        await deleteFolderRecursive(adapter, aiCachePath);

        log("🎉 [nuclearReset] Reset completed!");
        return true;

    } catch (error: any) {
        Logger.error("❌ [nuclearReset] Reset incomplete:", error);
        //new Notice(`❌ Reset AI error: ${error.message}`);
        return false;
    }
}

/**
 * Helper
 */
async function deleteFolderRecursive(adapter: any, folderPath: string): Promise<void> {
    try {
        // Prima elimina tutti i file nella cartella
        const files = await adapter.list(folderPath);

        if (files && files.files) {
            for (const file of files.files) {
                log(`🗑️ [nuclearReset] Deleting file: ${file}`);
                await adapter.remove(file);
            }
        }

        if (files && files.folders) {
            for (const subfolder of files.folders) {
                await deleteFolderRecursive(adapter, subfolder);
            }
        }

        await adapter.rmdir(folderPath);
        log(`✅ [nuclearReset] folder deleted: ${folderPath}`);

    } catch (err) {
        log(`⚠️ [nuclearReset] Error on ${folderPath}:`, err);
        throw err;
    }
}


/**
 * 🔄 Soft reset
 */
export async function softReset(plugin: Plugin, pluginId: string): Promise<boolean> {
    log("🔄 [softReset] Reset database embeddings...");

    try {
        const adapter = getAdapter(plugin);
        const dbPath = `.obsidian/plugins/${pluginId}/AIcache/embeddings.json`;

        if (await adapter.exists(dbPath)) {
            await adapter.remove(dbPath);
            log("✅ [softReset] Database embeddings deleted");
        } else {
            log("📭 [softReset] Database not found");
        }

        return true;
    } catch (error: any) {
        Logger.error("❌ [softReset] Error:", error);
        return false;
    }
}
