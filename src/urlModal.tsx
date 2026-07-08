import {
    TextField,
    ConfirmModal,
    ModalRootProps
} from "@decky/ui";
import { useEffect, useRef, useState } from "react";

import { modalWithState } from "./modal";
import { useGlobalState } from "./globalState";

const createUrlEntryId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

interface UrlModalProps extends ModalRootProps {
    mode?: "add" | "edit"
}

export const UrlModal = ({ mode = "edit", ...props }: UrlModalProps) => {
    const [{ url, urlEntries, visible }, setGlobalState] = useGlobalState();
    const previousVisible = useRef(visible);
    const currentEntry = mode == "edit"
        ? urlEntries.find(entry => entry.url === url)
        : null;
    const [field, setField] = useState(mode == "edit" ? url : "");
    const [note, setNote] = useState(currentEntry?.note ?? "");

    useEffect(() => {
        setGlobalState(state => ({
            ...state,
            visible: false
        }));

        return () => setGlobalState(state => ({
            ...state,
            visible: previousVisible.current
        }));
    }, [])

    return <ConfirmModal
        {...props}
        strTitle={mode == "add" ? "Add Address" : "Address"}
        onOK={() => {
            const nextUrl = field.trim();
            const nextNote = note.trim();

            if (nextUrl.length === 0) {
                setGlobalState(state => ({
                    ...state,
                    visible: previousVisible.current
                }));
                return;
            }

            setGlobalState(state => ({
                ...state,
                visible: previousVisible.current,
                url: nextUrl,
                urlEntries: state.urlEntries.some(entry => entry.url === nextUrl)
                    ? state.urlEntries.map(entry => entry.url === nextUrl
                        ? {
                            ...entry,
                            note: nextNote
                        }
                        : entry)
                    : [
                        ...state.urlEntries,
                        {
                            id: createUrlEntryId(),
                            url: nextUrl,
                            note: nextNote
                        }
                    ]
            }));
        }}
        onCancel={() => {
            setGlobalState(state => ({
                ...state,
                visible: previousVisible.current
            }))
        }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
                <div>URL</div>
                <TextField
                    value={field}
                    onChange={e => setField(e.target.value)} />
            </div>
            <div>
                <div>Note</div>
                <TextField
                    value={note}
                    onChange={e => setNote(e.target.value)} />
            </div>
        </div>
    </ConfirmModal>;
}

export const UrlModalWithState = modalWithState(UrlModal);
