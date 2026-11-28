import { Router } from "express";

import * as controller from "../controllers/reportController";
import { authenticate, authorize } from "../middlewares/Auth";

const router = Router();
router.use(authenticate);
router.get("/stock-summary", authorize("ADMIN"), controller.getStockSummary);

export default router;
