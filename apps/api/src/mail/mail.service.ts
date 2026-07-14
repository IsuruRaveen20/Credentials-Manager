import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendInviteEmail(input: {
    to: string;
    firstName: string;
    verifyUrl: string;
  }) {
    const provider = this.config.get<string>("EMAIL_PROVIDER", "console");
    const subject = "Verify your VaultOps account";
    const body = `Hi ${input.firstName},

You have been invited to VaultOps. Open this link to verify your email and set a password:

${input.verifyUrl}

This link expires in 48 hours. If you did not expect this invite, ignore this email.`;

    if (provider === "console") {
      this.logger.log(`[console-email] to=${input.to} subject=${subject}\n${body}`);
      return;
    }

    // Placeholder for Resend/SES — log until configured
    this.logger.warn(
      `EMAIL_PROVIDER=${provider} not fully configured; logging invite for ${input.to}`,
    );
    this.logger.log(`[${provider}-fallback] ${body}`);
  }
}
