"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mdLabelMaker", {
    readDisc: () => ipcRenderer.invoke("mdLabelMakerReadDisc"),
    loadDraft: () => ipcRenderer.invoke("mdLabelMakerLoadDraft"),
    saveDraft: (project) => ipcRenderer.invoke("mdLabelMakerSaveDraft", project),
    onDiscardDraft: (callback) => {
        const listener = () => callback();
        ipcRenderer.on("mdLabelMakerDiscardDraft", listener);
        return () => ipcRenderer.removeListener("mdLabelMakerDiscardDraft", listener);
    },
});
