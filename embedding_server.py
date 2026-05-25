# ============================================================
# embedding_server.py
# Local FastAPI server for sentence-transformer embeddings
# Runs on http://localhost:8000
# ============================================================
# INSTALL (run once):
#   pip install sentence-transformers fastapi uvicorn
#
# RUN:
#   python embedding_server.py
# ============================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import uvicorn

app = FastAPI()

# Allow your Vite dev server to call this
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model once at startup — cached after first run (~25MB)
print("Loading model...")
model = SentenceTransformer("all-MiniLM-L6-v2")
print("Model ready!")

class EmbedRequest(BaseModel):
    text: str

@app.post("/embed")
def embed(req: EmbedRequest):
    vector = model.encode(req.text[:512], normalize_embeddings=True).tolist()
    return { "embedding": vector, "dims": len(vector) }

@app.get("/health")
def health():
    return { "status": "ok", "model": "all-MiniLM-L6-v2", "dims": 384 }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)