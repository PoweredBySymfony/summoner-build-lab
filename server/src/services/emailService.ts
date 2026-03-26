import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const hasSmtpConfig = Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASSWORD);

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE ?? false,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    })
  : nodemailer.createTransport({
      jsonTransport: true,
    });

export const emailService = {
  isConfigured: () => hasSmtpConfig || Boolean(env.EMAIL_PROVIDER_API_KEY),
  sendDailyReminder: async (to: string, username: string, streak: number) => {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject: "Your daily itemization challenge is waiting",
      text: [
        `Hi ${username},`,
        "",
        `Your current streak is ${streak}.`,
        "Come back to solve today's League of Legends itemization puzzle and keep the streak alive.",
        "",
        `${env.APP_URL}/daily`,
      ].join("\n"),
    });
  },
};
