

import { connectionReady, SSHConnector } from "../connectors";
import { ConnectorError } from "../definitions";

import * as Helper from "./Helper";


export async function download(from: string, to: string, hpc: string): Promise<void> {
  console.log("downloading file from", from, "to", to);
  if (to === undefined)
    throw new ConnectorError("please init input file first");

  console.log("start download");

  if (!connectionReady(hpc)) {
    throw new ConnectorError("unable to connect to HPC");
  }

  try {
    const connector = new SSHConnector(hpc);

    await connector.download(from, to);
  } catch (e) {
    const error = `unable to get file from ${from} to ${to}: ` + Helper.assertError(e).toString();
    throw new ConnectorError(error);
  }
  console.log("downloaded file from", from, "to", to);
}

// export async function upload()
