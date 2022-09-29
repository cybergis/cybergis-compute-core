import Helper from "./Helper";
import axios from "axios";
import * as path from "path";
import { jupyterGlobusMap } from "../configs/config"; 

declare type decodedToken = {
  host: string;
  token: string;
};

class JupyterHub {
  private basePath = "/hub/api";

  public async getUsername(token: string) {
    var t = this._decodeToken(token);
    const protocols = ["https", "http"];
    var hosts = Object.keys(JSON.parse(JSON.stringify(jupyterGlobusMap)));
    var flag = false;
    for (var j in hosts) {
      if (t.host == hosts[j]) {
	flag = true;
      }
    }
    if (!flag) {
      throw new Error("Cannot find jupyterhubHost in whitelist");
    }
    var user = undefined;
    for (var i in protocols) {
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

  public async getHost(token: string) {
    var t = this._decodeToken(token);
    return t.host;
  }

  private _decodeToken(target: string): decodedToken {
    var t = Helper.btoa(target);
    var i = t.split("@");
    if (i.length != 2) {
      throw new Error("JupyterHub Token is incorrectly formatted ");
    }
    return {
      host: i[0],
      token: i[1],
    };
  }
}

export default JupyterHub;
