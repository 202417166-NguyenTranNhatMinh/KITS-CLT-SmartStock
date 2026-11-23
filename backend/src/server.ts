import app from './app';
import { env } from './config/env';
import { checkDbConnection } from './config/db';

async function bootstrap() {
  try {
    await checkDbConnection();
    app.listen(env.PORT, () => {
      console.log(`Server is running at http://localhost:${env.PORT}`);
      console.log(`Swagger UI: http://localhost:${env.PORT}/api-docs`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();