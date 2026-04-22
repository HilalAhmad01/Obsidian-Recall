import { ItemView, Plugin, WorkspaceLeaf, Notice, MarkdownRenderer } from 'obsidian';

const VIEW_TYPE_COPILOT = "copilot-view";

class CopilotView extends ItemView {
    constructor(leaf: WorkspaceLeaf) { super(leaf); }
    getViewType() { return VIEW_TYPE_COPILOT; }
    getDisplayText() { return "Vault Copilot"; }
    getIcon() { return "bot"; }

    async onOpen() {
        const container = this.contentEl;
        container.empty();
        container.addClass('copilot-window');

   
        const header = container.createDiv({ cls: 'copilot-header' });
        header.createEl('h3', { text: 'Copilot' });
        const syncBtn = header.createEl('button', { text: '🔄 Sync', cls: 'mod-cta' });
        
  
        const chatLog = container.createDiv({ cls: 'copilot-chat-log' });

  
        const inputArea = container.createDiv({ cls: 'copilot-input-area' });
        
        const hints = inputArea.createDiv({ cls: 'copilot-hints' });
        ['/list', '/summarize', '/flashcards'].forEach(cmd => {
            const span = hints.createEl('span', { text: cmd });
            span.onclick = () => { inputField.value = cmd + ' '; inputField.focus(); };
        });

        const inputRow = inputArea.createDiv({ cls: 'copilot-input-row' });
        const inputField = inputRow.createEl('input', { 
            placeholder: 'Ask or use a / command...',
            type: 'text' 
        });
        const sendBtn = inputRow.createEl('button', { text: 'Send' });

        const handleSend = async () => {
            const query = inputField.value.trim();
            if (!query) return;

            inputField.value = '';
            this.appendMsg(chatLog, 'User', query);
            const loadingMsg = this.appendMsg(chatLog, 'AI', 'Thinking...');

            try {
                const cmd = this.routeCommand(query);
                
                const options: RequestInit = {
                    method: cmd.method,
                    headers: { 'Content-Type': 'application/json' }
                };

                if (cmd.method === 'POST' && cmd.payload) {
                    options.body = JSON.stringify(cmd.payload);
                }

                const response = await fetch(`http://127.0.0.1:8000${cmd.url}`, options);
                const data = await response.json();

                let finaltext = "";
                if (data.files && Array.isArray(data.files)) {
                   
                    if (data.files.length === 0) {
                        finaltext = "> [!INFO] No documents found in indexed path.";
                    } else {
                        finaltext = "### Indexed Documents\n" + data.files.map((f: string) => `- ${f}`).join("\n");
                    }
                } else {
                    finaltext = data.reply || data.summary || data.flashcards || data.message || "Done!";
                }

          
                loadingMsg.empty(); 
                await MarkdownRenderer.renderMarkdown(finaltext, loadingMsg, "", this);
                chatLog.scrollTop = chatLog.scrollHeight; 

            } catch (err) {
                loadingMsg.empty();
                await MarkdownRenderer.renderMarkdown("> [!ERROR] Connection Failed\n> Is `server.py` running?", loadingMsg, "", this);
                console.error(err);
            }
        };

        syncBtn.onclick = async () => {
            new Notice("Syncing Vault...");
            try {
                const res = await fetch("http://127.0.0.1:8000/sync");
                const data = await res.json();
                new Notice(data.message);
                this.appendMsg(chatLog, 'AI', `Sync Complete: ${data.message}`);
            } catch (e) {
                new Notice("Sync failed. Check server.");
            }
        };

        sendBtn.onclick = handleSend;
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSend();
        });
    }

    routeCommand(input: string) {
        const query = input.trim().toLowerCase();

        if (query === '/list') {
            return { url: '/list', method: 'GET', payload: null }; 
        }

        if (query.startsWith('/summarize ')) {
            return { 
                url: '/summarize', 
                method: 'POST', 
                payload: { topic: input.slice(11).trim() } 
            };
        }

        if (query.startsWith('/flashcards ')) {
            return { 
                url: '/flashcards', 
                method: 'POST', 
                payload: { filename: input.slice(12).trim() } 
            };
        }

        return { 
            url: '/chat', 
            method: 'POST', 
            payload: { message: input } 
        };
    }

    appendMsg(container: HTMLElement, sender: string, text: string) {
        const role = sender.toLowerCase();
        const msgDiv = container.createDiv({ cls: `copilot-msg ${role}-msg` });
        
    
        MarkdownRenderer.renderMarkdown(text, msgDiv, "", this);
        
        container.scrollTop = container.scrollHeight;
        return msgDiv;
    }
}

export default class CopilotPlugin extends Plugin {
    async onload() {
        this.registerView(VIEW_TYPE_COPILOT, (leaf) => new CopilotView(leaf));
        this.addRibbonIcon("bot", "Open Copilot", () => this.activateView());
    }

    async activateView() {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_COPILOT)[0];

        if (!leaf) {
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                leaf = rightLeaf;
                await leaf.setViewState({ type: VIEW_TYPE_COPILOT, active: true });
            }
        }

        if (leaf) workspace.revealLeaf(leaf);
    }
}