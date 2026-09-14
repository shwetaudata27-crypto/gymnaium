const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  app: "US Gymnasium",
});