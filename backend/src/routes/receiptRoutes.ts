import { Router } from "express";
import { authenticate } from "../middlewares/Auth";
import * as controller from "../controllers/receiptController";

const router = Router();
router.use(authenticate);
router.route("/").get(controller.listReceipts).post(controller.createReceipt);
router.route("/:id").get(controller.getReceipt).put(controller.updateReceipt);
router.patch("/:id/confirm", controller.confirmReceipt);
router.patch("/:id/cancel", controller.cancelReceipt);
export default router;
