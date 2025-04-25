
import { spawn, SpawnOptionsWithoutStdio } from "child_process";

export async function exec(
  command: string,
  options: SpawnOptionsWithoutStdio
): Promise<{ stdout: string, stderr: string }> {
  return new Promise((resolve, reject) => {
    console.log("executing command", command);
    const child = spawn(command, { shell: true, ...options });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data;
    });

    child.stderr.on("data", (data) => {
      stderr += data;
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Exec failed with ${err.toString()}`));
    });

    console.log("executed command", command);
  });
}

export async function rm(
  path: string
): Promise<string | null> {
  console.log("removing path", path);
  const out = await exec(`rm -rf ${path};`, {});
  console.log("removed path", path);
  return out.stdout;
}