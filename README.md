# Portfolio Site

A fullstack portfolio and interactive machine learning showcase built with Flask. Features five self-contained project demos spanning computer vision, NLP, unsupervised learning, data visualization, and music data exploration -- plus a blog, resume, and contact pages.

## Projects

### Machine Learning

| Project | Description | Runs On |
|---------|-------------|---------|
| [Digit Recognition](projects/digit_recognition/) | Draw a digit and a neural network identifies it in real-time with confidence scores | Client (TensorFlow.js) |
| [Text Summarization](projects/text_summary/) | Summarize text with 4 algorithms -- TextRank, LSA, Luhn, and BART (abstractive) | Server (PyTorch, Transformers) |
| [Customer Segmentation](projects/customer_segmentation/) | Animated K-means++ clustering with RFM analysis, elbow method, and silhouette scoring | Client (Chart.js) |

### Data & Visualization

| Project | Description | Runs On |
|---------|-------------|---------|
| [Duolingo Visualizer](projects/duolingo_visualizer/) | Dashboard with calendar heatmap and charts for language learning progress | Client (Canvas, Chart.js) |
| [Related Artists](projects/related_artists/) | Explore artist collaborator networks via the Discogs API with streaming results | Server (Discogs API, SSE) |

## Architecture

Projects are **self-contained Flask blueprints** discovered and registered automatically at startup. Each project lives in its own directory under `projects/` with a `PROJECT_META` dict and a `bp` Blueprint. Adding a new project is as simple as creating a new package -- no manual wiring needed.

```
ml_hub/
├── app.py                     # Flask app factory, portfolio routes, blog registry
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── nginx/
│   └── nginx.conf             # Reverse proxy with SSL
├── static/
│   ├── css/main.css           # Global styles, dark/light theme
│   └── js/                    # Shared JS utilities
├── templates/
│   ├── base.html              # Master layout (topbar, sidebar, theme toggle)
│   ├── landing.html           # Portfolio homepage
│   ├── home.html              # Project listing grid
│   ├── about.html
│   ├── resume.html
│   ├── contact.html
│   ├── blog.html
│   └── blog/                  # Individual blog posts
└── projects/
    ├── __init__.py             # Auto-discovery and blueprint registration
    ├── digit_recognition/
    ├── text_summary/
    ├── customer_segmentation/
    ├── duolingo_visualizer/
    └── related_artists/
```

## Tech Stack

- **Backend**: Flask, Gunicorn (gevent), Python 3.11
- **Frontend**: Vanilla JavaScript, Chart.js, TensorFlow.js, Canvas API
- **ML/NLP**: PyTorch, Hugging Face Transformers (BART), NLTK, Sumy, scikit-learn
- **APIs**: Discogs (python3-discogs-client)
- **Deployment**: Docker, Nginx, Let's Encrypt SSL
- **Styling**: Custom CSS with dark/light theme via CSS variables and `localStorage`

## Getting Started

### Local development

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

The app starts at `http://localhost:5000`.

### Docker

```bash
cp .env.example .env
# Edit .env with your Discogs token
docker compose up --build
```

Nginx serves on ports 80/443. Flask runs internally on port 8000 behind Gunicorn with a gevent worker and a 300-second timeout for long-running ML inference.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DISCOGS_USER_AGENT` | User-Agent string for Discogs API requests | `MLHub/1.0` |
| `DISCOGS_USER_TOKEN` | Discogs personal access token (required for Related Artists) | -- |

## Routes

| Path | Description |
|------|-------------|
| `/` | Landing page |
| `/projects/` | Project listing grid |
| `/blog/` | Blog index |
| `/blog/<slug>/` | Individual blog post |
| `/resume/` | Resume |
| `/about/` | About |
| `/contact/` | Contact |
| `/digit-recognition/` | Digit Recognition project |
| `/text-summary/` | Text Summarization project |
| `/customer-segmentation/` | Customer Segmentation project |
| `/duolingo-visualizer/` | Duolingo Visualizer project |
| `/related-artists/` | Related Artists project |
