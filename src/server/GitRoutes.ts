import express = require("express");

import GitUtil from "../helpers/GitUtil";
import * as Helper from "../helpers/Helper";
import { Git } from "../models/Git";
import dataSource from "../utils/DB";
import { executableManifest } from "../utils/types";

const gitRouter = express.Router();

const parseGit = async (dest: Git[]) => {
  const out: Record<string, executableManifest> = {};
  for (const d of dest) {
    try {
      // refresh git (updating the database), then get the manifest.json from the repo and append it
      // await GitUtil.refreshGit(d);
    
      out[d.id] = await GitUtil.getExecutableManifest(d);
    } catch (e) {  // pulling/cloning went wrong
      console.error(`cannot clone git: ${Helper.assertError(e).toString()}`);
    }
  }
  return out;
};

  
/**
   * @openapi
   * /git:
   *  get:
   *      description: Returns collection of acceptable git jobs (Authentication NOT REQUIRED)
   *      responses:
   *          200:
   *              description: Returns JSON dictionary of git jobs including specs for each job
   */
gitRouter.get("/", async function (req, res) {
  const gits = await dataSource
    .getRepository(Git)
    .find({ order: { id: "DESC" } });

  res.json({ git: await parseGit(gits) });
});

gitRouter.get("/:model_name", async (req, res) => {
  const git = await dataSource.getRepository(Git).findOneBy({ id: req.params.model_name });

  if (git === null) {
    res.status(401).json({
      error: "invalid access -- model not found"
    });

    return;
  }

  res.json({ git: await parseGit([git]) });
});

// /**
//  * @openapi
//  * /git/refresh/:id:
//  *  put:
//  *      description: Refreshes a given git repo (with id :id) on the specified HPC, or all HPCs if HPC is not provided
//  *      responses:
//  *          200:
//  *              description: Refresh completed successfully
//  *          401:
//  *              description: Cache refresh failed
//  *          402:
//  *              description: Request body malformed
//  *          404:
//  *              description: Provided git id was not found
//  */
// app.put("/refresh/:id", async function (req, res) {
//   const errors = requestErrors(
//     validator.validate(req.body, schemas.refreshCache)
//   );

//   if (errors.length > 0) {
//     res.status(402).json({ error: "invalid input", messages: errors });
//     return;
//   }

//   const body = req.body as refreshCacheBody;

//   const gitId = req.params.id;

//   const connection = await db.connect();
//   const git = await connection
//     .getRepository(Git)
//     .findOneOrFail({id: gitId});

//   if (!git) {
//     res.status(404).json({ error: "unknown folder with id " + gitId });
//     return;
//   }

//   try {
//     await GitUtil.refreshGit(git);

//     if (body.hpc) {
//       await FolderUploaderHelper.cachedUpload({ gitId: git.id }, body.hpc, "cache");
//     } else {
//       for (const hpc of Object.keys(hpcConfigMap)) {
//         // vv fun fact! you can avoid awaiting for a promise with the void keyword
//         await FolderUploaderHelper.cachedUpload({gitId: git.id}, hpc, "cache");
//       }
//     }
//   } catch (err) {
//     res.status(401).json({ error: `something went wrong with refreshing the cache; experienced error: ${Helper.assertError(err).toString()}`});
//     return;
//   }

// });

// /**
//  * @openapi
//  * /git/refresh/hpc/:id:
//  *  put:
//  *      description: For the given HPC id (:id), refresh all git repos on it.
//  *      responses:
//  *          200:
//  *              description: Refresh completed successfully
//  *          401:
//  *              description: Something went wrong with the cache reloading
//  */
// app.put("/refresh/hpc/:id", async function (req, res) {
//   const hpc = req.params.id;

//   const connection = await db.connect();
//   const repos = await connection
//     .getRepository(Git)
//     .find();

//   try {
//     for (const repo of repos) {
//       await GitUtil.refreshGit(repo);
//       await FolderUploaderHelper.cachedUpload({ gitId: repo.id }, hpc, "cache");
//     }
//   } catch (err) {
//     res.status(401).json({ error: `something went wrong with refreshing the cache; experienced error: ${Helper.assertError(err).toString()}`});
//     return;
//   }
// });

// /**
//  * @openapi
//  * /git/refresh:
//  *  put:
//  *      description: Refresh all git repos on all HPCs.
//  *      responses:
//  *          200:
//  *              description: Refresh completed successfully
//  *          401:
//  *              description: Something went wrong with the cache reloading
//  */
// app.put("/refresh", async function (req, res) {
//   const connection = await db.connect();

//   const repos = await connection.getRepository(Git).find();

//   try {
//     for (const repo of repos) {
//       await GitUtil.refreshGit(repo);
      
//       for (const hpc of Object.keys(hpcConfigMap)) {
//         // vv fun fact! you can avoid awaiting for a promise with the void keyword
//         await FolderUploaderHelper.cacheRefresh({gitId: repo.id, type: "git"}, hpc);
//       }        
//     }
//   } catch (err) {
//     res.status(401).json({ error: `something went wrong with refreshing the cache; experienced error: ${Helper.assertError(err).toString()}`});
//     return;
//   }
// });


export default gitRouter;