# Complete-art performance baseline

Measured in the Codex in-app browser at 1920×1080 on this computer after Blender rendering finished. Production bundle: `index-CO9sd8fN.js`. The benchmark uses 100 units with high hit points in paired combat; it is a synthetic workload, not match-outcome evidence.

After a 5-second warmup, 3514 rendered frames were sampled over 60.002 seconds. Average FPS was 58.56. Frame intervals were median 17.10 ms, p95 18.60 ms, and p99 19.30 ms. This is below the 60 FPS target; the target is not marked passed.

The collector confirmed 100 living, fog-visible, on-screen units throughout. Every sampled frame had complete required textures and 100 successful final unit sprite draws. Viewport, canvas CSS size and drawing buffer were all 1920×1080. The document remained visible and the simulation was unpaused. No browser warning/error entries were reported at the end of the sample. The full state and collector output are in `performance-final-art-baseline.json`.

The GPU was reported as an NVIDIA GeForce RTX 5090. One utilization observation during the sample was 17 percent; this is not a GPU profile. Optimization and broader browser match verification remain open.
