import { join } from "path";
import { app, Menu, nativeImage, nativeTheme, shell, Tray } from "electron";

import globalApp from "../global";
import { restoreOrCreateWindow } from "../mainWindow";

const buildResourcesPath = app.isPackaged ? join(process.resourcesPath, "buildResources") : join(__dirname, "../../buildResources");

export const getIcon = (name: string) => join(buildResourcesPath, "tray", `${name}-${nativeTheme.shouldUseDarkColors ? "light" : "dark"}.png`);

/**
 * 系统托盘
 * @returns {Tray}
 */
const createTray = () => {
  const icon = nativeImage.createFromPath(join("buildResources", "tray", "iconTemplate@5x.png"));
  const download = nativeImage.createFromPath(join("buildResources", "tray", "downloadTemplate@2x.png"));
  const todo = nativeImage.createFromPath(join("buildResources", "tray", "todoTemplate@2x.png"));
  const twitter = nativeImage.createFromPath(join("buildResources", "tray", "twitterTemplate@2x.png"));

  // 托盘图标
  const tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { type: "separator" },
    {
      label: "下载页面",
      type: "normal",
      icon: download,
      click: () => {
        void shell.openExternal("https://github.com/rao-pics/core/releases");
      },
    },
    {
      label: "最新动态",
      icon: twitter,
      type: "normal",
      click: () => {
        void shell.openExternal("https://twitter.com/meetqy");
      },
    },
    {
      label: "开发进度",
      icon: todo,
      type: "normal",
      click: () => {
        void shell.openExternal("https://github.com/orgs/rao-pics/projects/1/views/1");
      },
    },
    { type: "separator" },
    {
      label: "退出",
      type: "normal",
      click: () => {
        globalApp.isQuite = true;
        app.quit();
      },
    },
  ]);

  tray.on("click", (e) => {
    if (e.altKey) {
      tray.popUpContextMenu(contextMenu);
    } else {
      void restoreOrCreateWindow().then((window) => {
        window.show();
        window.focus();
      });
    }
  });

  tray.on("right-click", () => {
    tray.popUpContextMenu(contextMenu);
  });

  // /** 监听 dark/light */
  // nativeTheme.on("updated", () => {
  //   tray.setImage(icon);
  //   tray.setContextMenu(contextMenu);
  // });

  return tray;
};

export default createTray;
