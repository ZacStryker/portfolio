# Portfolio Site

A fullstack portfolio and interactive machine learning showcase built with Flask. Features seven self-contained project demos spanning computer vision, NLP, unsupervised learning, classification, regression, data visualization, and music data exploration — plus a blog, resume, and contact pages.

## Projects

Each project lives in its own GitHub repo, wired in here as a git submodule.

### Machine Learning

| Project | Description | Runs On |
|---------|-------------|---------|
| [Digit Recognition](https://github.com/ZacStryker/digit-recognition) | Draw a digit and a neural network identifies it in real-time with confidence scores | Client (TensorFlow.js) |
| [Text Summarization](https://github.com/ZacStryker/text-summary) | Summarize text with 4 algorithms — TextRank, LSA, Luhn, and BART (abstractive) | Server (PyTorch, Transformers) |
| [Customer Segmentation](https://github.com/ZacStryker/customer-segmentation) | Animated K-means++ clustering with RFM analysis, elbow method, and silhouette scoring | Client (Chart.js) |
| [Mushroom Classification](https://github.com/ZacStryker/mushroom-classification) | Compare Random Forest, Gradient Boosting, Logistic Regression, and Decision Tree on the UCI Mushroom dataset | Server (scikit-learn) |
| [Longevity Prediction](https://github.com/ZacStryker/work-life-regression) | Predict age at death from lifestyle habits using four regression models with GridSearchCV tuning and EDA plots | Server (scikit-learn, seaborn) |

### Data & Visualization

| Project | Description | Runs On |
|---------|-------------|---------|
| [Duolingo Visualizer](https://github.com/ZacStryker/duolingo-visualizer) | Dashboard with calendar heatmap and charts for language learning progress | Client (Canvas, Chart.js) |
| [Related Artists](https://github.com/ZacStryker/related-artists) | Explore artist collaborator networks via the Discogs API with streaming results | Server (Discogs API, SSE) |

## Architecture

Projects are **self-contained Flask blueprints** discovered and registered automatically at startup. Each project lives in its own GitHub repo, mounted as a git submodule under `projects/`. Each package exposes a `PROJECT_META` dict and a `bp` Blueprint — adding a new project requires no manual wiring in the main app.

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
│   ├── projects.html          # Project listing grid
│   ├── about.html
│   ├── resume.html
│   ├── contact.html
│   ├── blog.html
│   └── blog/                  # Individual blog posts
└── projects/
    ├── __init__.py             # Auto-discovery and blueprint registration
    ├── customer_segmentation/  # submodule → ZacStryker/customer-segmentation
    ├── digit_recognition/      # submodule → ZacStryker/digit-recognition
    ├── duolingo_visualizer/    # submodule → ZacStryker/duolingo-visualizer
    ├── mushroom_classification/ # submodule → ZacStryker/mushroom-classification
    ├── related_artists/        # submodule → ZacStryker/related-artists
    ├── text_summary/           # submodule → ZacStryker/text-summary
    └── work_life_regression/   # submodule → ZacStryker/work-life-regression
```

## Tech Stack

- **Backend**: Flask, Gunicorn (gevent), Python 3.12
- **Frontend**: Vanilla JavaScript, Chart.js, TensorFlow.js, Canvas API
- **ML/NLP**: PyTorch, Hugging Face Transformers (BART), NLTK, Sumy, scikit-learn, seaborn
- **APIs**: Discogs (python3-discogs-client)
- **Deployment**: Docker, Nginx, Let's Encrypt SSL
- **Styling**: Custom CSS with dark/light theme via CSS variables and `localStorage`

## Getting Started

### Local development

```bash
git clone --recurse-submodules https://github.com/ZacStryker/portfolio.git
cd portfolio
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

The app starts at `http://localhost:5000`.

> If you cloned without `--recurse-submodules`, run `git submodule update --init --recursive` to pull the project code.

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
| `DISCOGS_USER_TOKEN` | Discogs personal access token (required for Related Artists) | — |

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
| `/mushroom-classification/` | Mushroom Classification project |
| `/work-life-regression/` | Longevity Prediction project |
| `/duolingo-visualizer/` | Duolingo Visualizer project |
| `/related-artists/` | Related Artists project |
