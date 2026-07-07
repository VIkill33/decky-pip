import {
    Router,
    WindowRouter,
    getGamepadNavigationTrees,
} from "@decky/ui";
import isEqual from "lodash/isEqual";
import React, { useEffect, useRef, useState } from "react";

import { useGlobalState } from "./globalState";
import { intersectRectangles } from "./geometry";
import { UIComposition, useUIComposition } from "./useUIComposition";
import { PICTURE_HEIGHT, PICTURE_WIDTH, Position, SCREEN_HEIGHT, SCREEN_WIDTH, ViewMode } from "./util";

interface BrowserProps {
    url: string
    visible: boolean
    x: number
    y: number
    width: number
    height: number
}

const Browser = ({ url, visible, x, y, width, height }: BrowserProps) => {
    useUIComposition(UIComposition.Notification);

    const [{ browser, view }] = useState<{ browser: any, view: any }>(() => {
        const root: WindowRouter & any = Router.WindowStore?.GamepadUIMainWindowInstance;
        const view = root.CreateBrowserView("pip");
        const browser = view.GetBrowser();

        window['pip' as any] = view;

        return {
            view,
            browser
        }
    });

    useEffect(() => {
        browser.SetVisible(visible);
    }, [visible]);

    useEffect(() => {
        view.LoadURL(url);
    }, [url]);

    useEffect(() => {
        browser.SetBounds(x, y, width, height);
    }, [x, y, width, height]);

    useEffect(() => {
        return () => view.Destroy();
    }, []);

    return null;
}

const getBounds = (document: any) => {
    return {
        x: document?.defaultView?.screenLeft,
        y: document?.defaultView?.screenTop,
        width: document?.defaultView?.outerWidth,
        height: document?.defaultView?.outerHeight,
    };
}

const getDeckComponentBounds = () => {
    const trees = getGamepadNavigationTrees();

    const nav = trees.find((tree: any) => tree?.id === 'MainNavMenuContainer')?.m_Root?.m_element?.ownerDocument.defaultView ?? null
    const navHidden = nav?.document.hidden;
    const navBounds = navHidden
        ? null
        : getBounds(nav?.document);

    const qam = trees.find((tree: any) => tree?.id === 'QuickAccess-NA')?.m_Root?.m_element?.ownerDocument.defaultView ?? null
    const qamHidden = qam?.document.hidden;
    const qamBounds = qamHidden
        ? null
        : getBounds(qam?.document);

    const virtualKeyboard = trees.find((tree: any) => tree?.id === 'virtual keyboard')?.m_Root?.m_element?.ownerDocument.defaultView ?? null
    const virtualKeyboardHidden = !virtualKeyboard;
    // this is a guess, gotta figure out how to inspect to keyboard DOM
    const virtualKeyboardBounds = virtualKeyboardHidden
        ? null
        : {
            x: 0,
            y: SCREEN_HEIGHT - 240,
            width: SCREEN_WIDTH,
            height: 240
        };

    return {
        nav: navBounds,
        qam: qamBounds,
        virtualKeyboard: virtualKeyboardBounds,
    }
}

interface Bounds {
    x: number
    y: number
    width: number
    height: number
}

interface DragStart {
    pointerId: number
    pointerX: number
    pointerY: number
    boundsX: number
    boundsY: number
}

const dragBarHeight = 28;

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max));

const insetBounds = (bounds: Bounds, margin: number): Bounds => ({
    x: bounds.x + margin,
    y: bounds.y + margin,
    width: Math.max(0, bounds.width - margin * 2),
    height: Math.max(0, bounds.height - margin * 2),
});

const clampToArea = (bounds: Bounds, area: Bounds): Bounds => ({
    ...bounds,
    x: clamp(bounds.x, area.x, area.x + area.width - bounds.width),
    y: clamp(bounds.y, area.y, area.y + area.height - bounds.height),
});

const getPictureBounds = (
    area: Bounds,
    position: Position,
    pictureWidth: number,
    pictureHeight: number
): Bounds => {
    const bounds = {
        x: area.x,
        y: area.y,
        width: pictureWidth,
        height: pictureHeight,
    };

    switch (position) {
        case Position.Top: {
            bounds.x += area.width / 2 - pictureWidth / 2;
        } break;
        case Position.TopRight: {
            bounds.x += area.width - pictureWidth;
        } break;
        case Position.Right: {
            bounds.x += area.width - pictureWidth;
            bounds.y += area.height / 2 - pictureHeight / 2;
        } break;
        case Position.BottomRight: {
            bounds.x += area.width - pictureWidth;
            bounds.y += area.height - pictureHeight;
        } break;
        case Position.Bottom: {
            bounds.x += area.width / 2 - pictureWidth / 2;
            bounds.y += area.height - pictureHeight;
        } break;
        case Position.BottomLeft: {
            bounds.y += area.height - pictureHeight;
        } break;
        case Position.Left: {
            bounds.y += area.height / 2 - pictureHeight / 2;
        } break;
        case Position.TopLeft: {
            // do nothing, screen is calculated initially to top left
        } break;
    }

    return clampToArea(bounds, area);
};

