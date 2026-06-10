import { mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cwd = process.cwd();
const devVarFiles = (await readdir(cwd)).filter(
  (file) => file === ".dev.vars" || file.startsWith(".dev.vars.")
);
const tempDir = await mkdtemp(join(tmpdir(), "teampitch-build-vars-"));
const movedFiles: Array<{ from: string; to: string }> = [];

try {
  for (const file of devVarFiles) {
    const from = join(cwd, file);
    const to = join(tempDir, file);
    await rename(from, to);
    movedFiles.push({ from, to });
  }

  const build = Bun.spawn(["bun", "x", "vite", "build"], {
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit"
  });
  const code = await build.exited;
  if (code !== 0) process.exit(code);
} finally {
  for (const { from, to } of movedFiles.reverse()) {
    await rename(to, from).catch(() => undefined);
  }

  await rm(tempDir, { force: true, recursive: true });
}
