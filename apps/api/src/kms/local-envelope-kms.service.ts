import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvelopeKms } from "./envelope-kms.interface";

const ALGO = "aes-256-gcm";
const VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;

@Injectable()
export class LocalEnvelopeKmsService implements EnvelopeKms {
  private readonly master: Buffer;
  private readonly keyId = "local:dev-master";

  constructor(private readonly config: ConfigService) {
    const b64 = this.config.get<string>("LOCAL_KMS_MASTER_KEY");
    if (!b64) {
      throw new Error("LOCAL_KMS_MASTER_KEY (base64, 32 bytes) is required when USE_LOCAL_KMS=true");
    }
    const buf = Buffer.from(b64, "base64");
    if (buf.length !== 32) {
      throw new Error("LOCAL_KMS_MASTER_KEY must decode to 32 bytes");
    }
    this.master = buf;
  }

  async generateDataKey() {
    const dek = randomBytes(32);
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, this.master, iv);
    const enc = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    const blob = Buffer.concat([Buffer.from([VERSION]), iv, enc, tag]);
    return {
      plaintextDek: dek,
      encryptedDek: blob,
      keyId: this.keyId,
    };
  }

  async decryptDataKey(ciphertext: Buffer) {
    if (ciphertext.readUInt8(0) !== VERSION) {
      throw new Error("Unsupported local KMS blob");
    }
    const iv = ciphertext.subarray(1, 1 + IV_LEN);
    const tag = ciphertext.subarray(ciphertext.length - TAG_LEN);
    const data = ciphertext.subarray(1 + IV_LEN, ciphertext.length - TAG_LEN);
    const decipher = createDecipheriv(ALGO, this.master, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }
}
