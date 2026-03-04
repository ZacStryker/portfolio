RAG Financial Document Q&A System - Project Specification
Project Context
This is a GenAI portfolio project for an ML Engineer portfolio (zacstryker.com) transitioning from classical ML to GenAI applications. The goal is to demonstrate RAG (Retrieval Augmented Generation) capabilities, modern LLM orchestration, and production-ready architecture.
Target audience: Recruiters for Senior ML Engineer / GenAI Engineer roles ($140-180K range)
Portfolio context: Already have 7 classical ML projects (clustering, classification, regression, NLP, computer vision). This adds GenAI/LLM capabilities to show skillset expansion.

Project Goals
Primary Objectives:

Demonstrate RAG architecture - Show understanding of retrieval augmented generation
Production-quality code - Not a tutorial project, but deployment-ready
Clear business value - Solve real problem with measurable impact
Interactive demo - Live, working application recruiters can test
Professional documentation - Comprehensive README, tooltips, explanations

Success Criteria:

✅ Deploy to 2GB Linode server (works within memory constraints)
✅ Handle 20MB+ PDF uploads without issues
✅ Process and answer questions across multiple documents
✅ Response time < 10 seconds per query
✅ Source citation with confidence/relevance scores
✅ Professional UI with clear UX
✅ Complete documentation for portfolio presentation


Technical Constraints
Infrastructure:

Server: 2GB RAM Linode (Ubuntu 22.04)
Budget: ~$20/mo total (Linode + API costs)
No local LLMs - Must use external APIs (OpenAI/Anthropic)
Expected usage: Portfolio demo (low traffic, occasional recruiter testing)

Memory Budget:

Base system: ~700MB
Target application: ~500-800MB
Must handle 20MB PDFs without memory issues
Support 20-30 documents in system simultaneously

Cost Constraints:

Embedding cost: ~$0.004 per 20MB PDF
Query cost: ~$0.0008 per query
Target: < $10/mo in API costs for demo usage


Architecture Overview
High-Level Flow:
User uploads PDF
  ↓
Backend extracts text + chunks (1000 tokens, 100 overlap)
  ↓
Generate embeddings via OpenAI API
  ↓
Store in ChromaDB vector database
  ↓
User asks question
  ↓
Semantic search retrieves relevant chunks (top-k=5)
  ↓
Send chunks + question to LLM (GPT-4o-mini or Claude)
  ↓
Return answer with source citations
System Architecture:
┌─────────────────────────────────────────┐
│  Frontend (React)                       │
│  - PDF upload interface                 │
│  - Chat interface                       │
│  - Source citation display              │
│  - Document management                  │
└─────────────┬───────────────────────────┘
              │ HTTP/REST
┌─────────────▼───────────────────────────┐
│  Backend (FastAPI)                      │
│  - PDF processing                       │
│  - Text chunking                        │
│  - Embedding orchestration              │
│  - Query routing                        │
│  - Response generation                  │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
┌───▼────────┐   ┌─────▼──────────┐
│ ChromaDB   │   │ OpenAI/        │
│ (Vector    │   │ Anthropic API  │
│ Storage)   │   │ (External)     │
└────────────┘   └────────────────┘

Tech Stack
Backend:
FastAPI (0.104+)         - Web framework
LangChain (0.1+)         - LLM orchestration
ChromaDB (0.4+)          - Vector database
PyPDF2 or pypdf          - PDF text extraction
OpenAI Python SDK        - API client
Pydantic                 - Data validation
python-multipart         - File upload handling
Frontend:
React 18+                - UI framework
TypeScript               - Type safety
TailwindCSS              - Styling
React Query              - Data fetching
Axios                    - HTTP client
React Dropzone           - File upload UX
Infrastructure:
Docker + Docker Compose  - Containerization
NGINX                    - Reverse proxy
Ubuntu 22.04            - OS
External APIs:
OpenAI API:
  - text-embedding-3-small (embeddings)
  - gpt-4o-mini (LLM, cost-effective)
  OR
Anthropic API:
  - Claude 3 Haiku (LLM alternative)

