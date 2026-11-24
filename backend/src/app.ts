import path from 'path';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { sendSuccess } from './common/response';
import receiptRoutes from './routes/receiptRoutes';
import issueRoutes from './routes/issueRoutes';
import categoryRoutes from './routes/categoryRoutes';     



const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());

// Swagger UI từ docs/smartstock_api.yaml (tự động đổi server url sang localhost:PORT)
const swaggerPath = path.resolve(__dirname, '../../docs/smartstock_api.yaml');
const swaggerDocument = YAML.load(swaggerPath);
swaggerDocument.servers = [{ url: `http://localhost:${env.PORT}`, description: 'Local development' }];
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health check
app.get('/api/health', (_req, res) => {
  sendSuccess(res, { ok: true }, 'SmartStock API is running');
});

app.use('/api/receipts', receiptRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/categories', categoryRoutes);               

// 404 và Global Error Handler (luôn đặt cuối cùng)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
