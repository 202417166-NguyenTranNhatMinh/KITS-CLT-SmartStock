import { Router } from 'express';
import { userController } from '../controllers/userController';
import { authenticate, authorize } from '../middlewares/Auth';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/', userController.list);
router.post('/', userController.create);
router.patch('/:id/status', userController.updateStatus);

export default router;