Core Features (MVP)
1. Document Upload & Processing

File upload: Support PDF files up to 50MB
Text extraction: Extract text from PDFs (handle multi-page, complex layouts)
Chunking strategy:

Chunk size: 1000 tokens
Overlap: 100 tokens
Preserve context across chunks


Embedding generation: Use OpenAI text-embedding-3-small
Storage: Persist in ChromaDB with metadata (filename, page number, chunk index)
Progress indicator: Show upload/processing progress to user

2. Semantic Search & Retrieval

Query processing: Accept natural language questions
Similarity search: Use cosine similarity in vector space
Top-k retrieval: Return 5 most relevant chunks (configurable)
Relevance scoring: Display similarity scores to user
Multi-document search: Search across all uploaded documents

3. Answer Generation

Context assembly: Combine retrieved chunks into LLM context
Prompt engineering:

System prompt: "You are a financial document analyst..."
Include: retrieved chunks + user question
Instruction: "Answer based only on provided context. Cite sources."


LLM call: Use GPT-4o-mini or Claude 3 Haiku
Response parsing: Extract answer and identify cited sources
Streaming (nice-to-have): Stream response tokens for better UX

4. Source Citation

Chunk references: Link each part of answer to source chunks
Display: Show which chunks were used, with page numbers
Confidence scores: Display relevance scores for transparency
Jump to source: Allow user to see full context of cited chunk

5. Document Management

List documents: Show all uploaded documents
Document metadata: Display filename, size, upload date, chunk count
Delete documents: Remove documents from system (free memory)
Document preview: Show first few chunks of document

6. User Interface

Clean, modern design: Professional appearance
Chat interface: Familiar Q&A format
File upload area: Drag-and-drop support
Source panel: Side panel showing retrieved chunks
Loading states: Clear feedback during processing
Error handling: User-friendly error messages


Advanced Features (Post-MVP)
7. Query Enhancement

Query expansion: Automatically improve vague queries
Multi-query retrieval: Generate multiple search queries for better recall
Re-ranking: Re-score retrieved chunks for better precision

8. Evaluation & Metrics

Answer quality metrics:

Faithfulness (is answer grounded in sources?)
Relevance (does it answer the question?)


Retrieval metrics:

Precision@k
Recall@k
Mean reciprocal rank


Cost tracking: Display cost per query, total costs
Performance dashboard: Show system stats

9. Conversation History

Multi-turn conversations: Maintain context across questions
Follow-up questions: "Tell me more about that..."
Conversation branching: Multiple conversation threads

10. Advanced RAG Techniques

Hybrid search: Combine semantic (vector) + keyword (BM25) search
Document metadata filtering: Search specific documents or date ranges
Chunk windowing: Retrieve surrounding chunks for more context
Summary generation: Auto-generate document summaries on upload


Implementation Guidelines
PDF Processing Best Practices:
python# Stream processing to avoid memory spikes
def process_pdf_safely(pdf_path: str) -> str:
    texts = []
    with open(pdf_path, 'rb') as f:
        reader = PyPDF2.PdfReader(f)
        for page_num, page in enumerate(reader.pages):
            text = page.extract_text()
            texts.append({
                'text': text,
                'page': page_num + 1
            })
    return texts
Chunking Strategy:
python# Use LangChain's RecursiveCharacterTextSplitter
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=100,
    length_function=len,
    separators=["\n\n", "\n", ". ", " ", ""]
)
chunks = splitter.split_text(document_text)
Prompt Template:
pythonSYSTEM_PROMPT = """You are a financial document analyst assistant. 
Answer questions based ONLY on the provided context from uploaded documents.

Rules:
1. If the answer is not in the context, say "I cannot find this information in the uploaded documents."
2. Always cite which document and page your answer comes from.
3. Be precise and factual. Do not speculate or add information not in the context.
4. If multiple documents contain relevant info, synthesize across them.

Context:
{context}

Question: {question}

Answer:"""
Memory Management:
python# Limit concurrent uploads
from asyncio import Semaphore
upload_semaphore = Semaphore(2)

