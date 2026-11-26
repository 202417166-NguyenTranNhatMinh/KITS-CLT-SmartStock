import { Router } from "express";

import * as controller from "../controllers/supplierController";
import { authenticate, authorize } from "../middlewares/Auth";

const router = Router();
router.use(authenticate);
router.route("/").get(controller.listSuppliers).post(authorize("ADMIN"), controller.createSupplier);
router.put("/:id", authorize("ADMIN"), controller.updateSupplier);
export default router;
