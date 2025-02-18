import { Job } from "../models";

import BaseMaintainer from "./BaseMaintainer";
import CommunityContributionMaintainer from "./CommunityContributionMaintainer";

export const maintainerMap: Record<string, (job: Job) => BaseMaintainer> = {
  "CommunityContributionMaintainer": (job: Job) => new CommunityContributionMaintainer(job),
  "HelloWorldSingularityMaintainer": (job: Job) => new CommunityContributionMaintainer(job)  // relies on an non-existent maintainer
};