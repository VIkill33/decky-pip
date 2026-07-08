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
import { PICTURE_HEIGHT, PICTURE_MAX_HEIGHT_SCALE, PICTURE_MAX_SIZE, PICTURE_MAX_WIDTH_SCALE, PICTURE_MIN_SIZE, PICTURE_WIDTH, Position, SCREEN_HEIGHT, SCREEN_WIDTH, ViewMode } from "./util";

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

interface ResizeStart {
    pointerId: number
    pointerX: number
    pointerY: number
    size: number
    widthScale: number
    heightScale: number
}

type ResizeMode = "width" | "height" | "uniform";

const dragBarHeight = 14;
const resizeEdgeHandleSize = 18;

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

const getMaxWidthScale = (area: Bounds, size: number) =>
    Math.max(PICTURE_MIN_SIZE, Math.min(PICTURE_MAX_WIDTH_SCALE, area.width / (PICTURE_WIDTH * size)));

const getMaxHeightScale = (area: Bounds, size: number) =>
    Math.max(PICTURE_MIN_SIZE, Math.min(PICTURE_MAX_HEIGHT_SCALE, area.height / (PICTURE_HEIGHT * size)));

const getMaxUniformSize = (area: Bounds, widthScale: number, heightScale: number) =>
    Math.max(PICTURE_MIN_SIZE, Math.min(
        PICTURE_MAX_SIZE,
        area.width / (PICTURE_WIDTH * widthScale),
        area.height / (PICTURE_HEIGHT * heightScale)
    ));

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

interface PipDragBarProps {
    bounds: Bounds
    dragArea: Bounds
    menuOpen: boolean
    setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
    resizeHandlesVisible: boolean
    setResizeHandlesVisible: React.Dispatch<React.SetStateAction<boolean>>
}

