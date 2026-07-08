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

import { PICTURE_MAX_SIZE, PICTURE_MIN_SIZE, ViewMode } from "./util";
import { useGlobalState } from "./globalState";
import { UrlModalWithState } from "./urlModal";

const addAddressAction = "__add_address__";
const removeCurrentAddressAction = "__remove_current_address__";

export const Settings = () => {
    const [{ viewMode, dragBarVisible, url, urlEntries, size, visible }, setGlobalState, stateContext] = useGlobalState();

    useEffect(() => {
        setGlobalState(state => state.viewMode == ViewMode.Closed
            ? {
                ...state,
                visible: true,
                viewMode: ViewMode.Picture
            }
            : state);
    }, []);

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
                            visible: true,
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
                                url: entry.url
                            }));
                        }} />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ToggleField
                        label='Show Window'
                        checked={visible}
                        onChange={visible => {
                            setGlobalState(state => ({
                                ...state,
                                visible
                            }))
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
                    <ToggleField
                        label='Drag Bar'
                        checked={dragBarVisible}
                        onChange={dragBarVisible => {
                            setGlobalState(state => ({
                                ...state,
                                dragBarVisible,
                                viewMode: ViewMode.Picture
                            }))
                        }} />
                </PanelSectionRow>
                <PanelSectionRow>
                    <SliderField
                        label='Size'
                        value={size}
                        onChange={size =>
                            setGlobalState(state => ({
                                ...state,
                                size,
                                viewMode: ViewMode.Picture
                            }))}
                        min={PICTURE_MIN_SIZE}
                        max={PICTURE_MAX_SIZE}
                        step={0.01} />
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
