import { randomUUID } from "crypto";
import UserProfile from "../models/UserProfile.js";

export const createOnboardingProfile = async (request, reply) => {
  console.log("📥 BODY RECEIVED:", request.body);
  try {
    const {
      comprehensionBreak,
      learningPreference,
      listeningThought,
      struggleNote,
      uiPreferences
    } = request.body;

    const profile = new UserProfile({
      profileId: randomUUID(),
      onboarding: {
        comprehensionBreak,
        learningPreference,
        listeningThought,
        struggleNote
      },
      uiPreferences
    });
    
    await profile.save();

    reply.code(201).send({
      success: true,
      profileId: profile.profileId
    });
  } catch (error) {
    console.error("❌ Onboarding save error:", error);

    reply.code(500).send({
      success: false,
      message: error.message || "Failed to create onboarding profile"
    });
  }
};


export const getOnboardingProfile = async (request, reply) => {
  try {
    const { profileId } = request.params;
    const profile = await UserProfile.findOne({ profileId });
    
    if (!profile) {
      return reply.code(404).send({ success: false, message: "Profile not found" });
    }
    
    reply.code(200).send({ success: true, profile });
  } catch (error) {
    console.error("❌ Fetch profile error:", error);
    reply.code(500).send({ success: false, message: error.message });
  }
};

// NEW: Update existing profile data
export const updateOnboardingProfile = async (request, reply) => {
  try {
    const { profileId } = request.params;
    const updateData = request.body; 

    // Update the profile and return the new document
    const profile = await UserProfile.findOneAndUpdate(
      { profileId },
      { $set: updateData },
      { new: true }
    );

    if (!profile) {
      return reply.code(404).send({ success: false, message: "Profile not found" });
    }
    
    reply.code(200).send({ success: true, profile });
  } catch (error) {
    console.error("❌ Update profile error:", error);
    reply.code(500).send({ success: false, message: error.message });
  }
};