const PipDragBar = ({
    bounds,
    dragArea,
    menuOpen,
    setMenuOpen,
    resizeHandlesVisible,
    setResizeHandlesVisible
}: PipDragBarProps) => {
    const [{ url, urlEntries, viewMode, visible, size, widthScale, heightScale }, setGlobalState] = useGlobalState();
    const dragStart = useRef<DragStart | null>(null);
    const resizeStart = useRef<ResizeStart | null>(null);

    const stopButtonPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
        event.stopPropagation();
    };

    const stopMenuPointer = (event: React.PointerEvent<HTMLDivElement>) => {
        event.stopPropagation();
    };

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

    const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        resizeStart.current = {
            pointerId: event.pointerId,
            pointerX: event.clientX,
            pointerY: event.clientY,
            size,
            widthScale,
            heightScale,
        };

        setGlobalState(state => ({
            ...state,
            visible: true,
            viewMode: ViewMode.Picture,
            customPosition: {
                x: bounds.x,
                y: bounds.y,
            },
        }));
    };

    const handleResizePointerMove = (mode: ResizeMode) => (event: React.PointerEvent<HTMLDivElement>) => {
        if (!resizeStart.current || resizeStart.current.pointerId !== event.pointerId) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const deltaX = event.clientX - resizeStart.current.pointerX;
        const deltaY = event.clientY - resizeStart.current.pointerY;
        const uniformDelta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;

        setGlobalState(state => ({
            ...state,
            visible: true,
            viewMode: ViewMode.Picture,
            customPosition: {
                x: bounds.x,
                y: bounds.y,
            },
            size: mode == "uniform"
                ? Number(clamp(
                    resizeStart.current!.size + uniformDelta / PICTURE_WIDTH,
                    PICTURE_MIN_SIZE,
                    getMaxUniformSize(dragArea, resizeStart.current!.widthScale, resizeStart.current!.heightScale)
                ).toFixed(2))
                : state.size,
            widthScale: mode == "width"
                ? Number(clamp(
                    resizeStart.current!.widthScale + deltaX / (PICTURE_WIDTH * resizeStart.current!.size),
                    PICTURE_MIN_SIZE,
                    getMaxWidthScale(dragArea, resizeStart.current!.size)
                ).toFixed(2))
                : state.widthScale,
            heightScale: mode == "height"
                ? Number(clamp(
                    resizeStart.current!.heightScale + deltaY / (PICTURE_HEIGHT * resizeStart.current!.size),
                    PICTURE_MIN_SIZE,
                    getMaxHeightScale(dragArea, resizeStart.current!.size)
                ).toFixed(2))
                : state.heightScale,
        }));
    };

    const handleResizePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!resizeStart.current || resizeStart.current.pointerId !== event.pointerId) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        resizeStart.current = null;
    };

    const buttonStyle: React.CSSProperties = {
        width: 28,
        height: dragBarHeight,
        border: 0,
        padding: 0,
        color: '#fff',
        background: 'rgba(255, 255, 255, 0.16)',
        fontSize: 10,
        fontWeight: 700,
        lineHeight: `${dragBarHeight}px`,
        cursor: 'pointer',
        touchAction: 'none',
    };
    const resizeToggleWidth = 28;

    const menuWidth = Math.min(240, Math.max(180, bounds.width));
    const menuButtonStyle: React.CSSProperties = {
        ...buttonStyle,
        marginLeft: 'auto',
    };
    const menuItemStyle: React.CSSProperties = {
        display: 'block',
        width: '100%',
        border: 0,
        padding: '8px 10px',
        color: '#fff',
        background: 'transparent',
        textAlign: 'left',
        fontSize: 13,
        lineHeight: '16px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    };

    return <>
        <div
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
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
            }} />
        <button
            aria-label="Show resize handles"
            onPointerDown={stopButtonPointer}
            onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                setMenuOpen(false);
                setResizeHandlesVisible(visible => !visible);
            }}
            style={{
                ...buttonStyle,
                width: resizeToggleWidth,
                position: 'fixed',
                left: bounds.x,
                top: bounds.y,
                zIndex: 2147483648,
            }}>
            []
        </button>
        <button
            aria-label="Open picture menu"
            onPointerDown={stopButtonPointer}
            onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                setMenuOpen(open => !open);
            }}
            style={{
                ...menuButtonStyle,
                position: 'fixed',
                left: bounds.x + bounds.width - 28,
                top: bounds.y,
                zIndex: 2147483648,
            }}>
            ...
        </button>
        {resizeHandlesVisible && <>
            <div
                aria-label="Resize picture width"
                onPointerDown={handleResizePointerDown}
                onPointerMove={handleResizePointerMove("width")}
                onPointerUp={handleResizePointerEnd}
                onPointerCancel={handleResizePointerEnd}
                style={{
                    position: 'fixed',
                    left: bounds.x + bounds.width - resizeEdgeHandleSize,
                    top: bounds.y + dragBarHeight,
                    width: resizeEdgeHandleSize,
                    height: Math.max(0, bounds.height - dragBarHeight - resizeEdgeHandleSize),
                    zIndex: 2147483648,
                    cursor: 'ew-resize',
                    touchAction: 'none',
                    background: 'rgba(255, 255, 255, 0.18)',
                    boxSizing: 'border-box',
                }} />
            <div
                aria-label="Resize picture height"
                onPointerDown={handleResizePointerDown}
                onPointerMove={handleResizePointerMove("height")}
                onPointerUp={handleResizePointerEnd}
                onPointerCancel={handleResizePointerEnd}
                style={{
                    position: 'fixed',
                    left: bounds.x,
                    top: bounds.y + bounds.height - resizeEdgeHandleSize,
                    width: Math.max(0, bounds.width - resizeEdgeHandleSize),
                    height: resizeEdgeHandleSize,
                    zIndex: 2147483648,
                    cursor: 'ns-resize',
                    touchAction: 'none',
                    background: 'rgba(255, 255, 255, 0.18)',
                    boxSizing: 'border-box',
                }} />
            <div
                aria-label="Resize picture uniformly"
                onPointerDown={handleResizePointerDown}
                onPointerMove={handleResizePointerMove("uniform")}
                onPointerUp={handleResizePointerEnd}
                onPointerCancel={handleResizePointerEnd}
                style={{
                    position: 'fixed',
                    left: bounds.x + bounds.width - resizeEdgeHandleSize,
                    top: bounds.y + bounds.height - resizeEdgeHandleSize,
                    width: resizeEdgeHandleSize,
                    height: resizeEdgeHandleSize,
                    zIndex: 2147483649,
                    cursor: 'nwse-resize',
                    touchAction: 'none',
                    background: 'rgba(255, 255, 255, 0.30)',
                    borderTopLeftRadius: 3,
                    boxSizing: 'border-box',
                }} />
        </>}
        {menuOpen && <div
            onPointerDown={stopMenuPointer}
            style={{
                position: 'fixed',
                left: Math.max(bounds.x, bounds.x + bounds.width - menuWidth),
                top: bounds.y + dragBarHeight,
                width: menuWidth,
                maxHeight: 260,
                overflowY: 'auto',
                zIndex: 2147483648,
                background: 'rgba(20, 20, 24, 0.96)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                boxShadow: '0 8px 18px rgba(0, 0, 0, 0.38)',
                boxSizing: 'border-box',
            }}>
            <button
                onClick={() => {
                    setGlobalState(state => ({
                        ...state,
                        visible: !state.visible
                    }));
                }}
                style={menuItemStyle}>
                {visible ? 'Hide Window' : 'Show Window'}
            </button>
            <button
                onClick={() => {
                    setGlobalState(state => ({
                        ...state,
                        viewMode: viewMode == ViewMode.Expand
                            ? ViewMode.Picture
                            : ViewMode.Expand
                    }));
                    setMenuOpen(false);
                }}
                style={menuItemStyle}>
                {viewMode == ViewMode.Expand ? 'Picture Mode' : 'Expand'}
            </button>
            <button
                onClick={() => {
                    setGlobalState(state => ({
                        ...state,
                        viewMode: ViewMode.Closed
                    }));
                    setMenuOpen(false);
                }}
                style={menuItemStyle}>
                Close Window
            </button>
            {urlEntries.length > 0 && <div
                style={{
                    height: 1,
                    background: 'rgba(255, 255, 255, 0.16)',
                    margin: '4px 0',
                }} />}
            {urlEntries.map(entry => <button
                key={entry.id}
                onClick={() => {
                    setGlobalState(state => ({
                        ...state,
                        visible: true,
                        url: entry.url
                    }));
                    setMenuOpen(false);
                }}
                style={{
                    ...menuItemStyle,
                    background: entry.url === url
                        ? 'rgba(255, 255, 255, 0.16)'
                        : 'transparent',
                }}>
                {entry.note.length > 0 ? entry.note : entry.url}
            </button>)}
        </div>}
    </>;
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
    const [{ viewMode, position, customPosition, size, widthScale, heightScale, dragBarVisible, url, visible }] = useGlobalState();
    const [menuOpen, setMenuOpen] = useState(false);
    const [resizeHandlesVisible, setResizeHandlesVisible] = useState(false);

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
        : 0;

    const dragArea = insetBounds(available, margin);
    const effectiveSize = clamp(size, PICTURE_MIN_SIZE, getMaxUniformSize(dragArea, widthScale, heightScale));
    const effectiveWidthScale = clamp(widthScale, PICTURE_MIN_SIZE, getMaxWidthScale(dragArea, effectiveSize));
    const effectiveHeightScale = clamp(heightScale, PICTURE_MIN_SIZE, getMaxHeightScale(dragArea, effectiveSize));
    const pictureWidth = PICTURE_WIDTH * effectiveSize * effectiveWidthScale;
    const pictureHeight = PICTURE_HEIGHT * effectiveSize * effectiveHeightScale;
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
    const browserBounds = viewMode == ViewMode.Picture && dragBarVisible
        ? {
            x: bounds.x,
            y: bounds.y + dragBarHeight,
            width: Math.max(0, bounds.width - (resizeHandlesVisible ? resizeEdgeHandleSize : 0)),
            height: Math.max(0, bounds.height - dragBarHeight - (resizeHandlesVisible ? resizeEdgeHandleSize : 0))
        }
        : bounds;

    return <>
        <Browser
            url={url}
            visible={visible && !menuOpen}
            {...browserBounds} />
        {(visible || menuOpen) && viewMode == ViewMode.Picture && dragBarVisible && <PipDragBar
            bounds={bounds}
            dragArea={dragArea}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            resizeHandlesVisible={resizeHandlesVisible}
            setResizeHandlesVisible={setResizeHandlesVisible} />}
    </>;
}

export const PipOuter = () => {
    const [{ viewMode }] = useGlobalState();

    if (viewMode == ViewMode.Closed) {
        return null;
    }

    return <Pip />;
}
