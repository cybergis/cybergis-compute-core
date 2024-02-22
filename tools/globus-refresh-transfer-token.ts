import { config, hpcConfigMap } from "../configs/config";
import DB from "../src/DB";
import PythonUtil from "../src/lib/PythonUtil";
import { GlobusTransferRefreshToken } from "../src/models/GlobusTransferRefreshToken";

const main = async () => {
  const db = new DB(false);

  const identities: string[] = [];
  for (const i in hpcConfigMap) {
    if (hpcConfigMap[i].globus) {
      if (!(hpcConfigMap[i].globus!.identity in identities)) {
        identities.push(hpcConfigMap[i].globus!.identity);
      }
    }
  }

  const connection = await db.connect();

  let counter = 0;
  for (const identity of identities) {
    if (counter > 0)
      console.log(
        "⚠️ please logout of globus before logging into a new identity"
      );
    console.log(`refreshing transfer refresh token for ${identity}...`);

    const out = await PythonUtil.runInteractive(
      "globus_refresh_transfer_token.py",
      [config.globus_client_id],
      ["transfer_refresh_token"]
    );

    if (out.transfer_refresh_token) {
      const globusTransferRefreshTokenRepo = connection.getRepository(
        GlobusTransferRefreshToken
      );
      const g = new GlobusTransferRefreshToken();
      g.identity = identity;
      g.transferRefreshToken = out.transfer_refresh_token as string;
      await globusTransferRefreshTokenRepo.save(g);
    }

    counter++;
  }

  await db.close();
};

main();
