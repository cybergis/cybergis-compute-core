import { Command } from "commander";

import { Git } from "./src/models/Git";
import dataSource from "./src/utils/DB";

const pkg: {version: string} = require("../package.json");  // eslint-disable-line
const cmd = new Command();

interface CommandOptions {
  id?: string;
  address?: string;
  sha?: string;
}

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
  .action(async (operation: string, cmd: CommandOptions) => {
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

      const gitRepo = dataSource.getRepository(Git);
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

      const i: { address?: string, sha?: string } = {};

      if (cmd.address) i.address = cmd.address;
      if (cmd.sha) i.sha = cmd.sha;

      await dataSource
        .createQueryBuilder()
        .update(Git)
        .where("id = :id", { id: cmd.id })
        .set(i)
        .execute();

      console.log("git successfully updated:");
      const gitRepo = dataSource.getRepository(Git);
      console.log(await gitRepo.findOneBy({ id: cmd.id }));

      break;
    }
    case "approve": {
      if (!cmd.id) {
        console.error("-i, --id <id> flag is required");
        return;
      }
    
      await dataSource
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

      const gitRepo = dataSource.getRepository(Git);
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
    
    await dataSource.destroy();
  });

cmd.parse(process.argv);
