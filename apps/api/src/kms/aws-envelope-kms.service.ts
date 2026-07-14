import {
  DecryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from "@aws-sdk/client-kms";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvelopeKms } from "./envelope-kms.interface";

@Injectable()
export class AwsEnvelopeKmsService implements EnvelopeKms {
  private readonly client: KMSClient;
  private readonly keyId: string;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>("AWS_REGION", "us-east-1");
    const endpoint = this.config.get<string>("AWS_ENDPOINT_URL");
    this.client = new KMSClient({
      region,
      endpoint: endpoint || undefined,
      credentials:
        this.config.get<string>("AWS_ACCESS_KEY_ID") &&
        this.config.get<string>("AWS_SECRET_ACCESS_KEY")
          ? {
              accessKeyId: this.config.get<string>("AWS_ACCESS_KEY_ID")!,
              secretAccessKey: this.config.get<string>("AWS_SECRET_ACCESS_KEY")!,
            }
          : undefined,
    });
    const keyId = this.config.get<string>("KMS_KEY_ID");
    if (!keyId) {
      throw new Error("KMS_KEY_ID is required for AWS KMS envelope encryption");
    }
    this.keyId = keyId;
  }

  async generateDataKey() {
    const out = await this.client.send(
      new GenerateDataKeyCommand({
        KeyId: this.keyId,
        KeySpec: "AES_256",
      }),
    );
    if (!out.Plaintext?.length || !out.CiphertextBlob?.length) {
      throw new Error("KMS GenerateDataKey returned empty payload");
    }
    return {
      plaintextDek: Buffer.from(out.Plaintext),
      encryptedDek: Buffer.from(out.CiphertextBlob),
      keyId: this.keyId,
    };
  }

  async decryptDataKey(ciphertext: Buffer) {
    const out = await this.client.send(
      new DecryptCommand({ CiphertextBlob: ciphertext }),
    );
    if (!out.Plaintext?.length) {
      throw new Error("KMS Decrypt returned empty plaintext");
    }
    return Buffer.from(out.Plaintext);
  }
}
