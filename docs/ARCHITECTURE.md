# Project Architecture

This document is required reading before any architecture-level change in this
repository. Architecture-level changes include changes to plugin lifecycle,
global state ownership, BrowserView creation/destruction, bounds calculation,
Decky/Steam integration points, persistence format, build/deploy metadata, or
cross-module responsibilities.

## Purpose

`decky-pip` is a Decky Loader plugin that opens a Steam/Deck browser view as a
picture-in-picture overlay while the user is in game mode. The plugin exposes a
Quick Access Menu settings panel for changing the URL, view mode, picture
position, picture size, and margin.

The project is intentionally small. Most behavior is client-side TypeScript and
React running inside the Decky frontend environment.

## Runtime Model

At runtime, the plugin has two UI surfaces:

1. The Decky Quick Access Menu content rendered by `Settings`.
2. A global Decky component named `PictureInPicture` rendered by `PipOuter`.

The global component owns the actual browser overlay. The settings panel only
mutates shared state.

The high-level flow is:

```text
Decky loads plugin
  -> src/index.tsx creates global StateManager
  -> index registers PictureInPicture global component
  -> index renders Settings in the QAM
  -> Settings updates global state
  -> PipOuter observes global state
  -> Pip creates/updates/destroys the BrowserView
```

## Module Map

### `src/index.tsx`

Plugin entrypoint. Responsibilities:

- Calls `definePlugin`.
- Creates the shared `StateManager<State>`.
- Merges default state with persisted `localStorage["pip"]` data.
- Persists selected settings back into `localStorage`.
- Registers the global component through `routerHook.addGlobalComponent`.
- Provides `Settings` as the Decky plugin panel content.
- Removes the global component on dismount.

Keep plugin lifecycle, persistence bootstrap, and Decky registration here.

### `src/globalState.tsx`

Shared state contract and React context. Responsibilities:

- Defines the `State` interface.
- Exposes `GlobalContext`.
- Exposes `useGlobalState`, which returns current state, a setter, and the raw
  `StateManager`.

Use this module for state shape changes. Any new persistent setting should be
added to `State`, initialized in `index.tsx`, and deliberately included or
excluded from the persistence watcher.

### `src/settings.tsx`

Quick Access Menu controls. Responsibilities:

- Opens the PiP view when the settings panel mounts if it was closed.
- Provides URL edit, expand toggle, position selector, size slider, margin
  slider, and close button.
- Temporarily hides the BrowserView around some Decky modal/dropdown
  interactions so the overlay does not obscure Decky UI.

Keep Decky panel controls here. Do not create or destroy BrowserViews from this
module.

### `src/pip.tsx`

Core PiP runtime. Responsibilities:

- Creates the Steam/Deck `BrowserView` via
  `Router.WindowStore.GamepadUIMainWindowInstance.CreateBrowserView("pip")`.
- Loads the configured URL.
- Applies visibility and bounds to the browser.
- Releases the BrowserView on React unmount.
- Tracks Deck UI surfaces, including main navigation, QAM, and an estimated
  virtual keyboard area.
- Intersects available rectangles and computes final overlay bounds for
  `ViewMode.Picture` and `ViewMode.Expand`.

This is the most sensitive module. BrowserView lifecycle, bounds calculation,
Decky private API assumptions, polling cadence, and UI avoidance all live here.

### `src/geometry.tsx`

Pure geometry helper. Responsibilities:

- Computes the intersection of available rectangles.

Keep this module side-effect free.

### `src/util.tsx`

Shared constants and enums. Responsibilities:

- Screen size constants.
- Default picture aspect/dimensions.
- `ViewMode` and `Position` enums.

Changing these values can affect persisted enum values and geometry behavior.
Treat enum reordering as a compatibility change.

### `src/urlModal.tsx` and `src/modal.tsx`

Decky modal integration. Responsibilities:

- `urlModal.tsx` renders the URL input modal and updates global state.
- `modal.tsx` wraps modal components with the existing global state context.

Keep modal-specific context bridging here.

### `src/useUIComposition.tsx`

Decky/Steam composition integration. Responsibilities:

- Finds Decky's private composition hook with `findModuleChild`.
- Requests `UIComposition.Notification` while the BrowserView is active.

This module depends on private Decky/Steam implementation details. Changes here
need manual testing on the target Decky/Steam environment.

## State And Persistence

Current state:

```ts
interface State {
  viewMode: ViewMode;
  position: Position;
  visible: boolean;
  margin: number;
  size: number;
  url: string;
}
```

Default state is created in `src/index.tsx`:

- `viewMode`: `ViewMode.Closed`
- `visible`: `true`
- `position`: `Position.TopRight`
- `margin`: `30`
- `size`: `1`
- `url`: `https://netflix.com`

Only `position`, `margin`, `size`, and `url` are persisted to
`localStorage["pip"]`. `viewMode` and `visible` are runtime state and should
remain non-persistent unless the product behavior intentionally changes.

## Bounds Calculation

`Pip` starts with the full 854x534 screen from `util.tsx`, then narrows the
available area when Deck UI surfaces are visible:

- Main navigation visible: remove the nav width from the left side.
- Quick Access Menu visible: remove the QAM width from the right side.
- Virtual keyboard visible: reserve an estimated 240px at the bottom.

The available rectangles are intersected. Margins are then applied. In picture
mode, the configured `Position` determines where the PiP rectangle is placed
inside the remaining bounds. In expand mode, the overlay uses the available area
after a fixed 30px margin.

## External Integration Points

The project relies on Decky and Steam frontend APIs that may not be stable:

- `definePlugin` and `routerHook` from `@decky/api`.
- QAM and modal controls from `@decky/ui`.
- `Router.WindowStore.GamepadUIMainWindowInstance.CreateBrowserView`.
- `getGamepadNavigationTrees`.
- `findModuleChild` detection for UI composition.
- React globals configured by `tsconfig.json` through
  `window.SP_REACT.createElement` and `window.SP_REACT.Fragment`.

Prefer keeping these assumptions isolated in existing integration modules.

## Build And Packaging

Build setup:

- `package.json` defines `pnpm build` as `rollup -c`.
- `rollup.config.js` delegates to `@decky/rollup`.
- `plugin.json` contains Decky plugin metadata.
- `deck.json` contains Deck deployment connection defaults.
- `tsconfig.json` uses strict TypeScript and the Decky React JSX factories.

There are currently no automated tests in the repository. For risky changes,
run the TypeScript/build pipeline and manually test in a Decky environment.

## Architecture Change Rules For Agents

Before making an architecture-level change:

1. Read this document completely.
2. Inspect the modules named in the relevant sections above.
3. Identify whether the change affects lifecycle, shared state, persistence,
   BrowserView ownership, bounds math, Decky private APIs, or build metadata.
4. Keep ownership boundaries intact unless the requested change explicitly
   requires moving them.
5. Update this document in the same change if responsibilities, data flow,
   persistence behavior, or integration assumptions change.

Recommended verification:

- Run `pnpm build` when dependencies are installed.
- For BrowserView, composition, navigation/QAM avoidance, or virtual keyboard
  changes, manually verify on the target Steam Deck or Decky environment.
- Confirm persisted settings still load from older `localStorage["pip"]` data
  when state or enum values change.

