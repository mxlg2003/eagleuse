import cp from "child_process";
import { join } from "path";
import { app, BrowserWindow, dialog, shell } from "electron";
import { createIPCHandler } from "electron-trpc/main";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import getPort, { portNumbers } from "get-port";
import ip from "ip";

import { router } from "@rao-pics/api";
import { DEFAULT_THEME } from "@rao-pics/constant";
import { IS_DEV } from "@rao-pics/constant/server";
import { createDbPath } from "@rao-pics/db";
import { startStaticServer, stopStaticServer } from "@rao-pics/static-server";

import icon from "../../resources/icon.png?asset";
import { createCustomIPCHandle } from "./src/ipc";

const caller = router.createCaller({});

const controller = new AbortController();
const { signal } = controller;

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 768,
    height: 450,
    show: false,
    autoHideMenuBar: true,
    resizable: false,
    titleBarStyle: "hidden",
    frame: false,
    transparent: true,
    trafficLightPosition: {
      y: 16,
      x: 12,
    },
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
    void caller.config.upsert({
      ip: ip.address(),
    });
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: "deny" };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (IS_DEV && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    // 创建 db.sqlite 文件
    createDbPath(join(process.resourcesPath, "extraResources/db.sqlite"));
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  createIPCHandler({ router, windows: [mainWindow] });

  createCustomIPCHandle();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app
  .whenReady()
  .then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId("com.rao-pics");

    Promise.all([caller.library.get(), caller.config.get()])
      .then(async (res) => {
        const [library, config] = res;
        // 启动静态资源服务器
        if (library?.path && config?.staticServerPort) {
          void startStaticServer(
            join(library.path, "images"),
            config.staticServerPort,
          );
        }

        // 启动主题服务器
        const themeServerPort =
          config?.themeServerPort ??
          (await getPort({ port: portNumbers(9301, 9500) }));

        if (IS_DEV) {
          // TODO: xxx
          // dialog.showErrorBox("IS_DEV", IS_DEV + "");
        } else {
          const child = cp.fork(
            join(
              process.resourcesPath,
              "themes",
              config?.theme ?? DEFAULT_THEME,
              "server.js",
            ),
            ["child"],
            {
              env: { PORT: themeServerPort.toString(), HOSTNAME: "0.0.0.0" },
              signal,
            },
          );

          child.on("error", (e) => {
            dialog.showErrorBox("child process fork error", e.message);
            controller.abort();
          });
        }

        void caller.config.upsert({
          themeServerPort,
        });
      })
      .catch((e) => {
        throw e;
      });

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on("browser-window-created", (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    createWindow();

    app.on("activate", function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((e) => {
    throw e;
  });

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("quit", () => {
  // 关闭子进程
  controller.abort();
  // 关闭静态服务器
  stopStaticServer();
});

// Catch all error.
process.on("uncaughtException", (error) => {
  dialog.showErrorBox("Error", error.message);
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
