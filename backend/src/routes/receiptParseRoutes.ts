import { Router } from "express";

import { parseReceipt } from "../controllers/receiptParseController";
import { authenticate } from "../middlewares/Auth";

const router = Router();
router.use(authenticate);
router.post("/parse", parseReceipt);

export default router;
