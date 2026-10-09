import UserProfile from "../models/UserProfile.js";
import {
  processWithGemini,
  processContextQuery,
  generateQuiz,
} from "../services/gemini.service.js";

function tierLabel(tierId) {
  const labels = {
    ultra: "Cognivo Ultra",
    pro: "Cognivo Pro",
    plus: "Cognivo Plus",
    lite: "Cognivo Lite",
  };

  return labels[tierId] || "This Cognivo model";
}

function sendModelError(reply, error) {
  const tierId = error.tierId || error.requestedTier;
  const label = tierLabel(tierId);

  if (error.code === "MODEL_QUOTA_EXHAUSTED") {
    return reply.code(429).send({
      errorType: "MODEL_QUOTA_EXHAUSTED",
      message: `${label} has reached your daily Cognivo limit. It will be available again tomorrow. You can switch to another Cognivo model now.`,
      tierId,
    });
  }

  if (error.code === "PROVIDER_QUOTA_EXHAUSTED") {
    return reply.code(429).send({
      errorType: "PROVIDER_QUOTA_EXHAUSTED",
      message: `${label} is unavailable today because its Gemini API allowance has been exhausted. Please use another Cognivo model and try this one again tomorrow.`,
      tierId,
    });
  }

  if (error.code === "MODEL_LOCKED_TODAY") {
    return reply.code(503).send({
      errorType: "MODEL_LOCKED_TODAY",
      message:
        error.message ||
        `${label} is unavailable today because of repeated Gemini service issues. Please try another Cognivo model and come back tomorrow.`,
      tierId,
      lockReason: error.lockReason,
    });
  }

  if (error.code === "MODEL_BUSY") {
    return reply.code(503).send({
      errorType: "MODEL_BUSY",
      message:
        error.message ||
        `${label} is currently busy. Your token has been returned and a 60-second cooldown has been applied to this model.`,
      tierId,
      cooldownSeconds: error.cooldownSeconds || 60,
    });
  }

  if (error.code === "MODEL_COOLDOWN") {
    return reply.code(429).send({
      errorType: "MODEL_COOLDOWN",
      message:
        error.message ||
        `${label} is on cooldown. Please wait ${error.cooldownSeconds || 60} seconds or choose another model.`,
      tierId,
      cooldownSeconds: error.cooldownSeconds || 60,
    });
  }

  if (error.code === "INVALID_TIER") {
    return reply.code(400).send({
      errorType: "INVALID_TIER",
      message: "The selected Cognivo model is invalid.",
      tierId,
    });
  }

  return null;
}

export async function assistUser(request, reply) {
  try {
    const { profileId, text, userId, requestedTier, outputLanguage } = request.body;

    if (!profileId || !text) {
      return reply.code(400).send({
        error: "profileId and text are required",
      });
    }

    const userProfile = await UserProfile.findOne({ profileId });

    if (!userProfile) {
      return reply.code(404).send({
        error: "User profile not found",
      });
    }

    const result = await processWithGemini({
      text,
      userProfile,
      userId: userId || profileId,
      requestedTier,
      outputLanguage,
    });

    return reply.send(result);
  } catch (error) {
    request.log.error(error);

    const handled = sendModelError(reply, error);
    if (handled) return handled;

    return reply.code(500).send({
      errorType: "SERVER_ERROR",
      error: "Cognivo could not complete this request right now. Please try again shortly.",
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
      outputLanguage,
    } = request.body;

    if (!query || !previousResult) {
      return reply.code(400).send({
        error: "query and previousResult are required",
      });
    }

    const result = await processContextQuery({
      query,
      previousResult,
      userId: userId || profileId,
      requestedTier,
      attachedFile,
      useSearch,
      outputLanguage,
    });

    return reply.send(result);
  } catch (error) {
    request.log.error(error);

    const handled = sendModelError(reply, error);
    if (handled) return handled;

    return reply.code(500).send({
      errorType: "SERVER_ERROR",
      error: "Cognivo could not complete this request right now. Please try again shortly.",
    });
  }
}

export async function assistUserQuiz(request, reply) {
  try {
    const { simplified, keyPoints, profileId, userId, outputLanguage } = request.body;

    if (!simplified) {
      return reply.code(400).send({
        error: "simplified is required to build a quiz",
      });
    }

    const quiz = await generateQuiz({
      simplified,
      keyPoints,
      userId: userId || profileId,
      outputLanguage,
    });

    return reply.send(quiz);
  } catch (error) {
    request.log.error(error);

    if (error.code === "QUIZ_BUSY") {
      return reply.code(503).send({
        errorType: "QUIZ_BUSY",
        message: "The comprehension quiz is temporarily busy. Please try again shortly.",
      });
    }

    if (error.code === "QUIZ_UNAVAILABLE_TODAY") {
      return reply.code(503).send({
        errorType: "QUIZ_UNAVAILABLE_TODAY",
        message: "The comprehension quiz is temporarily unavailable today. Please try again tomorrow.",
      });
    }

    if (error.code === "MODEL_QUOTA_EXHAUSTED") {
      return reply.code(429).send({
        errorType: "QUIZ_UNAVAILABLE_TODAY",
        message: "The comprehension quiz has reached its daily limit. Please try again tomorrow.",
      });
    }

    return reply.code(500).send({
      errorType: "QUIZ_SERVER_ERROR",
      error: "Cognivo could not prepare the comprehension quiz right now.",
    });
  }
}
