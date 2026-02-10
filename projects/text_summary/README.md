# Text Summarization

Transform long texts into concise summaries using four different AI algorithms -- both extractive and abstractive methods. Paste text or upload a file, pick a method, and compare results with compression metrics.

## Summarization Methods

| Method | Type | How It Works |
|--------|------|--------------|
| **TextRank** | Extractive | Graph-based sentence ranking (similar to PageRank) |
| **LSA** | Extractive | Latent Semantic Analysis via singular value decomposition |
| **Luhn** | Extractive | Keyword frequency scoring |
| **BART** | Abstractive | `facebook/bart-large-cnn` generates new summary sentences using beam search |

Extractive methods select and return existing sentences from the source. The abstractive method generates entirely new text.

## Metrics

Each summary includes:
- Original and summary word counts
- Compression ratio (percentage reduction)
- Processing time

## Tech Stack

- **Flask** -- API backend (`POST /api/summarize`)
- **Hugging Face Transformers** -- BART model for abstractive summarization
- **Sumy** -- LSA, TextRank, and Luhn extractive algorithms
- **NLTK** -- sentence tokenization
- **PyTorch** -- model inference runtime

## Project Structure

```
text_summary/
├── __init__.py              # Flask blueprint, API route, lazy model loading
├── summarizer.py            # TextSummarizer class with 4 methods
├── templates/
│   └── text_summary/
│       └── index.html       # Dual text-area UI with method selector
└── static/
    └── script.js            # File upload, API calls, metrics display
```

## API

| Method | Path                        | Description |
|--------|-----------------------------|-------------|
| GET    | `/text-summary/`            | Main page |
| POST   | `/text-summary/api/summarize` | Summarize text |

**POST body:**
```json
{
  "text": "...",
  "method": "textrank|lsa|luhn|abstractive",
  "num_sentences": 3,
  "max_length": 130,
  "min_length": 30
}
```

**Response:**
```json
{
  "summary": "...",
  "metrics": {
    "original_words": 500,
    "summary_words": 45,
    "compression_ratio": 9.0,
    "time_taken": 1.23
  }
}
```
