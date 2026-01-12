// src/AI/AIModal.ts (nuovo file)
import { App, Modal } from 'obsidian';

export class AIConfirmModal extends Modal {
    constructor(
        app: App,
        private title: string,
        private message: string,
        private confirmText: string = 'Confirm',
        private cancelText: string = 'Cancel',
        private onConfirm: () => Promise<void> | void,
        private onCancel?: () => Promise<void> | void,
        // 🔥 Callback for modal close
        private onAnyClose?: () => void
    ) {
        super(app);
    }
    onOpen() {
        const { contentEl } = this;

        // Title
        contentEl.createEl('h2', {
            text: this.title,
            cls: 'ai-modal-title'
        });

        // Message
        contentEl.createEl('p', {
            text: this.message,
            cls: 'ai-modal-message'
        });

        // Buttons
        const buttonContainer = contentEl.createDiv({
            cls: 'ai-modal-button-container'
        });

        // Button Cancel
        const cancelBtn = buttonContainer.createEl('button', {
            text: this.cancelText,
            cls: 'mod-warning'
        });

        cancelBtn.addEventListener('click', async () => {
            if (this.onCancel) await this.onCancel();
            this.close();
        });

        // Button Confirm
        const confirmBtn = buttonContainer.createEl('button', {
            text: this.confirmText,
            cls: 'mod-cta'
        });

        confirmBtn.addEventListener('click', async () => {
            await this.onConfirm();
            this.close();
        });

        // 🔥 FOCUS DEFAULT
        setTimeout(() => cancelBtn.focus(), 10);

        // 🔥 ENTER/ESC shortcuts
        this.scope.register([], 'Enter', () => confirmBtn.click());
        this.scope.register([], 'Escape', () => cancelBtn.click());
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();

        // 🔥 Click outside window
        if (this.onAnyClose) {
            this.onAnyClose();
        }
    }
}

// Helper function
export async function showAIConfirm(
    app: App,
    title: string,
    message: string,
    confirmText?: string,
    cancelText?: string
): Promise<boolean> {
    return new Promise((resolve) => {
        let userConfirmed = false;
        let userCancelled = false;

        new AIConfirmModal(
            app,
            title,
            message,
            confirmText,
            cancelText,
            () => {
                userConfirmed = true;
                resolve(true);
            },
            () => {
                userCancelled = true;
                resolve(false);
            },
            () => {
                // 🔥 Click outside window
                if (!userConfirmed && !userCancelled) {
                    resolve(false);
                }
            }
        ).open();
    });
}