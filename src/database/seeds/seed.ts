import { NestFactory } from "@nestjs/core";
import { AppModule } from "src/app.module";
import { SeedService } from "./seed.service";

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn']
    })

    const seedService = app.get(SeedService);
    
    try {
        await seedService.seedUser();
    } catch (error) {
        process.exit(1);
    } finally {
        await app.close();
    }
}

bootstrap()