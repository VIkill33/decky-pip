import { StateManager } from 'cotton-box';
import { useContext, createContext } from 'react';

import { Position, ViewMode } from './util';
import { useStateValue } from 'cotton-box-react';

export interface UrlEntry {
    id: string
    url: string
    note: string
}

export interface CustomPosition {
    x: number
    y: number
}

export interface State {
    viewMode: ViewMode,
    position: Position
    customPosition: CustomPosition | null
    visible: boolean
    size: number
    dragBarVisible: boolean
    url: string
    urlEntries: UrlEntry[]
}

export const GlobalContext = createContext(new StateManager<State>({} as State));

export const useGlobalState = () => {
    const context = useContext(GlobalContext);
    const state = useStateValue(context);

    const setState = (setter: (state: State) => State) =>
        context.set(setter(context.get()))

    return [state, setState, context] as [State, (setter: (state: State) => State) => void, StateManager<State>];
};
