# Duolingo Visualizer

Interactive dashboard visualizing Dutch language learning progress from Duolingo. Displays aggregate statistics, a GitHub-style calendar heatmap of daily activity, and a bar chart of lesson completions over time.

## Features

- **Stats grid** -- total lessons, XP, current streak, and other overview metrics
- **Daily XP heatmap** -- calendar-style visualization showing activity intensity per day
  - Color gradient from light to intense green
  - Hover tooltips with date-specific details
  - Legend showing intensity ranges
- **Lessons completed bar chart** -- chronological progression of lesson completions

## Data

Learning data is loaded from a static JSON export (`data/duolingo-progress.json`) served via a Flask API endpoint. Each entry is keyed by date:

```json
{
  "2024/06/17": {
    "number_of_sessions": 4,
    "session_time": 1062,
    "streak": 1,
    "xp_today": 57
  }
}
```

## Technical Overview

### Stats Computation

All metrics are derived client-side from the raw JSON. On load the script sorts entries by date and computes:

- **Current streak** -- read directly from the most recent entry's `streak` field
- **Total lessons / session time** -- summed across all entries via `reduce`
- **Averages** -- total lessons and time divided by the number of active days (days with at least one session)

### Cumulative Lessons Chart

A Chart.js line chart plots a running total of lessons aggregated by month. As sorted dates are iterated, a running counter accumulates `number_of_sessions` per month key (`YYYY/MM`). The chart uses `tension: 0.4` for smooth curves, an area fill beneath the line, and theme-aware colors derived from the current `data-theme` attribute.

### Calendar Heatmap

The heatmap is rendered entirely with the Canvas API:

1. **Date range** -- the grid spans from the Sunday on or before the first data point to the Saturday on or after the last, so every row is a complete week.
2. **Cell grid** -- each day maps to a 14x14 px cell with 2 px gaps. Cells are placed by `(week, dayOfWeek)` coordinates and drawn with `roundRect` (polyfilled for older browsers).
3. **Color scale** -- a 4-stop linear opacity ramp from 0.15 to 1.0 over the Duolingo green (`#58cc02`), normalized against the maximum XP value in the dataset. Zero-activity days use a faint neutral fill.
4. **Labels** -- day-of-week labels (Mon, Wed, Fri) are drawn to the left. Month labels are drawn above the first Sunday of each month, and year labels above January.
5. **Tooltips** -- a `mousemove` listener maps pixel coordinates back to `(column, row)`, locates the matching cell, and positions an absolutely-placed tooltip div above it.
6. **Auto-scroll** -- the container scrolls to the right on load so the most recent activity is visible first.
7. **HiDPI** -- the canvas is scaled by `devicePixelRatio` for crisp rendering on retina displays.

### Legend

Built as HTML outside the canvas scroll container. Five color swatches are generated using the same `getCellColor` function at ratios 0, 0.25, 0.5, 0.75, and 1.0, bookended by "Less" and "More" labels.

## Tech Stack

- **Chart.js** -- bar chart for lesson completions
- **Canvas API** -- custom heatmap rendering with mouse interactions
- **Flask** -- serves data via `/api/data`

## Project Structure

```
duolingo_visualizer/
├── __init__.py                    # Flask blueprint, API route
├── data/
│   └── duolingo-progress.json     # Personal learning data export
├── templates/
│   └── duolingo_visualizer/
│       └── index.html             # Stats grid and dual chart layout
└── static/
    └── script.js                  # Heatmap canvas rendering, Chart.js bar chart
```

## API

| Method | Path                             | Description |
|--------|----------------------------------|-------------|
| GET    | `/duolingo-visualizer/`          | Main page   |
| GET    | `/duolingo-visualizer/api/data`  | JSON learning data |
