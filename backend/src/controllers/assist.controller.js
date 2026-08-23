import UserProfile from "../models/UserProfile.js";
import { processWithGemini, processContextQuery, generateQuiz } from "../services/gemini.service.js";

export async function assistUser(request, reply) {
  try {
    const { profileId, text, userId, requestedTier, outputLanguage } = request.body;

    if (!profileId || !text) {
      return reply.code(400).send({
        error: "profileId and text are required"
      });
    }

    const userProfile = await UserProfile.findOne({ profileId });

    if (!userProfile) {
      return reply.code(404).send({
        error: "User profile not found"
      });
    }

    const result = await processWithGemini({
      text,
      userProfile,
      // Dashboard.jsx sends userId === profileId, but fall back to
      // profileId anyway in case a future caller only sends one of them.
      userId: userId || profileId,
      requestedTier,
      outputLanguage
    });

    return reply.send(result);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({
      error: "Failed to process assistance request"
    });
  }
}

export async function assistUserContext(request, reply) {
  try {
    const {
      query,
      previousResult,
      profileId,
      userId,
      requestedTier,
      attachedFile,
      useSearch,
      outputLanguage
    } = request.body;

    if (!query || !previousResult) {
      return reply.code(400).send({
        error: "query and previousResult are required"
      });
    }

    const result = await processContextQuery({
      query,
      previousResult,
      userId: userId || profileId,
      requestedTier,
      attachedFile,
      useSearch,
      outputLanguage
    });

    return reply.send(result);
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({
      error: "Failed to process context request"
    });
  }
}

export async function assistUserQuiz(request, reply) {
  try {
    const { simplified, keyPoints, profileId, userId, outputLanguage } = request.body;

    if (!simplified) {
      return reply.code(400).send({
        error: "simplified is required to build a quiz"
      });
    }

    const quiz = await generateQuiz({
      simplified,
      keyPoints,
      userId: userId || profileId,
      outputLanguage
    });

    return reply.send(quiz);
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({
      error: "Failed to generate quiz"
    });
  }
}