import { getQuota } from "../controllers/quota.controller.js";

export default async function quotaRoutes(app) {
  app.get("/quota/:profileId", getQuota);
}