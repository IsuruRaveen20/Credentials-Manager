import { Injectable } from "@nestjs/common";
import type { EnvelopeKms } from "./envelope-kms.interface";

@Injectable()
export class GcpEnvelopeKmsStub implements EnvelopeKms {
  async generateDataKey(): Promise<{
    plaintextDek: Buffer;
    encryptedDek: Buffer;
    keyId: string;
  }> {
    throw new Error("GCP KMS provider is not implemented in this build");
  }

  async decryptDataKey(_ciphertext: Buffer): Promise<Buffer> {
    throw new Error("GCP KMS provider is not implemented in this build");
  }
}
