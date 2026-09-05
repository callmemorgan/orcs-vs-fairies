# Current production performance

The current Hold Position build `index-9PMVYv2m.js` completed a valid measurement: 58.5255 FPS over 60008.00 ms and 3512 frames, after five seconds of warmup. Median frame interval was 17.10 ms, p95 18.70 ms and p99 19.40 ms. Exactly 100 living, visible, on-screen units remained throughout. Viewport, canvas and drawing buffer were each 1920 by 1080; reported device pixel ratio was 1.5. The document was visible, all final art loaded, and the simulation was unpaused during sampling. Audio was running and unmuted. The fixture then paused automatically. No gameplay orders were issued during sampling. `performance-hold.json` and `performance-hold-provenance.json` retain the measurement and its production/source binding.

This result remains slightly below the 60 FPS target. It is a maintained 100-unit scene, not a normal-match balance or pacing test.

## Previous harvest-rate measurement

The earlier bundle `index-BbPjUpKo.js` completed a valid 100-unit benchmark on the adopted harvest rate. `performance-harvest.json` retains the snapshot; `performance-harvest-provenance.json` binds its hash to the production files, source hashes and recorded browser URL. The collector itself does not emit a bundle identity. Five seconds of warmup preceded 3,510 frames over 60,002 ms: **58.4981 FPS**, median 17.1 ms, p95 18.8 ms and p99 19.5 ms. All 100 units stayed alive, visible and on screen; viewport, canvas and drawing buffer remained 1920×1080 at approximately 1.0 DPR. Art loaded, the document was visible, and the simulation was unpaused during sampling. The fixture auto-paused after completion. This is slightly below the 60 FPS target, not a target pass.

Only this game tab was open in the in-app browser. The start/restart click unlocked sound; the saved audio graph was running and unmuted. No normal gameplay orders were issued during sampling. At the time of this earlier measurement, full browser verification was still pending; the later Fairy matches now supply it.

## Previous movement-corrected measurement

Bundle `index-6tDjccOB.js` completed the preceding sample, saved as `performance-corrected.json` at 2026-09-05T06:46:05.869Z. Its average was 58.4755 FPS, also below target.

| Measurement | Recorded value |
| --- | --- |
| Average FPS | 58.47553659512065 |
| Sampled frames / duration | 3,509 / 60,008 ms |
| Warmup / total elapsed | 5,000 / 65,022.6 ms |
| Median / p95 / p99 frame interval | 17.1 / 18.7 / 19.3 ms |
| Viewport, canvas and drawing buffer | Each 1920 x 1080 |
| Device pixel ratio | Approximately 1.0 |
| Living, visible and on-screen units | Exactly 100 throughout the sample |
| Loaded art | 31 assets; 100 rendered unit sprites |

The first and last metadata records both show a visible document, loaded art and an unpaused simulation. Unit minima and maxima are 100 in all three categories. The fixture paused after completing the measurement, which explains the top-level paused flag in the saved snapshot. Audio was running and unmuted; its telemetry records 193 scheduled attack cues and a nonzero output-graph signal. That establishes graph activity, not a listening assessment.

This synthetic fixture measures a maintained 100-unit scene, not a normal match's balance or duration. The corrected normal fairy match completed in defeat at 8:16 with an end-screen restart (FAIRIES_CORRECTED_MATCH.md). The earlier interrupted 7:15 run is excluded. That pending verification was subsequently supplied by the later Fairy match records.

## Previous production measurements

Bundle `index-DBgkXH8x.js`, with the regenerated PNGs, revised recruitment data and audio, ran two complete 100-unit measurements at 1920×1080. Each used five seconds of warmup and 60 seconds of frame intervals. All 100 living final sprites remained visible and on screen, the required artwork loaded, and viewport/canvas/drawing-buffer dimensions stayed fixed. Blender was idle. Both samples were valid, and the fixture automatically paused after completion.

| Run | Average FPS | Frames / sampled time | Median | p95 | p99 |
| --- | ---: | --- | ---: | ---: | ---: |
| Browser panel hidden | 58.51 | 3,511 / 60,007.1 ms | 17.1 ms | 18.8 ms | 19.4 ms |
| Browser visibility explicitly enabled | 58.58 | 3,515 / 60,004.2 ms | 17.1 ms | 18.5 ms | See full JSON |

The full snapshots are `performance-current-hidden.json` and `performance-current-visible.json`. Both report document visibility even though the first browser panel was not presented. Sound was enabled for both complete runs; telemetry recorded combat cues and nonzero output-graph signals. No gameplay orders were issued during the sampling windows.

Those measurements were slightly below the 60 FPS target. The historical 144.01 FPS result in PERFORMANCE_TRIMMED.md was not reproduced by the current build. Atlas trimming and unchanged-setter guards remain present; all 1,576 atlas frames are trimmed and the current public/dist JSON agrees. Read-only display inspection reported 144.05 Hz. Changing browser presentation visibility did not restore the earlier result, so visibility alone is not an established explanation.

A separate empty DOM page at the same viewport/DPR measured 121.22 RAF callbacks per second over ten seconds, with median 7 ms and p95 13.9 ms (`raf-baseline.json`). A 33.56-second CPU profile of the paused game, which still renders the 100 sprites, had 27,889 idle samples out of 31,660. That profile does not measure active simulation CPU cost or GPU work. These diagnostics do not identify the cause of the difference from the historical result. Use the latest measured result above for delivery claims.
