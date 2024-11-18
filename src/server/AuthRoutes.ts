import axios, { AxiosResponse } from "axios";
import express from "express";

import { config, hpcConfigMap } from "../../configs/config";
import * as Helper from "../helpers/Helper";
import { AllowList, Approvals, DenyList, UserInfo } from "../models";
import dataSource from "../utils/DB";
import { modifyUserBody, ApprovalType, CILogonTokenBody, CILogonUserInfo } from "../utils/types";

import { validator } from "./ServerUtil";
import { requestErrors, schemas } from "./ServerUtil";

const authRouter = express.Router();

authRouter.post("/request/addUser", async function (req, res) {
  const errors = requestErrors(
    validator.validate(req.body, schemas.modifyUser)
  );

  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }

  const body = req.body as modifyUserBody; 

  if (!(body.hpc in hpcConfigMap)) {
    res.status(402).json({ error: "invalid hpc passed in" });
    return;
  }

  const approvalRepo = dataSource.getRepository(Approvals);

  const existing = await approvalRepo.findOneBy({
    user: body.user,
    hpc: body.hpc,
    type: ApprovalType.APPROVAL,
  });

  if (existing?.approvedAt != null) {
    res.status(400).json({ error: "approval request already pending" });
    return;
  }

  await approvalRepo.insert({
    user: body.user,
    hpc: body.hpc,
    type: ApprovalType.APPROVAL,
    hash: Helper.randomHash(100)
  });

  res.status(200).json({ 
    messages: ["allowlist approval successfully requested"] 
  });
});

authRouter.post("/request/denyUser", async function (req, res) {
  const errors = requestErrors(
    validator.validate(req.body, schemas.modifyUser)
  );

  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }

  const body = req.body as modifyUserBody;

  if (!(body.hpc in hpcConfigMap)) {
    res.status(402).json({ error: "invalid hpc passed in" });
    return;
  }

  const approvalRepo = dataSource.getRepository(Approvals);

  const existing = await approvalRepo.findOneBy({
    user: body.user,
    hpc: body.hpc,
    type: ApprovalType.DENIAL,
  });

  if (existing?.approvedAt != null) {
    res.status(400).json({ error: "denial request already pending" });
    return;
  }

  await approvalRepo.insert({
    user: body.user,
    hpc: body.hpc,
    type: ApprovalType.DENIAL,
    hash: Helper.randomHash(100)
  });

  res.status(200).json({ 
    messages: ["denylist approval successfully requested"] 
  });
});

authRouter.get("/approve", async (req, res) => {
  const hash = req.query.approvalId;

  if (hash === undefined || typeof hash !== "string") {
    res.status(400).json({ error: "non-existent or invalid approval id parameter" });
    return;
  }

  const approvalRepo = dataSource.getRepository(Approvals);
  const allowRepo = dataSource.getRepository(AllowList);
  const denyRepo = dataSource.getRepository(DenyList);

  const existing = await approvalRepo.findOneBy({
    hash
  });

  console.log;

  if (existing === null || existing.approvedAt != null) {
    res.status(400).json({ error: "non-existent or invalid approval id parameter" });
    return;
  }

  existing.approve();

  if (existing.type === ApprovalType.APPROVAL as string) {
    await allowRepo.insert({
      user: existing.user,
      hpc: existing.hpc
    });

    const denial = await denyRepo.findOneBy({
      user: existing.user,
      hpc: existing.hpc,
    });

    if (denial?.deletedAt != null) {
      denial.delete();
      await denyRepo.save(denial);
    }
  } else {
    await denyRepo.insert({
      user: existing.user,
      hpc: existing.hpc
    });

    const allow = await allowRepo.findOneBy({
      user: existing.user,
      hpc: existing.hpc,
    });

    if (allow?.deletedAt != null) {
      allow.delete();
      await allowRepo.save(allow);
    }
  }

  await approvalRepo.save(existing);

  res.status(200).json({ 
    messages: ["approval successful"] 
  });
});

authRouter.get("cilogon/callback", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  if (typeof(code) !== "string") {
    res.status(400).json({ error: "invalid cilogon code" });
    return;
  }

  if (typeof(state) !== "string") {
    res.status(400).json({ error: "invalid request, no state found" });
    return;
  }

  const response: AxiosResponse<CILogonTokenBody> = await axios.post("https://cilogon.org/oauth2/token", {
    grant_type: "authorization_code",
    client_id: config.cilogon_client_id,
    code: code,
    client_secret: config.cilogon_secret,
    redirect_uri: config.cilogon_redirect_uri,
  });

  if (response.status !== 200) {
    res.status(400).json({ error: "couldn't get access token" });
    return;
  }

  const info: AxiosResponse<CILogonUserInfo> = await axios.post("https://cilogon.org/oauth2/userinfo", {
    access_token: response.data.access_token,
  });

  if (info.status !== 200) {
    res.status(400).json({ error: "couldn't get user info" });
    return;
  }

  if (info.data.idp_name === undefined 
    || info.data.idp_name !== "ACCESS" 
    || info.data.idp_name === undefined 
    || info.data.email === undefined 
    || info.data.name === undefined
  ) {
    res.status(400).json({ error: "need to log in with ACCESS, please try again" });
    return;
  }

  const userRepo = dataSource.getRepository(UserInfo);

  await userRepo.insert({
    user: state,
    access_eppn: info.data.idp_name,
    email: info.data.email,
    name: info.data.name,
  });

  res.status(200).redirect("https://cybergisx.cigi.illinois.edu");
});

export default authRouter;