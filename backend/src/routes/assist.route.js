import {assistUser, assistUserContext, assistUserQuiz} from "../controllers/assist.controller.js";

export default async function assistRoutes(app) {
  app.post("/assist", assistUser);
  app.post("/assist/context", assistUserContext);
  app.post("/assist/quiz", assistUserQuiz);
}