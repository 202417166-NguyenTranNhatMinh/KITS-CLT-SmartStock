import { Router } from "express";

import * as controller from "../controllers/inventoryController";
import { authenticate } from "../middlewares/Auth";

const router = Router();
router.use(authenticate);
router.get("/:id/history", controller.getProductHistory);

export default router;
