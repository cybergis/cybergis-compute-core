import axios, { AxiosResponse } from "axios";

import { config } from "../../configs/config";
import { GlobusTransferRefreshToken } from "../models/GlobusTransferRefreshToken";
import dataSource from "../utils/DB";
import { GlobusFolder } from "../utils/types";


const baseUrl = "https://transfer.api.globus.org/v0.10";

interface GlobusAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token: string;
  scope: string;
}

export class GlobusTransferUtil {
  private accessToken!: string;
  private time = -1;
  private delay = -1;

  private async init() {
    if (this.accessToken !== undefined && (new Date().getTime() - this.time) <= this.delay) {
      return;
    }

    const refreshTokenRepo = dataSource.getRepository(GlobusTransferRefreshToken);
    const refreshToken = await refreshTokenRepo.findOneBy({
      identity: "apadmana@illinois.edu" // TODO: make this work for other identities
    });

    if (refreshToken === null) {
      throw new Error("HPC config does not specify a valid refresh token identity");
    }

    const data = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken.transferRefreshToken,
      client_id: config.globus_client_id
    });

    const response: AxiosResponse<GlobusAuthResponse> = await axios.post("https://auth.globus.org/v2/oauth2/token", data, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    this.time = new Date().getTime();
    this.delay = response.data.expires_in * 1000;

    this.accessToken = response.data.access_token;
  }

  private async getSubmissionId(): Promise<string> {
    await this.init();

    try {
      const response: AxiosResponse<{ value: string }> = await axios.get(`${baseUrl}/submission_id`, {
        headers: {
          "Authorization": `Bearer ${this.accessToken}`
        }
      });

      if (response.status === 200) {
        return response.data.value;
      }

    } catch (err) {
      console.error("error getting submission id for transfer submission: ", err);
    }

    throw new Error("Something went wrong getting the submission id");
  }

  /**
   * Initializes globus job
   *
   * @static
   * @async
   * @param {GlobusFolder} from - from transfer folder
   * @param {GlobusFolder} to - to transfer folder
   * @param {hpcConfig} hpcConfig - hpcConfiguration
   * @param {string} [label=""] - task label
   * @return {Promise<string>} - taskId
   * @throws {Error} - thrown if globus query status fails
   */
  public async initTransfer(
    from: GlobusFolder,
    to: GlobusFolder,
    label=""
  ): Promise<string> {
    await this.init();

    const data = {
      DATA_TYPE: "transfer",
      submission_id: await this.getSubmissionId(),
      label: (label !== "" ? `${label}_${Math.floor(Math.random() * 1000)}` : undefined),
      source_endpoint: from.endpoint,
      destination_endpoint: to.endpoint,
      DATA: [{
        DATA_TYPE: "transfer_item",
        source_path: from.path,
        destination_path: to.path,
        recursive: true
      }]
    };

    try {
      const response: AxiosResponse<{ task_id: string }> = await axios.post(`${baseUrl}/transfer`, data, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.accessToken}`
        }
      });

      if (response.status !== 200 && response.status !== 201) {
        console.error("Failed to submit transfer task: status code ", response.status);
      } else {
        return response.data.task_id;
      }
    } catch (err) {
      console.error("Error submitting transfer task", err);
      throw err;
    }

    throw new Error("Something went wrong initializing globus transfer");
  }

  public async monitorTransfer(taskId: string): Promise<string> {
    await this.init();

    let tryAgain = true;

    try {
      while (true) {  // eslint-disable-line no-constant-condition
        const response: AxiosResponse<{ status: string }> = await axios.get(`${baseUrl}/task/${taskId}`, {
          headers: {
            "Authorization": `Bearer ${this.accessToken}`
          }
        });
  
        if (response.status === 200) {
          if (response.data.status === "SUCCEEDED" || response.data.status === "FAILED") {
            return response.data.status;
          } else {
            await new Promise(r => setTimeout(r, 2000));
          }
        } else if (tryAgain) {
          await this.init();
          tryAgain = false;
        } else {
          console.error("Failed to get task, status code: ", response.status);
          break;
        }
      }
      

    } catch (err) {
      console.error("Error getting transfer task status: ", err);
    }

    throw new Error("Something went wrong monitoring transfer");
  }

  public async queryTransferStatus(taskId: string): Promise<string> {
    await this.init();

    try {
      const response: AxiosResponse<{ status: string }> = await axios.get(`${baseUrl}/task/${taskId}`, {
        headers: {
          "Authorization": `Bearer ${this.accessToken}`
        }
      });
  
      if (response.status === 200) {
        return response.data.status;
      } else {
        console.error("Failed to get task, status code: ", response.status);
      }
    } catch (err) {
      console.error("Error getting transfer task status: ", err);
      throw err;
    }

    throw new Error("Something went wrong querying transfer status");
  }

  private escape(username: string, escapeChar="_", safe=new Set("abcdefghijklmnopqrstuvwxyz0123456789")) {
    const escapedUsername: string[] = [];

    for (const char of username) {
      if (safe.has(char)) {
        escapedUsername.push(char);
      } else {
        for (const byte of Buffer.from(char, "utf8")) {
          escapedUsername.push(escapeChar);
          escapedUsername.push(byte.toString(16).toUpperCase());
        }
      }
    }
    return escapedUsername.join("");
  }

  public mapUsername(initial_username: string, mapping_func: string | null) {
    if (mapping_func === "iguide-mapping") {
      return `iguide-claim-${this.escape(initial_username, "-").toLowerCase()}`;
    } else {
      return this.escape(initial_username);
    }
  }
}

export const GlobusClient = new GlobusTransferUtil();