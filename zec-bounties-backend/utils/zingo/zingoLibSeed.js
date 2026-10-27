const { spawn } = require("child_process");
const { existsSync, readdirSync } = require("fs");

const ANSI = /\u001b\[[0-9;]*m/g;

async function executeZingoCliSeed(params, seed, birthday, timeout = 180000) {
  const zingoPath = process.env.ZINGO_CLI;
  if (!zingoPath || !existsSync(zingoPath)) {
    throw new Error(`zingo-cli not found at ${zingoPath}`);
  }
  if (typeof seed !== "string" || !seed.trim()) {
    throw new Error("Seed phrase required");
  }

  const dataDir = params.dataDir || "/mnt/d/zaino/zebra/.cache/zaino";

  const args = [
    "--chain",
    params.chain || "mainnet",
    "--server",
    params.serverUrl || "http://127.0.0.1:8137",
    "--data-dir",
    dataDir,
    "--birthday",
    String(birthday || 0),
  ];

  return new Promise((resolve, reject) => {
    // stdin must stay open: the REPL exits on EOF.
    // ZINGO_SEED (zingolib 6.0.0+) keeps the seed out of the process list.
    const proc = spawn(zingoPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ZINGO_SEED: seed },
    });

    let stdout = "";
    let stderr = "";
    let quitSent = false;
    let settled = false;

    const sendQuit = () => {
      if (quitSent || proc.stdin.destroyed) return;
      quitSent = true;
      proc.stdin.write("quit\n");
    };

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(fallback);
      fn(value);
    };

    // Give the CLI a chance to launch sync/save, then quit so it saves.
    const maybeReady = () => {
      const all = (stdout + stderr).replace(ANSI, "");
      if (/Launching save task/i.test(all)) setTimeout(sendQuit, 2000);
    };

test("wallet recovery output is never logged", async () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(" "));

  const childProcess = require("node:child_process");
  const originalSpawn = childProcess.spawn;
  childProcess.spawn = () => createFakeProc();

  const originalExists = fs.existsSync;
  fs.existsSync = () => true;

  const ZingoProcess = require("../utils/zingo/ZingoProcess");
  const proc = new ZingoProcess({
    zingoPath: "/fake/zingo",
    chain: "mainnet",
    serverUrl: "http://127.0.0.1:8137",
    dataDir: "/tmp",
  });

  const seed =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  proc.proc.stdout.emit("data", Buffer.from(`{"seed":"${seed}"}\n`));

  await new Promise((r) => setImmediate(r));

  console.log = originalLog;
  childProcess.spawn = originalSpawn;
  fs.existsSync = originalExists;

  assert.ok(
    !logs.join("\n").includes(seed),
    "seed phrase must not appear in logs",
  );
});
