import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const port = 3001; // <-- hardcode for å unngå env-trøbbel i starten
  await app.listen(port);

  console.log(`API running on http://localhost:${port}`);
}
bootstrap();
