import { FaTv } from "react-icons/fa";
import { StateManager } from "cotton-box";
import { quickAccessMenuClasses } from "@decky/ui";
import { definePlugin, routerHook, } from "@decky/api";

import { PipOuter } from "./pip";
import { Settings } from "./settings";
import { PICTURE_MAX_HEIGHT_SCALE, PICTURE_MAX_SIZE, PICTURE_MAX_WIDTH_SCALE, PICTURE_MIN_SIZE, Position, ViewMode } from "./util";
import { CustomPosition, State, GlobalContext, UrlEntry } from "./globalState";

const defaultUrl = "https://netflix.com";

const loadPersistedState = () => {
    try {
        return JSON.parse(localStorage.getItem('pip') ?? '{}') as Partial<State>;
    } catch {
        return {};
    }
};

const isCustomPosition = (value: unknown): value is CustomPosition => {
    const position = value as CustomPosition;
    return typeof position?.x === "number" && typeof position?.y === "number";
};

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

const normalizeUrlEntries = (entries: unknown, currentUrl: string): UrlEntry[] => {
    const normalized = Array.isArray(entries)
        ? entries.reduce<UrlEntry[]>((result, entry) => {
            if (typeof entry?.url !== "string" || entry.url.length === 0) {
                return result;
            }

            if (result.some(({ url }) => url === entry.url)) {
                return result;
            }

            result.push({
                id: typeof entry.id === "string" && entry.id.length > 0
                    ? entry.id
                    : `url-${result.length}`,
                url: entry.url,
                note: typeof entry.note === "string" ? entry.note : ""
            });

            return result;
        }, [])
        : [];

    if (!normalized.some(({ url }) => url === currentUrl)) {
        normalized.unshift({
            id: "current",
            url: currentUrl,
            note: ""
        });
    }

    return normalized;
};

export default definePlugin(() => {
    const persistedState = loadPersistedState();
    const url = typeof persistedState.url === "string" && persistedState.url.length > 0
        ? persistedState.url
        : defaultUrl;

    const state = new StateManager<State>({
        viewMode: ViewMode.Closed,
        visible: true,
        position: persistedState.position ?? Position.TopRight,
        customPosition: isCustomPosition(persistedState.customPosition)
            ? persistedState.customPosition
            : null,
        size: typeof persistedState.size === "number"
            ? clamp(persistedState.size, PICTURE_MIN_SIZE, PICTURE_MAX_SIZE)
            : 1,
        widthScale: typeof persistedState.widthScale === "number"
            ? clamp(persistedState.widthScale, PICTURE_MIN_SIZE, PICTURE_MAX_WIDTH_SCALE)
            : 1,
        heightScale: typeof persistedState.heightScale === "number"
            ? clamp(persistedState.heightScale, PICTURE_MIN_SIZE, PICTURE_MAX_HEIGHT_SCALE)
            : 1,
        dragBarVisible: typeof persistedState.dragBarVisible === "boolean"
            ? persistedState.dragBarVisible
            : true,
        url,
        urlEntries: normalizeUrlEntries(persistedState.urlEntries, url),
    });

    state.watch(({ position, customPosition, size, widthScale, heightScale, dragBarVisible, url, urlEntries }) =>
        localStorage.setItem('pip', JSON.stringify({ position, customPosition, size, widthScale, heightScale, dragBarVisible, url, urlEntries })));

    routerHook.addGlobalComponent("PictureInPicture", () => {
        return <GlobalContext.Provider value={state}>
            <PipOuter />
        </GlobalContext.Provider>
    });

    return {
        name: "Picture in Picture",
        titleView: <div className={quickAccessMenuClasses.Title}>Picture in Picture</div>,
        icon: <FaTv />,
        content:
            <GlobalContext.Provider value={state}>
                <Settings />
            </GlobalContext.Provider>,
        onDismount() {
            routerHook.removeGlobalComponent("PictureInPicture");
        },
    };
});
