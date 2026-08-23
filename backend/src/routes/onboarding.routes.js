import { 
  createOnboardingProfile, 
  getOnboardingProfile, 
  updateOnboardingProfile 
} from "../controllers/onboarding.controllers.js";

export default async function onboardingRoutes(app){
    app.post("/onboarding", createOnboardingProfile);
    app.get("/onboarding/:profileId", getOnboardingProfile);
    app.put("/onboarding/:profileId", updateOnboardingProfile);
}