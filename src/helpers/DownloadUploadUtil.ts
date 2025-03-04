

import { SSHConnector } from "../connectors";
import { ConnectorError } from "../definitions";

import * as Helper from "./Helper";


export async function download(from: string, to: string, hpc: string): Promise<void> {
  console.log("downloading file from", from, "to", to);
  if (to === undefined)
    throw new ConnectorError("please init input file first");

  console.log("start download");

  try {
    const connector = new BaseConnector(hpc);

    await connector.download(from, to);
  } catch (e) {
    const error = `unable to get file from ${from} to ${to}: ` + Helper.assertError(e).toString();
    throw new ConnectorError(error);
  }
  console.log("downloaded file from", from, "to", to);
}

