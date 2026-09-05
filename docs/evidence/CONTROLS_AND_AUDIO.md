# Current browser controls and audio checks

Production bundle `index-DBgkXH8x.js` includes the regenerated assets, revised recruitment times, sound cues and two control fixes. These checks ran in a preparatory orc session, separate from timed pacing matches.

An initial Shift-click test replaced the selection because the handler used only Phaser's polled Shift state. The handler now also honors the pointer event's Shift modifier. After rebuilding, F2 selected the initial Ironjaw and Shift-click on a moved Scrapper produced two selected units with both worker construction and War Cry actions. This verifies additive selection through the browser interaction API.

The selected Ironjaw received a normal move order, then the Pause button froze the match. Pressing Q, X and A kept its move order and ready War Cry unchanged. The saved `paused-hotkeys.json` records the paused state at 71.1 seconds, the move destination, and no ability cooldown. This fixes gameplay hotkeys that previously bypassed the pointer controls' pause guard.

Wheel input visibly enlarged the world and then reduced it. `audio-muted-and-zoom.json` records zoom 1.8, while `camera-pan-and-zoom.json` records zoom 0.55. Arrow taps at the minimum zoom did not move the camera because the entire horizontal world fits within the viewport at that scale; those taps are not independent proof of keyboard panning. Normal matches separately exercised minimap camera movement and Space returning to headquarters.

After a trusted player input, `audio-unmuted.json` records a running AudioContext, selection and order cues, and a nonzero signal from the analyser connected to the output graph. Clicking Mute sound changed the button to Enable sound. A subsequent selection produced no additional audio cue; the muted snapshot records zero active voices and zero current signal. This verifies graph output and mute behavior, not listening quality or the computer's speaker volume. Combat and result cues still require observation in the current match or benchmark.

Prior complete-art normal matches exercised drag selection, resource canopy clicks, construction placement, recruitment, right-click orders, attack-move, control groups, F2, minimap, Space, abilities and end-screen restart. Their exact builds and outcomes remain in the separate match records. Middle-button dragging has source support but has not been separately verified through the available browser input API.

The subsequent complete orc match recorded combat and victory cues plus nonzero output graph signal; the interrupted orc match recorded the defeat cue. See `ORCS_PACED_MATCH.md`. Short camera taps were then reproduced as a polling problem and fixed; `CAMERA_FIX.md` records the separate current-browser verification.
