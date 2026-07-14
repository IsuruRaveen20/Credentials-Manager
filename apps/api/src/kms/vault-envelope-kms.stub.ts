import { Injectable } from "@nestjs/common";
import type { EnvelopeKms } from "./envelope-kms.interface";

@Injectable()
export class VaultEnvelopeKmsStub implements EnvelopeKms {
  async generateDataKey(): Promise<{
    plaintextDek: Buffer;
    encryptedDek: Buffer;
    keyId: string;
  }> {
    throw new Error("HashiCorp Vault transit provider is not implemented in this build");
  }

  async decryptDataKey(_ciphertext: Buffer): Promise<Buffer> {
    throw new Error("HashiCorp Vault transit provider is not implemented in this build");
  }
}
