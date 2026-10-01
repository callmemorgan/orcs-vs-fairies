# Controls and scene integration

`src/game/Controls.ts` owns the keyboard shortcuts. The settings UI and the scene
must use the same `ControlProfiles` instance. `CONTROL_ACTIONS` lists every camera,
order, action-slot and control-group shortcut; each entry has an `id`, `label`,
`context` and `defaultBindings`.

Bindings use physical `KeyboardEvent.code` values, for example `KeyR` or
`Primary+Shift+Digit1`. `Primary` means Control on Windows/Linux or Command on a
Mac. `bindingFromKeyboard(event)` captures a chord, and `displayBinding(chord)`
provides its user-facing label. A uses attack move when something is selected and
pans left when nothing is selected. Arrow Left always pans left.

## Profiles

`new ControlProfiles(storage?)` reads the browser's local storage by default.
Pass `null` for an in-memory instance or a storage object exposing `getItem` and
`setItem`. The store key is `CONTROL_STORAGE_KEY`.

| Member | Result |
| --- | --- |
| `activeProfile` | Current profile name |
| `profiles` | List of saved names |
| `bindings` | Copy of all current action bindings |
| `bindingsFor(action)` | Copy of one action's bindings |
| `setBinding(action, stringOrArray)` | `{ok, error?, conflicts?}`; an empty string or array unbinds the action |
| `saveProfile(name)` | `{ok, error?}`; copies current bindings and selects the named profile |
| `selectProfile(name)` | Boolean indicating whether the name exists |
| `deleteProfile(name)` | Boolean; the final remaining profile cannot be deleted |
| `resetDefaults()` | Resets the current profile |
| `persistenceError` | Storage failure message or `null` |

Successful changes persist immediately. Binding conflicts are rejected before
the profile changes, including conflicts involving action slots and assigned or
recalled groups. A's two default uses have separate selection contexts. Corrupt
profiles are ignored when loading. Storage failures leave the current controls
usable in memory and supply a message the UI can show.

## Scene callbacks

`GameSceneOptions` accepts `controls`, `onActionSlot(slot)`, `onPause(paused)`,
`onPhotoMode(enabled)`, `onStep(state)` and `onCommand(side, command)`.
`onActionSlot` uses slots 1 through 6. The HUD should activate the corresponding
visible action and render its current binding rather than keep another keyboard
listener. `onPause` keeps the pause UI in sync. `onStep` runs after every completed
0.05-second simulation step. `onCommand` may route commands through an existing
recorder or transport; its Boolean result is respected. Without that callback,
the scene calls the simulation's `issueCommand` directly.

`scene.command(command)` is the public route for UI-issued commands. It rejects
commands while paused, in photo mode, input-blocked, read-only, or after the match
ends. Mouse and gamepad commands use this same route. Shift with a mouse order,
or holding the controller's left-stick click, adds `queued: true` to movement,
attack move, attack, gathering and repair orders. The keyboard modifier itself is configurable as `queueModifier`; its
default bindings are `ShiftLeft` and `ShiftRight`.

Set `scene.inputBlocked = true` while an application modal is open. The scene also
detects native dialogs, visible ARIA modal dialogs, and editable form controls.
Camera movement, shortcuts and controller buttons are suppressed in those cases.
Keyboard listeners are removed when the scene shuts down.

## Controller

`src/game/Gamepad.ts` exports `GAMEPAD_HELP` as `{control, action}` entries for the
settings UI. The scene polls the browser's standard controller mapping and
exposes `gamepadConnected`.

Left stick pans; right stick moves the visible battlefield cursor; triggers
zoom; shoulders cycle selection and center the chosen entity. A selects or
confirms a construction location, X issues a contextual order, Y starts attack
move, and B cancels. The D-pad uses an ability, holds, stops, or centers the
stronghold. Start pauses and Select enters photo mode. Holding right-stick click
with A/B/X/Y/LB/RB activates HUD slots 1–6, including recruitment and construction
actions. Holding left-stick click queues an order or adds to the selection.

Sticks have a radial deadzone. Buttons fire on a new press, never once per held
frame. A device connection, disconnect/reconnect, or return from a form or modal
requires held buttons to be released before they can issue another command.

## Photo and replay

`scene.setPhotoMode(enabled)` controls photo mode; `scene.photoMode` reports it.
Photo mode pauses the simulation and hides selection rings, health bars, order
markers, controller cursor and other battlefield UI. `onPhotoMode` must hide the
DOM HUD. Camera pan and zoom remain available. Leaving photo mode restores the
pause state from before entry. The default shortcuts are F9 to toggle and Escape
to exit, and both can be rebound.

Set `scene.readOnly = true` to suppress orders during replay or spectator viewing.
Set `scene.simulationEnabled = false` when another component supplies replay
states; `readOnly` by itself does not stop the simulation. Assign
`scene.viewSide = 0` or `1` to change fog, resource memory, selection, sounds and
ownership indicators to that player's perspective. Changing perspective clears
the selection and control groups. Camera controls and visible selections remain
available in a read-only view.

## Verification

`npx vitest run tests/controls.test.ts tests/gamepad.test.ts` checks saved profiles,
contextual bindings, conflicts, modifier matching, deadzones, button edges,
focus restoration, device replacement and HUD action slots.

Start Vite on an unused local port, then run the committed browser check:

```sh
npx vite --host 127.0.0.1 --port 5293
OVF_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/verify_controls.mjs http://127.0.0.1:5293
```

If Playwright is installed in the project, omit the environment variable. The
script creates its own browser context, closes it on completion or failure, and
writes evidence to `work/controls-proof.json` and `work/controls-photo.png`.

The browser verification uses the real Phaser scene and simulation with external
controllers, then drove keyboard and mouse events plus the standard
`navigator.getGamepads` polling path. It verified camera rebinding, action slots,
Shift queued movement and attack move, photo-mode pause restoration, form and
modal suppression, read-only side-one selection, and controller movement and
selection without held-button repeats. It also rebinds the queue modifier and
checks that a click followed immediately by key release retains the queued order.
