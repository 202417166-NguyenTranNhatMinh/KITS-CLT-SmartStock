import { Router } from "express";
import { authenticate } from "../middlewares/Auth";
import * as controller from "../controllers/issueController";

const router = Router();
router.use(authenticate);
router.route("/").get(controller.listIssues).post(controller.createIssue);
router.route("/:id").get(controller.getIssue).put(controller.updateIssue);
router.patch("/:id/confirm", controller.confirmIssue);
router.patch("/:id/cancel", controller.cancelIssue);
export default router;