const PipDragBar = ({ bounds, dragArea }: { bounds: Bounds, dragArea: Bounds }) => {
    const [, setGlobalState] = useGlobalState();
    const dragStart = useRef<DragStart | null>(null);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStart.current = {
            pointerId: event.pointerId,
            pointerX: event.clientX,
            pointerY: event.clientY,
            boundsX: bounds.x,
            boundsY: bounds.y,
        };
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!dragStart.current || dragStart.current.pointerId !== event.pointerId) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const nextBounds = clampToArea({
            ...bounds,
            x: dragStart.current.boundsX + event.clientX - dragStart.current.pointerX,
            y: dragStart.current.boundsY + event.clientY - dragStart.current.pointerY,
        }, dragArea);

        setGlobalState(state => ({
            ...state,
            visible: true,
            viewMode: ViewMode.Picture,
            customPosition: {
                x: nextBounds.x,
                y: nextBounds.y,
            }
        }));
    };

    const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!dragStart.current || dragStart.current.pointerId !== event.pointerId) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        dragStart.current = null;
    };

    return <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{
            position: 'fixed',
            left: bounds.x,
            top: bounds.y,
            width: bounds.width,
            height: Math.min(dragBarHeight, bounds.height),
            zIndex: 2147483647,
            touchAction: 'none',
            cursor: 'move',
            background: 'rgba(0, 0, 0, 0.42)',
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4,
            boxSizing: 'border-box',
        }} />;
};

const useDeckComponentBounds = () => {
    const [state, setState] = useState(getDeckComponentBounds());

    useEffect(() => {
        const interval = setInterval(() => {
            setState(current => {
                const next = getDeckComponentBounds();
                return isEqual(next, current)
                    ? current
                    : next;
            });
        }, 250);

        return () => clearInterval(interval);
    }, []);

    return state;
}

export const Pip = () => {
    const { nav, qam, virtualKeyboard } = useDeckComponentBounds();
    const [{ viewMode, position, customPosition, size, url, visible, ...settings }] = useGlobalState();

    const pictureWidth = PICTURE_WIDTH * size;
    const pictureHeight = PICTURE_HEIGHT * size;

    const availableBounds = [{
        x: 0,
        y: 0,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT
    }];

    if (nav) {
        availableBounds.push({
            x: nav.width,
            y: 0,
            width: SCREEN_WIDTH - nav.width,
            height: SCREEN_HEIGHT
        });
    }

    if (qam) {
        availableBounds.push({
            x: 0,
            y: 0,
            width: SCREEN_WIDTH - qam.width,
            height: SCREEN_HEIGHT
        });
    }

    if (virtualKeyboard) {
        availableBounds.push({
            x: 0,
            y: 0,
            width: SCREEN_WIDTH,
            height: SCREEN_HEIGHT - virtualKeyboard.height
        });
    }

    const available = intersectRectangles(availableBounds) ?? {
        x: 0,
        y: 0,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT
    };

    const margin = viewMode == ViewMode.Expand
        ? 30
        : settings.margin;

    const dragArea = insetBounds(available, margin);
    const bounds = viewMode == ViewMode.Picture
        ? customPosition
            ? clampToArea({
                x: customPosition.x,
                y: customPosition.y,
                width: pictureWidth,
                height: pictureHeight,
            }, dragArea)
            : getPictureBounds(dragArea, position, pictureWidth, pictureHeight)
        : dragArea;
    const browserBounds = viewMode == ViewMode.Picture
        ? {
            x: bounds.x,
            y: bounds.y + dragBarHeight,
            width: bounds.width,
            height: Math.max(0, bounds.height - dragBarHeight)
        }
        : bounds;

    return <>
        <Browser
            url={url}
            visible={visible}
            {...browserBounds} />
        {visible && viewMode == ViewMode.Picture && <PipDragBar bounds={bounds} dragArea={dragArea} />}
    </>;
}

export const PipOuter = () => {
    const [{ viewMode }] = useGlobalState();

    if (viewMode == ViewMode.Closed) {
        return null;
    }

    return <Pip />;
}
