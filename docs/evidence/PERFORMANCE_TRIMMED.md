# Trimmed-sprite performance result

Production build `index-BfWWoJZ7.js` ran the same synthetic 100-unit combat fixture as the baseline in the Codex in-app browser. Blender was idle. The 60 FPS target was exceeded in this measured workload.

After 5 seconds of warmup, 8641 rendered frames were sampled over 60.002 seconds. Average FPS: 144.01; median frame interval: 7.00 ms; p95: 7.90 ms; p99: 8.50 ms. The collector confirmed 100 living, visible, on-screen final sprites throughout, complete required art, an unpaused visible document, and 1920×1080 viewport, canvas and drawing buffer. Full output is in performance-trimmed.json.

The rendering changes trim transparent rectangles through atlas metadata and avoid unchanged sprite setters, including unnecessary scene depth sorts. Source image pixels, logical dimensions and anchors remain unchanged. The packer reconstruction test checks exact RGBA recovery, ground positions and pixel-hit coordinates; the packed asset validator also passed. The actual browser displayed the same unit silhouettes and positions during combat. Individual contributions of trimming and setter guards were not measured separately.

The old baseline was 58.56 FPS. This comparison applies to the same synthetic workload on this computer; it does not prove match balance, human play outcomes or arbitrary hardware performance. Atlas decoded storage remains 230.59 MiB because page layout and PNG pixels were preserved.