@app.post("/upload")
async def upload(file: UploadFile):
    async with upload_semaphore:
        return await process_pdf(file)
Error Handling:
python# Graceful degradation
try:
    answer = await llm.generate(prompt)
except RateLimitError:
    return {"error": "API rate limit reached. Please try again in a moment."}
except Exception as e:
    logger.error(f"LLM generation failed: {e}")
    return {"error": "Failed to generate answer. Please try again."}
```

---

## API Endpoints (FastAPI)

### Document Management:
```
POST /api/documents/upload
- Upload PDF file
- Returns: document_id, status, chunk_count

GET /api/documents/
- List all documents
- Returns: [{id, filename, size, upload_date, chunk_count}]

DELETE /api/documents/{doc_id}
- Delete document and its embeddings
- Returns: success status

GET /api/documents/{doc_id}/chunks
- Get chunks for specific document
- Returns: [{chunk_id, text, page_number, embedding_id}]
```

### Query:
```
POST /api/query
- Body: {question: str, document_ids?: str[]}
- Returns: {answer, sources: [{doc_id, chunk_text, page, score}], cost}

POST /api/query/stream (optional)
- Stream response tokens
- Returns: Server-Sent Events stream
```

### System:
```
GET /api/health
- System health check
- Returns: {status, memory_usage, document_count, vector_count}

GET /api/stats
- Usage statistics
- Returns: {total_queries, total_documents, total_cost, avg_response_time}
```

---

## Frontend Components

### Key React Components:
```
<App />
  ├─ <Header />
  ├─ <DocumentUpload />
  │   └─ <DropZone />
  ├─ <DocumentList />
  │   └─ <DocumentCard />
  ├─ <ChatInterface />
  │   ├─ <MessageList />
  │   │   └─ <Message />
  │   └─ <QueryInput />
  └─ <SourcePanel />
      └─ <SourceChunk />
UI/UX Requirements:

Responsive: Works on desktop, tablet, mobile
Loading states: Skeleton loaders, spinners, progress bars
Empty states: Clear messaging when no documents uploaded
Error boundaries: Catch and display React errors gracefully
Tooltips: Explain features (e.g., "What is relevance score?")
Accessibility: Keyboard navigation, ARIA labels, semantic HTML


