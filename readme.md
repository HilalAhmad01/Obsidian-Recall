# Obsidian Recall 🧠
An AI-powered Copilot for local Obsidian vaults, built for high-speed retrieval and exam preparation.

## 🚀 Features
- **Incremental Loading:** Only indexes new notes to save on API credits and CPU.
- **Flashcard Generation:** Automatically creates study questions from technical notes.
- **Topic Summarization:** Uses RAG to synthesize information across multiple files.

## 🛠️ Tech Stack
- **LLM:** Gemma 2B (via Ollama)
- **Embeddings:** Cohere v4
- **Vector Database:** ChromaDB
- **Framework:** LangChain

## 🖥️ Setup
1. Clone the repo: `git clone https://github.com/HilalAhmad01/Obsidian-Recall.git`
2. Install dependencies: `pip install -r requirements.txt`
3. Add your `.env` file with `COHERE_API_KEY`.
4. Run: `python main.py`