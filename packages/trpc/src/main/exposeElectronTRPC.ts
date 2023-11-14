import { contextBridge, ipcRenderer } from "electron";
import type { TRPCResponseMessage } from "@trpc/server/rpc";

import { ELECTRON_TRPC_CHANNEL } from "../constants";
import type { RendererGlobalElectronTRPC } from "../types";

export const exposeElectronTRPC = () => {
  const electronTRPC: RendererGlobalElectronTRPC = {
    sendMessage: (operation) =>
      ipcRenderer.send(ELECTRON_TRPC_CHANNEL, operation),
    onMessage: (callback) =>
      ipcRenderer.on(ELECTRON_TRPC_CHANNEL, (_event, args) =>
        callback(args as TRPCResponseMessage),
      ),
  };
  contextBridge.exposeInMainWorld("electronTRPC", electronTRPC);
};
