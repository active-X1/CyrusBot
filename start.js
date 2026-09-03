const { spawn } = require("child_process");
const path = require("path");

const entryFile = path.join(__dirname, "index.js");

function launch() {
  const child = spawn(process.execPath, [entryFile], {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  child.on("error", (error) => {
    console.error("Failed to start CyrusBot:", error.message);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`CyrusBot stopped by signal: ${signal}`);
      return;
    }

    if (code !== 0) {
      console.log(`CyrusBot exited with code ${code}. Restarting...`);
      setTimeout(() => launch(), 2000);
    }
  });
}

launch();