Deployment Configuration
Docker Compose:
yamlversion: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./data:/app/data
    mem_limit: 512m
    
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    mem_limit: 256m
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    mem_limit: 128m
Environment Variables:
bash# .env
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small
LLM_MODEL=gpt-4o-mini
MAX_FILE_SIZE_MB=50
MAX_DOCUMENTS=30
MAX_CHUNKS_PER_DOCUMENT=500
VECTOR_DB_PATH=/app/data/chromadb
NGINX Configuration:
nginxserver {
    listen 80;
    server_name zacstryker.com;
    
    location /api/ {
        proxy_pass http://backend:8000/;
    }
    
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Project Structure
```
rag-financial-qa/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app
│   │   ├── config.py            # Settings
│   │   ├── models.py            # Pydantic models
│   │   ├── routers/
│   │   │   ├── documents.py     # Document endpoints
│   │   │   └── query.py         # Query endpoints
│   │   ├── services/
│   │   │   ├── pdf_processor.py # PDF handling
│   │   │   ├── embeddings.py    # Embedding generation
│   │   │   ├── vectorstore.py   # ChromaDB interaction
│   │   │   └── llm.py           # LLM calls
│   │   └── utils/
│   │       ├── chunking.py      # Text chunking
│   │       └── prompts.py       # Prompt templates
│   ├── requirements.txt
│   ├── Dockerfile
│   └── pytest.ini               # Tests
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DocumentUpload.tsx
│   │   │   ├── DocumentList.tsx
│   │   │   ├── ChatInterface.tsx
│   │   │   └── SourcePanel.tsx
│   │   ├── hooks/
│   │   │   └── useQuery.ts
│   │   ├── services/
│   │   │   └── api.ts
│   │   └── App.tsx
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md                    # Project documentation

Success Metrics & Evaluation
Performance Metrics:

Response time: < 10 seconds for 90th percentile
Memory usage: Stay under 1.5GB (75% of available)
Retrieval accuracy: Manual evaluation on 20 test questions
Answer quality: Faithfulness and relevance scores

Cost Metrics:

Per document: < $0.01 to process
Per query: < $0.01 including retrieval + generation
Monthly total: < $10 for demo usage

User Experience:

Upload success rate: > 95%
Clear error messages: For all failure modes
Source transparency: Always show which chunks were used
Professional appearance: Matches portfolio quality


Testing Requirements
Unit Tests:

PDF text extraction accuracy
Chunking with various documents
Embedding generation mocking
Retrieval precision/recall

Integration Tests:

End-to-end: upload → query → answer
Multi-document queries
Edge cases: empty PDFs, huge PDFs, corrupted files

Manual Testing:

20 test questions across multiple documents
Evaluate answer quality, source citations, response time
Document results in README


Documentation Requirements
README.md Should Include:

Project Overview

What it does, why it's valuable
Demo link + screenshots


Technical Architecture

System diagram
Tech stack explanation
Design decisions (why ChromaDB? why GPT-4o-mini?)


Features

Core capabilities
Screenshots/GIFs of key features


Setup Instructions

Prerequisites
Installation steps
Environment configuration


Usage Guide

How to upload documents
How to query
Example queries


Performance & Evaluation

Metrics and results
Example Q&A pairs with quality assessment
Cost analysis


Implementation Details

Chunking strategy
Prompt engineering approach
Retrieval methodology



Code Documentation:

Docstrings for all functions
Type hints throughout
Inline comments for complex logic
API endpoint documentation (automatic via FastAPI)


Timeline & Milestones
Week 1: Core RAG Pipeline (MVP)
Days 1-2:

Set up project structure
FastAPI backend skeleton
PDF upload endpoint + text extraction
Basic chunking implementation

Days 3-4:

OpenAI embedding integration
ChromaDB setup and storage
Retrieval endpoint (semantic search)

Days 5-7:

LLM integration for answer generation
Prompt engineering
Source citation logic
Basic React frontend

Week 2: Polish & Production Features
Days 8-9:

Professional UI design
Multiple document support
Document management (list, delete)
Source panel with citations

Days 10-11:

Error handling and edge cases
Memory optimization
Cost tracking
Performance monitoring

Days 12-14:

Deployment to Linode
Testing with real documents
Documentation (comprehensive README)
Evaluation and metrics



Additional Context for Builder
Designer Notes:

This is for a portfolio/demo, not production at scale
Prioritize demonstrating skills over handling edge cases
Documentation is as important as code—recruiters will read README
Live demo must work flawlessly—test thoroughly
Balance sophistication (showing advanced techniques) with clarity (explaining what you did)

Common Pitfalls to Avoid:

❌ Over-engineering (don't build for 1M users)
❌ Under-documenting (don't assume recruiter knows RAG)
❌ Poor error handling (demo must not crash)
❌ Ugly UI (first impressions matter)
❌ Missing source citations (this is critical for RAG)
❌ No evaluation (must show it works well)

Key Success Factors:

✅ Works reliably (99% uptime in demo)
✅ Looks professional (matches portfolio quality)
✅ Well-documented (comprehensive README)
✅ Shows understanding (design decisions explained)
✅ Has citations (proves answer grounding)
✅ Includes metrics (cost, performance, quality)


Questions to Consider During Implementation

Chunking: Fixed-size vs semantic chunking? Token-based vs character-based?
Retrieval: Top-k=5 sufficient? Need re-ranking?
Prompting: Zero-shot vs few-shot examples?
UI: Chat interface vs Q&A panel? Show all sources or just citations?
Deployment: Docker Compose vs separate deployments?
Storage: ChromaDB persist_directory vs in-memory with backup?


Final Notes
This project specification is comprehensive but should be treated as a guideline, not a rigid prescription. The builder should:

Make smart trade-offs based on time constraints
Prioritize MVP features first
Add advanced features only if time permits
Focus on making something that works well and looks professional
Remember: this is a portfolio piece, not a production system



End of specification. Begin building! 🚀