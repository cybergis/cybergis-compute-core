import Helper from "./Helper";
import axios from "axios";
import * as path from "path";
import { jupyterGlobusMap } from "../configs/config";

declare type decodedToken = {
  host: string;
  token: string;
};

/**
 * Handles interfacing with JupyterHub. 
 */
class JupyterHub {

  private basePath = "/hub/api";

  /**
   * Returns the username for a given jupyterHub authorization token.
   *
   * @param {string} token the token for authorization to the jupterHub host
   * @throws {Error} jupyterhubHost must be in whitelist
   * @return {Promise<string>} username
   */
  public async getUsername(token: string): Promise<string> {
    const t = this._decodeToken(token);
    const protocols = ["https", "http"];
    const hosts = Object.keys(JSON.parse(JSON.stringify(jupyterGlobusMap)));
    let flag = false;

    for (const j in hosts) {
      if (t.host === hosts[j]) {
        flag = true;
      }
    }

    if (!flag) {
      throw new Error("Cannot find jupyterhubHost in whitelist");
    }

    let user: string = undefined;
    for (const i in protocols) {
      const protocol = protocols[i];
      try {
        const res = await axios.get(
          `${protocol}://${path.join(t.host, this.basePath, "/user")}`,
          {
            headers: { Authorization: `token ${t.token}` },
          }
        );
        user = `${res.data.name}@${t.host}`;
        break;
      } catch {}
    }
    
    return user;
  }

  /**
   * Gets the host associated with a token. Unused. 
   *
   * @param {string} token
   * @return {string} 
   */
  public async getHost(token: string): Promise<string> {
    const t = this._decodeToken(token);
    return t.host;
  }

  /**
   * Decodes an authorization token.
   *
   * @private
   * @param {string} target authorization token
   * @throws {Error} thrown if jupyterHub token incorrectly formatted -- unable to parse correctly
   * @return {decodedToken} info relating to the host associated with the token
   */
  private _decodeToken(target: string): decodedToken {
    const t = Helper.btoa(target); // base 64 to binary
    const i = t.split("@");

    if (i.length !== 2) {
      throw new Error("JupyterHub Token is incorrectly formatted ");
    }
    
    return {
      host: i[0],
      token: i[1],
    };
  }
}

export default JupyterHub;
