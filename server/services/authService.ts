import type { PublicUser, RegisterInput } from "@shared/api";
import type { UserRow } from "@shared/schema";
import { AppError, badRequest, conflict } from "../errors";
import type { UserRepository } from "../repositories/userRepository";
import { hashPassword, verifyPassword } from "./passwords";

export type OAuthProfile = {
  provider: "google" | "github";
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

const safeHttpsUrl = (url: string | null) => (url && url.startsWith("https://") ? url.slice(0, 2048) : null);

export function createAuthService(users: UserRepository) {
  async function toPublic(user: UserRow): Promise<PublicUser> {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      isAdmin: user.isAdmin,
      hasPassword: Boolean(user.passwordHash),
      providers: await users.providersFor(user.id),
      createdAt: user.createdAt.toISOString(),
    };
  }

  return {
    toPublic,

    async register(input: RegisterInput): Promise<UserRow> {
      if (await users.findByEmail(input.email)) {
        throw conflict("EMAIL_TAKEN", "An account with this email already exists", { email: "Already registered" });
      }
      return users.create({
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash: await hashPassword(input.password),
      });
    },

    /** Same error and similar timing whether the email is unknown or the password is wrong. */
    async authenticate(email: string, password: string): Promise<UserRow> {
      const user = await users.findByEmail(email);
      const ok = await verifyPassword(password, user?.passwordHash);
      if (!user || !ok) throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
      return user;
    },

    /**
     * Sign in with Google/GitHub. An existing account is only linked by email
     * when the provider says the email is verified, which prevents account
     * takeover through an unverified address.
     */
    async signInWithOAuth(profile: OAuthProfile): Promise<UserRow> {
      const linked = await users.findByOAuth(profile.provider, profile.providerUserId);
      if (linked) return linked;
      if (!profile.email || !profile.emailVerified) {
        throw badRequest("EMAIL_NOT_VERIFIED", `Your ${profile.provider} account needs a verified email address`);
      }
      const existing = await users.findByEmail(profile.email);
      const user =
        existing ??
        (await users.create({
          email: profile.email,
          firstName: profile.firstName?.slice(0, 100) ?? null,
          lastName: profile.lastName?.slice(0, 100) ?? null,
          profileImageUrl: safeHttpsUrl(profile.avatarUrl),
        }));
      await users.linkOAuth(user.id, profile.provider, profile.providerUserId);
      return user;
    },

    async changePassword(user: UserRow, currentPassword: string | undefined, newPassword: string): Promise<void> {
      if (user.passwordHash && !(await verifyPassword(currentPassword ?? "", user.passwordHash))) {
        throw new AppError(400, "INVALID_PASSWORD", "Current password is incorrect", {
          currentPassword: "Incorrect password",
        });
      }
      await users.setPasswordHash(user.id, await hashPassword(newPassword));
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
