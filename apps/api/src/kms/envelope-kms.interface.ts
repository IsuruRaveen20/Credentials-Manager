export const ENVELOPE_KMS = Symbol("ENVELOPE_KMS");

export interface EnvelopeKms {
  generateDataKey(): Promise<{
    plaintextDek: Buffer;
    encryptedDek: Buffer;
    keyId: string;
  }>;
  decryptDataKey(ciphertext: Buffer): Promise<Buffer>;
}
