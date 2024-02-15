import { Command } from "commander";
import DB from "./src/DB";
import { Git } from "./src/models/Git";
const pkg = require("../package.json");  // eslint-disable-line
const cmd = new Command();

cmd.version(pkg.version);

cmd
  .command("git <operation>")
  .option(
    "-i, --id <id>",
    "[operation=add/update/delete/approve] git repository's id"
  )
  .option(
    "-a, --address <address>",
    "[operation=add/update] git repository's address"
  )
  .option("-s, --sha <sha>", "[operation=add/update] git repository's sha hash")
  .action(async (operation: string, cmd) => {
    const db = new DB(false);

    switch (operation) {
    case "add": {
      const git = new Git();

      if (cmd.address && cmd.id) {
        git.address = cmd.address;
        git.id = cmd.id;
      } else {
        console.error(
          "-a, --address <address> and -i, --id <id> flags is required"
        );
        return;
      }

      git.isApproved = true;
      if (cmd.sha) git.sha = cmd.sha;

      const connection = await db.connect();
      const gitRepo = connection.getRepository(Git);
      await gitRepo.save(git);

      console.log("git successfully added:");
      console.log(git);

      break;
    }
    case "update": {
      if (!cmd.id) {
        console.error("-i, --id <id> flag is required");
        return;
      }

      const connection = await db.connect();
      const i = {};

      if (cmd.address) i.address = cmd.address;
      if (cmd.sha) i.sha = cmd.sha;

      await connection
        .createQueryBuilder()
        .update(Git)
        .where("id = :id", { id: cmd.id })
        .set(i)
        .execute();

      console.log("git successfully updated:");
      const gitRepo = connection.getRepository(Git);
      console.log(await gitRepo.findOne(cmd.id));

      break;
    }
    case "approve": {
      if (!cmd.id) {
        console.error("-i, --id <id> flag is required");
        return;
      }

      const connection = await db.connect();
      await connection
        .createQueryBuilder()
        .update(Git)
        .where("id = :id", { id: cmd.id })
        .set({ isApproved: true })
        .execute();

      console.log("git approved");

      break;
    }
    case "delete": {
      if (!cmd.id) {
        console.error("-i, --id <id> flag is required");
        return;
      }

      const connection = await db.connect();
      const gitRepo = connection.getRepository(Git);
      await gitRepo.delete(cmd.id);

      console.log("git successfully deleted");

      break;
    }
    default: {
      console.error(
        "<operation> invalid operation, only support [add/update/delete/approve]"
      );

      break;
    }
    }
    
    await db.close();
  });

cmd.parse(process.argv);
