const fsSync = require("fs");
const fs = require("fs/promises");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = process.cwd();
const packageJson = JSON.parse(
  fsSync.readFileSync(path.join(projectRoot, "package.json"), "utf8")
);
const outputDirName = packageJson?.build?.directories?.output || "release";
const productName = packageJson?.build?.productName || packageJson?.name || "Electron";
const productExeName = `${productName}.exe`;
const unpackedDir = path.join(projectRoot, outputDirName, "win-unpacked");
const prismaClientDir = path.join(projectRoot, "node_modules", ".prisma", "client");
const rootEnvPath = path.join(projectRoot, ".env");
const runtimeEnvPath = path.join(projectRoot, "electron", "runtime.env");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopProductProcessByName() {
  if (process.platform !== "win32") return;

  const result = spawnSync("taskkill", ["/F", "/IM", productExeName, "/T"], {
    stdio: "ignore",
  });

  // taskkill returns non-zero when the process does not exist; ignore that case.
  if (result.error) {
    console.warn("prepare-dist: could not run taskkill:", result.error.message);
  }
}

function stopProcessesFromUnpackedDir() {
  if (process.platform !== "win32") return;

  const normalizedTarget = unpackedDir.replace(/\\/g, "\\\\");
  const script = `
    $target = "${normalizedTarget}".ToLowerInvariant()
    Get-CimInstance Win32_Process |
      Where-Object { $_.ExecutablePath -and $_.ExecutablePath.ToLowerInvariant().StartsWith($target) } |
      ForEach-Object {
        try {
          Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
          Write-Host ("Stopped process PID " + $_.ProcessId + " (" + $_.Name + ")")
        } catch {
          Write-Host ("Failed to stop PID " + $_.ProcessId + ": " + $_.Exception.Message)
        }
      }
  `;

  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { stdio: "inherit" }
  );

  if (result.error) {
    console.warn("prepare-dist: could not query/stop processes:", result.error.message);
  }
}

async function removeUnpackedDirWithRetry() {
  const maxAttempts = 20;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await fs.rm(unpackedDir, { recursive: true, force: true });
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      console.warn(
        `prepare-dist: remove attempt ${attempt}/${maxAttempts} failed: ${error.message}`
      );
    }

    try {
      await fs.access(unpackedDir);
      if (attempt === maxAttempts) {
        throw new Error(`still exists after ${maxAttempts} attempts`);
      }
      await sleep(Math.min(2000, 200 * attempt));
      continue;
    } catch {
      return;
    }
  }
}

async function cleanupPrismaTempFiles() {
  try {
    const entries = await fs.readdir(prismaClientDir, { withFileTypes: true });
    const tempFiles = entries
      .filter((entry) => entry.isFile() && entry.name.includes(".tmp"))
      .map((entry) => entry.name);

    if (tempFiles.length === 0) return;

    await Promise.all(
      tempFiles.map((name) =>
        fs.rm(path.join(prismaClientDir, name), { force: true })
      )
    );

    console.log(`prepare-dist: removed ${tempFiles.length} Prisma temp file(s)`);
  } catch (error) {
    // Optional cleanup, continue packaging if not available.
    console.warn("prepare-dist: prisma temp cleanup skipped:", error.message);
  }
}

async function syncRuntimeEnvFile() {
  try {
    await fs.access(rootEnvPath);
    await fs.copyFile(rootEnvPath, runtimeEnvPath);
    console.log("prepare-dist: synced .env -> electron/runtime.env");
  } catch (error) {
    console.warn("prepare-dist: runtime env sync skipped:", error.message);
  }
}

async function main() {
  await syncRuntimeEnvFile();
  await cleanupPrismaTempFiles();
  stopProductProcessByName();
  stopProcessesFromUnpackedDir();
  await removeUnpackedDirWithRetry();
  console.log(`prepare-dist: ${outputDirName}/win-unpacked is ready`);
}

main().catch((error) => {
  console.error("prepare-dist: failed:", error.message);
  console.error(
    "prepare-dist: close any running app built from win-unpacked, then retry npm run dist."
  );
  process.exit(1);
});
