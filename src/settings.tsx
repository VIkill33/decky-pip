import {
    PanelSection,
    PanelSectionRow,
    DropdownItem,
    SliderField,
    showModal,
    ButtonItem,
    ToggleField
} from "@decky/ui";
import { useEffect } from "react";
import { FaEdit } from "react-icons/fa";

import { Position, ViewMode } from "./util";
import { useGlobalState } from "./globalState";
import { UrlModalWithState } from "./urlModal";

const addAddressAction = "__add_address__";
const removeCurrentAddressAction = "__remove_current_address__";

export const Settings = () => {
    const [{ viewMode, position, customPosition, margin, url, urlEntries, size }, setGlobalState, stateContext] = useGlobalState();

    useEffect(() => {
        setGlobalState(state => ({
            ...state,
            visible: true,
            viewMode: state.viewMode == ViewMode.Closed
                ? ViewMode.Picture
                : state.viewMode
        }));
    }, []);

    const positionOptions = [
        { label: 'Top Left', data: Position.TopLeft },
        { label: 'Top', data: Position.Top },
        { label: 'Top Right', data: Position.TopRight },
        { label: 'Right', data: Position.Right },
        { label: 'Bottom Right', data: Position.BottomRight },
        { label: 'Bottom', data: Position.Bottom },
        { label: 'Bottom Left', data: Position.BottomLeft },
        { label: 'Left', data: Position.Left },
    ];

    const currentUrlEntry = urlEntries.find(entry => entry.url === url);
    const urlOptions = [
        {
            label: '+ Add Address',
            data: addAddressAction
        },
        ...urlEntries.map(entry => ({
            label: entry.note.length > 0
                ? `${entry.note}: ${entry.url}`
                : entry.url,
            data: entry.id
        })),
        ...(currentUrlEntry && urlEntries.length > 1
            ? [{
                label: 'Remove Current Address',
                data: removeCurrentAddressAction
            }]
            : [])
    ];

    return <>
        <PanelSection>
            {viewMode == ViewMode.Closed && <>
                <PanelSectionRow>
                    <ButtonItem
                        bottomSeparator="none"
                        layout="below"
                        onClick={() => setGlobalState(state => ({
                            ...state,
                            viewMode: ViewMode.Picture
                        }))}>
                        Open
                    </ButtonItem>
                </PanelSectionRow>
            </>}
            {viewMode != ViewMode.Closed && <>
                <PanelSectionRow>
                    <ButtonItem
                        label='Address'
                        layout="below"
                        onClick={() => showModal(<UrlModalWithState value={stateContext} mode="edit" />)}>
                        <div style={{ display: 'flex' }}>
                            <FaEdit />
                            &nbsp;&nbsp;
                            <div style={{ maxWidth: 180, textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                {currentUrlEntry?.note.length
                                    ? currentUrlEntry.note
                                    : url}
                            </div>
                        </div>
                    </ButtonItem>
                </PanelSectionRow>
                <PanelSectionRow>
                    <DropdownItem
                        label='Saved Address'
                        selectedOption={currentUrlEntry?.id ?? url}
                        rgOptions={urlOptions}
                        onChange={option => {
                            if (option.data === addAddressAction) {
                                showModal(<UrlModalWithState value={stateContext} mode="add" />);
                                return;
                            }

                            if (option.data === removeCurrentAddressAction && currentUrlEntry) {
                                setGlobalState(state => {
                                    const nextEntries = state.urlEntries.filter(entry => entry.id !== currentUrlEntry.id);
                                    const nextUrl = nextEntries[0]?.url ?? state.url;

                                    return {
                                        ...state,
                                        visible: true,
                                        url: nextUrl,
                                        urlEntries: nextEntries
                                    };
                                });
                                return;
                            }

                            const entry = urlEntries.find(({ id }) => id === option.data);
                            if (!entry) {
                                return;
                            }

                            setGlobalState(state => ({
                                ...state,
                                visible: true,
                                url: entry.url
                            }));
                        }} />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ToggleField
                        label='Expand'
                        checked={viewMode == ViewMode.Expand}
                        onChange={checked => {
                            setGlobalState(state => ({
                                ...state,
                                viewMode: checked
                                    ? ViewMode.Expand
                                    : ViewMode.Picture
                            }))
                        }} />
                </PanelSectionRow>
            </>}
            {viewMode == ViewMode.Picture && <>
                <PanelSectionRow>
                    <DropdownItem
                        label='View'
                        selectedOption={position}
                        rgOptions={positionOptions}
                        onMenuOpened={() =>
                            setGlobalState(state => ({
                                ...state,
                                visible: false
                            }))}
                        onChange={option =>
                            setGlobalState(state => ({
                                ...state,
                                visible: true,
                                position: option.data,
                                customPosition: null,
                                viewMode: ViewMode.Picture
                            }))} />
                </PanelSectionRow>
                {customPosition && <>
                    <PanelSectionRow>
                        <ButtonItem
                            bottomSeparator="none"
                            layout="below"
                            onClick={() => setGlobalState(state => ({
                                ...state,
                                customPosition: null,
                                visible: true,
                                viewMode: ViewMode.Picture
                            }))}>
                            Reset Dragged Position
                        </ButtonItem>
                    </PanelSectionRow>
                </>}
                <PanelSectionRow>
                    <SliderField
                        label='Size'
                        value={size}
                        onChange={size =>
                            setGlobalState(state => ({
                                ...state,
                                size,
                                visible: true,
                                viewMode: ViewMode.Picture
                            }))}
                        min={0.50}
                        max={1.60}
                        step={0.01} />
                </PanelSectionRow>
                <PanelSectionRow>
                    <SliderField
                        label='Margin'
                        value={margin}
                        onChange={margin =>
                            setGlobalState(state => ({
                                ...state,
                                margin,
                                visible: true,
                                viewMode: ViewMode.Picture
                            }))}
                        min={0}
                        max={60}
                        step={15}
                        notchCount={3}
                        notchTicksVisible={true}
                        notchLabels={[
                            { label: "S", notchIndex: 0, value: 0 },
                            { label: "M", notchIndex: 1, value: 30 },
                            { label: "L", notchIndex: 2, value: 60 },
                        ]} />
                </PanelSectionRow>
            </>}
            {viewMode != ViewMode.Closed && <>
                <PanelSectionRow>
                    <ButtonItem
                        bottomSeparator="none"
                        layout="below"
                        onClick={() => setGlobalState(state => ({
                            ...state,
                            viewMode: ViewMode.Closed
                        }))}>
                        Close
                    </ButtonItem>
                </PanelSectionRow>
            </>}
        </PanelSection>
    </>;
};
