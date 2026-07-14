import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type RequestUser = {
  clerkId: string;
  email: string;
  internalUserId: string;
  organizationId: string;
  firstName?: string | null;
  lastName?: string | null;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as RequestUser;
  },
);
