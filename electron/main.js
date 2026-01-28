const { app, BrowserWindow } = require("electron");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    title: "ClinicFlow",
    webPreferences: {
      contextIsolation: true
    }
  });

  // 👇 直接加载你已经稳定的网页
  win.loadURL("https://stellacxy0208.github.io/codesearching/admin/");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
