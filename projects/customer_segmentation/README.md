# Customer Segmentation

Interactive K-means++ clustering visualization with RFM (Recency, Frequency, Monetary) analysis. Watch the algorithm converge step-by-step with animated scatter plots, then evaluate cluster quality with silhouette scores and the elbow method.

## Features

- **Adjustable K** -- slider to select 2-8 clusters
- **Feature space selection** -- Monetary x Frequency, Recency x Monetary, or Recency x Frequency
- **K-means++ vs Random** -- toggle initialization strategy to compare convergence
- **Animated convergence** -- step through iterations and watch data points migrate between clusters
- **Elbow method chart** -- visualize inertia across K values to find the optimal cluster count
- **Silhouette score** -- quantitative measure of cluster cohesion and separation
- **RFM segment labels** -- clusters are mapped to customer archetypes (Champions, Loyal Customers, At Risk, etc.)

## How It Works

Everything runs **client-side** in JavaScript. The K-means++ algorithm is implemented from scratch:

1. Smart centroid initialization (K-means++) selects initial centroids proportional to squared distance
2. Assignment step assigns each point to the nearest centroid
3. Update step moves centroids to the mean of their assigned points
4. Repeat until convergence (centroids stop moving)

Each iteration is rendered as an animation frame on a Chart.js scatter plot.

## Tech Stack

- **Chart.js** -- scatter plots, line charts, and elbow method visualization
- **Vanilla JavaScript** -- full K-means++ implementation, animation system, state management
- **Flask** -- serves the page (no backend computation)

## Project Structure

```
customer_segmentation/
├── __init__.py                      # Flask blueprint (GET /)
├── templates/
│   └── customer_segmentation/
│       └── index.html               # UI with controls and 3 chart panels
└── static/
    └── script.js                    # K-means implementation, Chart.js integration
```

## Route

| Method | Path                        | Description |
|--------|-----------------------------|-------------|
| GET    | `/customer-segmentation/`   | Main page   |
