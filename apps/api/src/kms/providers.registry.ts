import type { EnvelopeKms } from "./envelope-kms.interface";

export type KmsProviderKind = "aws" | "local" | "gcp" | "azure" | "vault";

export type KmsProviderRegistry = Record<
  KmsProviderKind,
  {
    label: string;
    status: "implemented" | "stub";
    notes: string;
  }
>;

export const KMS_PROVIDER_REGISTRY: KmsProviderRegistry = {
  aws: {
    label: "AWS KMS",
    status: "implemented",
    notes: "Uses GenerateDataKey / Decrypt with CMK from KMS_KEY_ID.",
  },
  local: {
    label: "Local AES master key",
    status: "implemented",
    notes: "Dev-only. Set USE_LOCAL_KMS=true and LOCAL_KMS_MASTER_KEY (base64, 32 bytes).",
  },
  gcp: {
    label: "Google Cloud KMS",
    status: "stub",
    notes: "Implement EnvelopeKms with Cloud KMS cryptoKeys:encrypt/decrypt for DEK wrapping.",
  },
  azure: {
    label: "Azure Key Vault",
    status: "stub",
    notes: "Implement EnvelopeKms with Key Vault wrapKey/unwrapKey for DEK wrapping.",
  },
  vault: {
    label: "HashiCorp Vault Transit",
    status: "stub",
    notes: "Implement EnvelopeKms with transit encrypt/decrypt on a dedicated key.",
  },
};

export function describeKmsProviders(): KmsProviderRegistry {
  return KMS_PROVIDER_REGISTRY;
}

export type { EnvelopeKms };
