import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

# Import your existing logic from main.py
from main import (
    get_vectorstore, 
    update_vault, 
    handle_summarize_topic, 
    handle_summarize_file,
    handle_flashcards,
    getfile,
    ChatOllama, 
    ChatPromptTemplate, 
    StrOutputParser, 
    RunnablePassthrough
)

app = FastAPI(title="Obsidian Recall API")
from fastapi.middleware.cors import CORSMiddleware

# ... after app = FastAPI() ...

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows Obsidian to connect
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],  # Explicitly add OPTIONS here
    allow_headers=["*"],
)

# --- 1. Global State ---
# Initialize models and DB once on startup to save memory
vectorstore = get_vectorstore()
llm = ChatOllama(model="gemma2:2b", temperature=0.7)

# Standard RAG Chain for general /chat
retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
prompt_template = """
You are a helpful assistant that answers questions based on the following retrieved 
chunks from an Obsidian vault. Use only the provided context. If you don't know, say so.

Context:
{retrieved_chunks}

Question: 
{question}
"""
prompt = ChatPromptTemplate.from_template(prompt_template)
chat_chain = (
    {"retrieved_chunks": retriever, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)

# --- 2. Request Models ---
class ChatRequest(BaseModel):
    message: str

class TopicRequest(BaseModel):
    topic: str

class FileRequest(BaseModel):
    filename: str

# --- 3. API Endpoints ---

@app.get("/sync")
async def sync_vault():
    try:
        
        update_vault(vectorstore)
        return {"status": "success", "message": "Vault synchronized with ChromaDB"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/list")
async def list_documents():
    try:
        all_metadatas = vectorstore.get()['metadatas']
        if not all_metadatas:
            return {"files": []}
        unique_files = sorted(list(set(
            os.path.basename(m['source'])
            for m in all_metadatas
            if 'source' in m
        )))
        return {"files": unique_files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/summarize_file")
async def summarize_file(request: FileRequest):
   
    response = handle_summarize_file(request.filename, vectorstore, llm)
    if not response:
        raise HTTPException(status_code=404, detail="File not found in vault.")
    return {"summary": response}

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        response = chat_chain.invoke(request.message)
        return {"reply": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/summarize")
async def summarize_topic(request: TopicRequest):
    response = handle_summarize_topic(request.topic, vectorstore, llm)
    return {"summary": response}

@app.post("/flashcards")
async def generate_cards(request: FileRequest):
    
    response = handle_flashcards(request.filename, vectorstore, llm)
    return {"flashcards": response}

@app.post("/find-notes")
async def find_notes(request: TopicRequest):
    
    matches = getfile(request.topic, vectorstore)
    
    if not matches:
        return {"message": "No relevant notes found.", "files": []}
    
    return {
        "query": request.topic,
        "files": matches,
        "count": len(matches)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)