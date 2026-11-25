import { Router } from "express";

import * as controller from "../controllers/productController";
import { authenticate, authorize } from "../middlewares/Auth";

const router = Router();
router.use(authenticate);
router.route("/").get(controller.listProducts).post(authorize("ADMIN"), controller.createProduct);
router
  .route("/:id")
  .get(controller.getProduct)
  .put(authorize("ADMIN"), controller.updateProduct)
  .delete(authorize("ADMIN"), controller.deactivateProduct);
export default router;
