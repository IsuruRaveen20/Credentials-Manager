import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import * as Sentry from "@sentry/node";
import { AppModule } from "./app.module";
import { SentryExceptionFilter } from "./sentry-exception.filter";

const logger = new Logger("Bootstrap");

async function bootstrap() {
  if (process.env.SENTRY_DSN?.trim()) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? "development",
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    });
    logger.log(`Sentry enabled (${process.env.SENTRY_ENVIRONMENT ?? "development"})`);
  }

  const app = await NestFactory.create(AppModule, { rawBody: false });

  // API responses: deny framing + tight default; CORS still allows WEB_ORIGIN.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.useGlobalFilters(new SentryExceptionFilter());
  app.enableCors({
    origin: process.env.WEB_ORIGIN?.split(",") ?? ["http://localhost:13000"],
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
  logger.log(`API listening on http://0.0.0.0:${port} (try /health/live then /health)`);
}

bootstrap().catch((err: unknown) => {
  const stack = err instanceof Error ? err.stack : String(err);
  logger.error(`Nest bootstrap failed: ${err instanceof Error ? err.message : String(err)}`, stack);
  Sentry.captureException(err);
  process.exit(1);
});
