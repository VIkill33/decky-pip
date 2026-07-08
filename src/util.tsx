export const SCREEN_WIDTH = 854;
export const SCREEN_HEIGHT = 534;
export const MARGIN = 20;
export const PICTURE_WIDTH = SCREEN_WIDTH * 0.4;
export const PICTURE_HEIGHT = PICTURE_WIDTH * (1.0 / 1.85);
export const PICTURE_MIN_SIZE = 0.50;
export const PICTURE_MAX_SIZE = 1.60;
export const PICTURE_MAX_WIDTH_SCALE = SCREEN_WIDTH / PICTURE_WIDTH;
export const PICTURE_MAX_HEIGHT_SCALE = SCREEN_HEIGHT / PICTURE_HEIGHT;

export enum ViewMode {
    Expand = 1,
    Picture = 2,
    Closed = 3
}

export enum Position {
    Top,
    TopRight,
    Right,
    BottomRight,
    Bottom,
    BottomLeft,
    Left,
    TopLeft
}
