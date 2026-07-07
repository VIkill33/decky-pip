import React from "react";
import { StateManager } from "cotton-box";
import { ModalRootProps } from "@decky/ui";

import { State, GlobalContext } from "./globalState";

interface ModalContext extends ModalRootProps {
    value: StateManager<State>
}

export const modalWithState = <T extends ModalRootProps>(Component: React.FC<T>) => {
    return ({ value, ...props }: T & ModalContext) =>
        <GlobalContext.Provider value={value}>
            <Component {...props as T} />
        </GlobalContext.Provider>;
}
