import { Injectable } from "@nestjs/common";
import type { EnvelopeKms } from "./envelope-kms.interface";

@Injectable()
export class AzureEnvelopeKmsStub implements EnvelopeKms {
  async generateDataKey(): Promise<{
    plaintextDek: Buffer;
    encryptedDek: Buffer;
    keyId: string;
  }> {
    throw new Error("Azure Key Vault provider is not implemented in this build");
  }

  async decryptDataKey(_ciphertext: Buffer): Promise<Buffer> {
    throw new Error("Azure Key Vault provider is not implemented in this build");
  }
}
