---
title: Tennessee Eastman Process Analytics Dashboard
emoji: 🏭
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Tennessee Eastman Process (TEP) Analytics Dashboard

Interactive industrial analytics dashboard for the **Tennessee Eastman Process** benchmark dataset.

## Features
- **Dataset Overview & Statistics:** 2,900 samples, 600 time steps, 34 variables across 6 operating modes.
- **Variable Dictionary:** Interactive metadata dictionary for 22 process measurements (`XMEAS 1-22`) and 12 manipulated variables (`XMV 1-12`).
- **Temporal Analysis:** High-performance multi-series inspection at 60 FPS with Apache ECharts.
- **Fault Comparison:** Side-by-side normal vs fault condition diagnostics.
- **PCA 2D Projection:** SVD-based latent space scatter plot for cluster and anomaly identification.
- **Correlation Heatmap 34x34:** Cross-correlation analysis under nominal and faulty states.
- **Realtime Simulator:** Dynamic process playback with live industrial gauges and status indicators.

## Running Locally
```bash
pip install -r requirements.txt
python server.py
```
Access at `http://localhost:8000`.
