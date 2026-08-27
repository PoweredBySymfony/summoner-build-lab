import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mocks.createTransport,
  },
}));

vi.mock("../../server/src/config/env.js", () => ({
  env: {
    APP_URL: "https://summoner.example.test",
    EMAIL_FROM: "Summoner Build Lab <noreply@example.test>",
    EMAIL_PROVIDER_API_KEY: "",
    SMTP_HOST: "",
    SMTP_PORT: undefined,
    SMTP_USER: "",
    SMTP_PASSWORD: "",
    SMTP_SECURE: undefined,
  },
}));

describe("emailService", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.sendMail.mockResolvedValue({ accepted: ["player@example.test"] });
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  });

  it("uses JSON transport when SMTP is not configured", async () => {
    const { emailService } = await import("../../server/src/services/emailService");

    expect(emailService.isConfigured()).toBe(false);
    expect(mocks.createTransport).toHaveBeenCalledWith({ jsonTransport: true });
  });

  it("sends daily reminders with the expected recipient and daily URL", async () => {
    const { emailService } = await import("../../server/src/services/emailService");

    await emailService.sendDailyReminder("player@example.test", "PlayerOne", 4);

    expect(mocks.sendMail).toHaveBeenCalledWith({
      from: "Summoner Build Lab <noreply@example.test>",
      to: "player@example.test",
      subject: "Your daily itemization challenge is waiting",
      text: expect.stringContaining("https://summoner.example.test/daily"),
    });
    expect(mocks.sendMail.mock.calls[0][0].text).toContain("Your current streak is 4.");
  });
});
