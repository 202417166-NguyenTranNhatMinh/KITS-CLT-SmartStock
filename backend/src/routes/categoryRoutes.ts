import { Router } from "express";

import * as controller from "../controllers/categoryController";
import { authenticate, authorize } from "../middlewares/Auth";

const router = Router();
router.use(authenticate);
router.route("/").get(controller.listCategories).post(authorize("ADMIN"), controller.createCategory);
export default router;
