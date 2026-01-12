// src/ui/StyleManager.ts

export class StyleManager {
    static addStyles(): void {
        const style = document.createElement('style');
        style.textContent = this.getCSS();
        document.head.appendChild(style);
    }

    private static getCSS(): string {
        return `
            /* ════════════════════════════════════════════════════════════════════
               LINK GRABBER - BASE STYLES
               ════════════════════════════════════════════════════════════════════ */

            /* Level 1 - Main sections (SettingTabManager) */
            .link-grabber-section-main {
                // margin-top: 30px !important;
                // margin-bottom: 15px !important;
                padding-bottom: 8px;
                border-bottom: 2px solid var(--background-modifier-border);
                font-size: 1.2em;
                font-weight: 600;
            }

            /* Level 2 - Sub-sections (AISettingsTab, InlineSettingsTab subsections) */
            .link-grabber-section-sub {
                // margin-top: 20px !important;
                // margin-bottom: 10px !important;
                // padding-bottom: 6px;
                // border-bottom: 1px solid var(--background-modifier-border);
                font-size: 1em;
                font-weight: 500;
            }

            /* Level 3 - Minor sections (optional) */
            .link-grabber-section-minor {
                // margin-top: 15px !important;
                // margin-bottom: 8px !important;
                font-size: 0.9em;
                font-weight: 600;
                color: var(--text-muted);
            }
            
            .link-grabber-suggestion {
                padding: 8px 12px;
                border-bottom: 1px solid var(--background-modifier-border);
                cursor: pointer;
                transition: background-color 0.1s ease;
            }
            
            .link-grabber-suggestion:hover {
                background-color: var(--background-modifier-hover);
            }
            
            .link-grabber-path {
                font-size: 11px;
                color: var(--text-muted);
                margin-bottom: 4px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .link-grabber-path::before {
                content: "📄";
                font-size: 10px;
                opacity: 0.7;
            }
            
            .link-grabber-context {
                font-size: 12px;
                color: var(--text-normal);
                line-height: 1.4;
            }
            
            .link-grabber-match {
                background-color: var(--text-highlight-bg);
                color: var(--text-normal);
                font-weight: bold;
                padding: 1px 2px;
                border-radius: 3px;
            }
            
            /* ════════════════════════════════════════════════════════════════════
               SETTINGS PAGE STYLES
               ════════════════════════════════════════════════════════════════════ */
            
            
            .link-grabber-stats {
                font-family: monospace;
                font-size: 0.85em;
            }
            
            .link-grabber-stats h5 {
                margin-top: 0;
                margin-bottom: 8px;
                color: var(--text-accent);
            }
            
            .link-grabber-stats ul {
                margin: 0;
                padding-left: 20px;
            }
            
            .link-grabber-stats li {
                margin: 2px 0;
            }

            /* ════════════════════════════════════════════════════════════════════
               AI CHECK BUTTONS PENDING
               ════════════════════════════════════════════════════════════════════ */
            // .setting-pending .setting-item-control button {
            //     opacity: 0.7;
            //     cursor: not-allowed;
            // }

            // .setting-pending .setting-item-description {
            //     color: var(--text-muted);
            //     font-style: italic;
            // }

            /* ════════════════════════════════════════════════════════════════════
               AI DOWNLOAD PROGRESS
               ════════════════════════════════════════════════════════════════════ */

            .ai-download-progress {
                padding: 12px;
                background: var(--background-secondary);
                border-radius: 6px;
                margin: 12px 0;
            }

            .ai-download-file {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px;
                background: var(--background-primary);
                border-radius: 4px;
                margin: 4px 0;
            }

            .ai-download-file-name {
                font-size: 0.85em;
                color: var(--text-muted);
            }

            .ai-download-file-size {
                font-size: 0.8em;
                color: var(--text-faint);
            }

            .ai-download-warning {
                padding: 10px;
                background: var(--background-warning);
                border-radius: 4px;
                margin: 12px 0;
                color: var(--text-warning);
                font-size: 0.9em;
            }

            /* ════════════════════════════════════════════════════════════════════
               AI SIDEBAR STYLES
               ════════════════════════════════════════════════════════════════════ */

            .ai-sidebar-container {
                padding: 16px;
                height: 100%;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .ai-sidebar-header {
                border-bottom: 2px solid var(--background-modifier-border);
                padding-bottom: 12px;
                margin-bottom: 8px;
            }

            .ai-sidebar-title {
                margin: 0 0 8px 0;
                font-size: 1.2em;
                color: var(--text-normal);
            }

            .ai-sidebar-status {
                margin-bottom: 8px;
            }

            .ai-status-text {
                font-size: 0.9em;
                color: var(--text-muted);
            }

            .ai-sidebar-stats {
                color: var(--text-muted);
                font-size: 0.85em;
            }

            .ai-suggestions-container {
                flex: 1;
                overflow-y: auto;
            }

            .ai-placeholder {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 32px 16px;
                text-align: center;
                color: var(--text-muted);
                font-style: italic;
            }

            /* ════════════════════════════════════════════════════════════════════
               AI SUGGESTIONS LIST
               ════════════════════════════════════════════════════════════════════ */

            .ai-suggestions-header h4 {
                margin: 0 0 12px 0;
                font-size: 1em;
                color: var(--text-muted);
            }

            .ai-main-header {
                margin-bottom: 4px !important;
            }

            .ai-filter-hint {
                display: block;
                color: var(--text-faint);
                font-size: 0.85em;
                margin-top: 4px;
            }

            .ai-suggestions-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            /* ════════════════════════════════════════════════════════════════════
               SUGGESTION ITEM WITH SOURCE BADGE
               ════════════════════════════════════════════════════════════════════ */

            .ai-suggestion-item {
                padding: 12px;
                background: var(--background-secondary);
                border-radius: 8px;
                border: 1px solid var(--background-modifier-border);
                transition: all 0.2s ease;
                cursor: default;
                animation: fadeIn 0.4s ease-out backwards;
            }

            .ai-suggestion-item:nth-child(1) { animation-delay: 0.05s; }
            .ai-suggestion-item:nth-child(2) { animation-delay: 0.1s; }
            .ai-suggestion-item:nth-child(3) { animation-delay: 0.15s; }
            .ai-suggestion-item:nth-child(4) { animation-delay: 0.2s; }
            .ai-suggestion-item:nth-child(5) { animation-delay: 0.25s; }
            .ai-suggestion-item:nth-child(6) { animation-delay: 0.3s; }
            .ai-suggestion-item:nth-child(7) { animation-delay: 0.35s; }
            .ai-suggestion-item:nth-child(8) { animation-delay: 0.4s; }
            .ai-suggestion-item:nth-child(9) { animation-delay: 0.45s; }
            .ai-suggestion-item:nth-child(10) { animation-delay: 0.5s; }

            @keyframes fadeIn {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .ai-suggestion-item:hover {
                background: var(--background-secondary-alt);
                border-color: var(--interactive-accent);
            }

            .ai-suggestion-content {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            /* ✅ SOURCE BADGE - NEW */
            .ai-suggestion-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 4px;
            }

            .ai-suggestion-title-text {
                font-weight: 600;
                color: var(--text-normal);
                font-size: 0.95em;
                flex: 1;
                user-select: none;
            }

            .ai-source-badge {
                display: inline-flex;
                align-items: center;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 0.7em;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                flex-shrink: 0;
            }

            .ai-source-badge.source-title {
                background: linear-gradient(135deg, #3b82f6, #60a5fa);
                color: white;
            }

            .ai-source-badge.source-heading {
                background: linear-gradient(135deg, #8b5cf6, #a78bfa);
                color: white;
            }

            .ai-source-badge.source-content {
                background: linear-gradient(135deg, #10b981, #34d399);
                color: white;
            }

            /* ════════════════════════════════════════════════════════════════════
               SCORE BAR
               ════════════════════════════════════════════════════════════════════ */

            .ai-suggestion-score {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-top: 4px;
            }

            .ai-score-bar {
                height: 4px;
                border-radius: 2px;
                transition: width 0.3s ease;
            }

            .ai-score-bar.high {
                background: linear-gradient(90deg, #10b981, #34d399);
            }

            .ai-score-bar.medium {
                background: linear-gradient(90deg, #f59e0b, #fbbf24);
            }

            .ai-score-bar.low {
                background: linear-gradient(90deg, #6b7280, #9ca3af);
            }

            .ai-score-text {
                font-size: 0.75em;
                color: var(--text-muted);
                white-space: nowrap;
            }

            /* ════════════════════════════════════════════════════════════════════
               EXCERPT & ACTIONS
               ════════════════════════════════════════════════════════════════════ */

            .ai-suggestion-excerpt {
                color: var(--text-muted);
                font-size: 0.85em;
                line-height: 1.4;
            }

            .ai-suggestion-actions {
                display: flex;
                gap: 6px;
                margin-top: 8px;
            }

            .ai-action-btn {
                flex: 1;
                padding: 6px 12px;
                font-size: 0.85em;
                background: var(--interactive-normal);
                border: 1px solid var(--background-modifier-border);
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s ease;
                font-weight: 500;
            }

            .ai-action-btn:hover {
                background: var(--interactive-hover);
                border-color: var(--interactive-accent);
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            .ai-action-btn:active {
                transform: translateY(0);
                box-shadow: none;
            }

            .ai-btn-insert:hover {
                border-color: #10b981;
            }

            .ai-btn-open:hover {
                border-color: #3b82f6;
            }

            /* ════════════════════════════════════════════════════════════════════
               SIDEBAR FOOTER
               ════════════════════════════════════════════════════════════════════ */

            .ai-sidebar-footer {
                display: flex;
                gap: 8px;
                padding-top: 12px;
                border-top: 1px solid var(--background-modifier-border);
                margin-top: auto;
            }

            .ai-sidebar-footer button {
                flex: 1;
                padding: 8px;
                font-size: 0.9em;
            }

            /* ════════════════════════════════════════════════════════════════════
               AI ACTIVATION PANEL
               ════════════════════════════════════════════════════════════════════ */

            .ai-quick-actions {
                padding: 16px;
                background: var(--background-secondary);
                border-radius: 8px;
                margin-bottom: 16px;
            }

            .ai-button-container {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-top: 8px;
            }

            .ai-button-container button {
                flex: 1;
                min-width: 120px;
            }

            .ai-divider {
                border: none;
                border-top: 1px solid var(--background-modifier-border);
                margin: 16px 0;
            }

            .ai-status-section,
            .ai-init-section,
            .ai-model-section,
            .ai-debug-section,
            .ai-action-section {
                padding: 16px;
                border-radius: 8px;
                background: var(--background-primary-alt);
                margin-bottom: 16px;
            }

            .ai-status-display {
                padding: 12px;
                background: var(--background-secondary);
                border-radius: 6px;
                margin-bottom: 8px;
            }

            .ai-status-success {
                color: var(--text-success);
            }

            .ai-status-warning {
                color: var(--text-warning);
            }

            .ai-status-error {
                color: var(--text-error);
            }

            .ai-status-disabled {
                color: var(--text-muted);
            }

            .ai-debug-info {
                padding: 8px;
                background: var(--background-secondary);
                border-radius: 4px;
                font-size: 0.85em;
            }

            .ai-debug-details {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .ai-debug-details div {
                color: var(--text-muted);
            }

            /* ════════════════════════════════════════════════════════════════════
               AI MODAL - BASE STYLES
               ════════════════════════════════════════════════════════════════════ */
            
            .ai-modal-title {
                color: var(--text-error);
                margin-bottom: 1em;
            }

            .ai-modal-message {
                white-space: pre-line;
                line-height: 1.5;
                margin-bottom: 2em;
            }

            .ai-modal-button-container {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 1.5em;
            }

            /* ════════════════════════════════════════════════════════════════════
               SETTINGS PAGE - 3 DB STATS DISPLAY
               ════════════════════════════════════════════════════════════════════ */

         
            .setting-disabled {
                opacity: 0.5;
                pointer-events: none;
            }

            /* ✅ 3 DB STATS DISPLAY - NEW */
            .ai-status-display-3db {
                padding: 16px;
                background: var(--background-secondary);
                border-radius: 8px;
                margin: 16px 0;
            }

            .ai-stats-header {
                margin: 0 0 16px 0;
                font-size: 1.1em;
                color: var(--text-normal);
                text-align: center;
            }

            .ai-stats-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                margin-bottom: 16px;
            }

            .ai-stat-card {
                padding: 16px;
                background: var(--background-primary);
                border-radius: 8px;
                border: 2px solid var(--background-modifier-border);
                text-align: center;
                transition: all 0.2s ease;
            }

            .ai-stat-card:hover {
                border-color: var(--interactive-accent);
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            }

            .ai-stat-label {
                font-size: 0.85em;
                color: var(--text-muted);
                margin-bottom: 8px;
                font-weight: 500;
            }

            .ai-stat-value {
                font-size: 2em;
                font-weight: 700;
                color: var(--text-normal);
                margin-bottom: 8px;
            }

            .ai-stat-status {
                font-size: 0.75em;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .ai-stats-footer {
                padding-top: 12px;
                border-top: 1px solid var(--background-modifier-border);
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .ai-stats-footer-text {
                display: block;
                color: var(--text-muted);
                font-size: 0.85em;
            }

            .ai-indexing-controls {
                padding: 12px;
                background: var(--background-warning);
                border-radius: 6px;
                margin: 12px 0;
            }

            /* ════════════════════════════════════════════════════════════════════
               PROGRESS BARS
               ════════════════════════════════════════════════════════════════════ */

            .ai-progress-container {
                padding: 16px;
                background: var(--background-secondary);
                border-radius: 8px;
                margin: 12px 0;
            }

            .ai-progress-text {
                margin: 0 0 8px 0;
                font-size: 0.9em;
                color: var(--text-muted);
            }

            .ai-progress-bar-container {
                height: 8px;
                background: var(--background-modifier-border);
                border-radius: 4px;
                overflow: hidden;
            }

            .ai-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #10b981, #34d399);
                transition: width 0.3s ease;
            }

            .ai-error-text {
                color: var(--text-error);
                margin: 0;
            }

       
        `;
    }
}