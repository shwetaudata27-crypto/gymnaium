const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    mainWindow.loadURL("http://localhost:3000");
  }
}

function startBackend() {
  const serverPath = path.join(__dirname, "../server/index.js");
  
  // Try to find node executable
  let nodeExe = "node";
  
  // On Windows, check if node is available in common locations
  if (process.platform === "win32") {
    const commonPaths = [
      "C:\\Program Files\\nodejs\\node.exe",
      "C:\\Program Files (x86)\\nodejs\\node.exe",
      process.env.NODEJS_HOME ? path.join(process.env.NODEJS_HOME, "node.exe") : null,
    ].filter(Boolean);
    
    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        nodeExe = p;
        break;
      }
    }
  }

  serverProcess = spawn(nodeExe, [serverPath], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  serverProcess.stdout?.on("data", (data) => {
    console.log(`[backend]: ${data}`);
  });

  serverProcess.stderr?.on("data", (data) => {
    console.error(`[backend error]: ${data}`);
  });

  serverProcess.on("error", (err) => {
    console.error("[backend] failed to start:", err);
  });

  serverProcess.on("close", (code) => {
    console.log(`[backend] process exited with code ${code}`);
  });
}

app.whenReady().then(() => {
  if (app.isPackaged) {
    startBackend();

    setTimeout(() => {
      createWindow();
    }, 3000);
  } else {
    createWindow();
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});