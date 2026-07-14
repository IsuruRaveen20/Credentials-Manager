import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AwsEnvelopeKmsService } from "./aws-envelope-kms.service";
import { ENVELOPE_KMS, type EnvelopeKms } from "./envelope-kms.interface";
import { LocalEnvelopeKmsService } from "./local-envelope-kms.service";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: ENVELOPE_KMS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): EnvelopeKms => {
        const useLocal =
          config.get<string>("USE_LOCAL_KMS") === "true" ||
          config.get<string>("KMS_PROVIDER", "aws").toLowerCase() === "local";
        if (useLocal) {
          return new LocalEnvelopeKmsService(config);
        }
        return new AwsEnvelopeKmsService(config);
      },
    },
  ],
  exports: [ENVELOPE_KMS],
})
export class KmsModule {}
