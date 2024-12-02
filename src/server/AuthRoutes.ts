import axios, { AxiosResponse } from "axios";
import express from "express";

import { config, hpcConfigMap } from "../../configs/config";
import * as Helper from "../helpers/Helper";
import { AllowList, Approvals, DenyList, UserInfo } from "../models";
import dataSource from "../utils/DB";
import { sendRequest } from "../utils/Email";
import { modifyUserBody, ApprovalType, CILogonTokenBody, CILogonUserInfo } from "../utils/types";

import { validator, requestErrors, schemas } from "./ServerUtil";

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

  const userRepo = dataSource.getRepository(UserInfo);
  const info = await userRepo.findOneBy({
    user: body.user
  });

  if (info === null) {
    res.status(400).json({ error: "user is not recorded in the user info database yet, need to authorize using access credentials" });
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

  const hash = Helper.randomHash(100);

  await approvalRepo.insert({
    user: body.user,
    hpc: body.hpc,
    type: ApprovalType.APPROVAL,
    hash
  });

  await sendRequest(`${config.cilogon_base_uri}/auth/approve?approvalId=${hash}`, body.user, true, info);

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

  const hash = Helper.randomHash(100);

  await approvalRepo.insert({
    user: body.user,
    hpc: body.hpc,
    type: ApprovalType.DENIAL,
    hash
  });

  await sendRequest(`${config.cilogon_base_uri}/auth/approve?approvalId=${hash}`, body.user, false);

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

authRouter.get("/cilogon/callback", async (req, res) => {
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

  const userRepo = dataSource.getRepository(UserInfo);

  const existing = await userRepo.findOneBy({
    user: state
  });

  if (existing !== null) {
    res.status(400).json({ error: "user already registered" });
    return;
  }

  let access_token: string;

  try {
    const data = new URLSearchParams();
    data.append("grant_type", "authorization_code");
    data.append("client_id", config.cilogon_client_id);
    data.append("code", code);
    data.append("client_secret", config.cilogon_secret);
    data.append("redirect_uri", `${config.cilogon_base_uri}/auth/cilogon/callback`);
    
    const response: AxiosResponse<CILogonTokenBody> = await axios.post("https://cilogon.org/oauth2/token", 
      data,
      { 
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        } 
      }
    );

    if (response.status !== 200) {
      res.status(400).json({ error: "couldn't get access token" });
      return;
    }

    access_token = response.data.access_token;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      res.status(400).json({ error: `failed to get authorization code for cilogon: ${err.message} ${err.response?.data ?? ""}` });
    } else {
      res.status(400).json({ error: "something went wrong getting authorization code for cilogon" });
    }
    
    return;
  }

  let userInfo: CILogonUserInfo;

  try {
    const data = new URLSearchParams();
    data.append("access_token", access_token);

    const info: AxiosResponse<CILogonUserInfo> = await axios.post("https://cilogon.org/oauth2/userinfo", 
      data,
      {
        headers: {
          "Content-Type": "appliaction/x-www-form-urlencoded"
        }
      }
    );
  
    if (info.status !== 200) {
      res.status(400).json({ error: "couldn't get user info" });
      return;
    }

    userInfo = info.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      res.status(400).json({ error: `failed to get user info from cilogon: ${err.message} ${err.response?.data ?? ""}` });
    } else {
      res.status(400).json({ error: "something went wrong getting user info from cilogon" });
    }
    
    return;
  }
  

  if (userInfo.idp_name === undefined 
    || userInfo.idp_name !== "ACCESS" 
    || userInfo.idp_name === undefined 
    || userInfo.email === undefined 
    || userInfo.name === undefined
  ) {
    res.status(400).json({ error: "need to log in with ACCESS, please try again" });
    return;
  }

  await userRepo.insert({
    user: state,
    access_eppn: userInfo.idp_name,
    email: userInfo.email,
    name: userInfo.name,
  });

  res.status(200).redirect("https://cybergisx.cigi.illinois.edu");
});

export default authRouter;