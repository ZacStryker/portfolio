# Related Artists

Discover connections between musical artists by exploring collaborator networks. Search for any artist and find guest appearances, featured collaborations, and band members through the Discogs music database API. Results stream in real-time as they are discovered.

## Features

- **Artist search** -- type any artist or band name
- **Quick search cards** -- pre-loaded examples for instant exploration
- **Streaming results** -- collaborators appear in real-time via Server-Sent Events as releases are processed
- **Pause/resume** -- results are delivered in batches of 12; pause to browse, resume to load more
- **Sorting** -- by name (alphabetical), year (latest collaboration), or role
- **Relationship categories** -- Members, Guests (featured on the artist's tracks), Appearances (tracks where the artist appears on others' releases)
- **Lazy image loading** -- artist and album artwork loads on scroll via IntersectionObserver
- **7-day cache** -- repeated searches return instantly from a local JSON cache

## How It Works

1. The backend searches Discogs for the artist and fetches up to 100 releases
2. For each release, track-level credits are parsed to identify collaborators
3. Collaborators are streamed to the frontend via SSE as they are found
4. After every 12 new collaborators, processing pauses until the user resumes
5. Results are cached to disk for 7 days to avoid redundant API calls

## Tech Stack

- **Discogs API** (`python3-discogs-client`) -- artist search, release data, track credits, images
- **Flask** -- SSE streaming endpoint, image proxy routes, cancel/resume API
- **Server-Sent Events** -- real-time result streaming without WebSockets
- **Threading** -- non-blocking background processing with queue-based communication
- **IntersectionObserver** -- lazy loading of artist/album artwork

## Project Structure

```
related_artists/
├── __init__.py                  # Flask blueprint, Discogs integration, SSE streaming, caching
├── artist_cache.json            # 7-day rolling result cache
└── templates/
    └── related_artists/
        └── index.html           # Search UI, results display, inline JS (EventSource, sorting, lazy images)
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/related-artists/` | Main page |
| GET | `/related-artists/search_stream?artist=<name>&search_id=<id>` | SSE stream of results |
| POST | `/related-artists/cancel` | Cancel an active search |
| POST | `/related-artists/resume` | Resume a paused search |
| GET | `/related-artists/fetch_image/<artist_id>` | Fetch artist image |
| GET | `/related-artists/fetch_release_image/<release_id>` | Fetch album artwork |

## SSE Event Types

| Type | Description |
|------|-------------|
| `progress` | General progress update with percentage |
| `artist_info` | Found the main artist with profile data |
| `collaborator` | A new collaborator with release info |
| `paused` | Batch complete, waiting for resume |
| `complete` | Search finished with full results |
| `cached` | Results returned from cache |
| `error` | Something went wrong |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DISCOGS_USER_AGENT` | User-Agent for Discogs API | `MLHub/1.0` |
| `DISCOGS_USER_TOKEN` | Discogs personal access token | *(set in code)* |
