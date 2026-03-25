import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Chrome, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGoogleAuthUrl, useLogin, useRegister } from "@/api/hooks";
import { useLanguage } from "@/i18n/context";

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();
  const register = useRegister();
  const googleUrl = useGoogleAuthUrl();
  const { t } = useLanguage();

  const errorMessage = useMemo(
    () => (login.error as Error | null)?.message ?? (register.error as Error | null)?.message ?? null,
    [login.error, register.error],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (mode === "login") {
      await login.mutateAsync({ email, password });
    } else {
      await register.mutateAsync({ email, username, password });
    }

    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="container mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="glass-surface relative overflow-hidden rounded-[32px] p-8 lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,201,80,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(97,174,255,0.14),transparent_38%)]" />
          <div className="relative space-y-8">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">{t("auth.eyebrow")}</p>
              <h1 className="font-heading text-4xl font-bold leading-tight text-foreground lg:text-5xl">
                {t("auth.title")}
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
                {t("auth.description")}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/50 p-5">
                <Chrome className="mb-3 h-5 w-5 text-primary" />
                <p className="font-semibold text-foreground">{t("auth.googleFirstTitle")}</p>
                <p className="mt-2 text-sm text-muted-foreground">{t("auth.googleFirstDesc")}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/50 p-5">
                <LockKeyhole className="mb-3 h-5 w-5 text-primary" />
                <p className="font-semibold text-foreground">{t("auth.passwordAuthTitle")}</p>
                <p className="mt-2 text-sm text-muted-foreground">{t("auth.passwordAuthDesc")}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/50 p-5">
                <ShieldCheck className="mb-3 h-5 w-5 text-primary" />
                <p className="font-semibold text-foreground">{t("auth.persistentSessionsTitle")}</p>
                <p className="mt-2 text-sm text-muted-foreground">{t("auth.persistentSessionsDesc")}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="glass-surface rounded-[32px] p-8 lg:p-10">
          <div className="space-y-6">
            <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-background to-background p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">{t("auth.recommended")}</p>
              <h2 className="mt-3 font-heading text-2xl font-bold text-foreground">{t("auth.continueWithGoogle")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("auth.googlePanelDescription")}
              </p>
              <Button
                type="button"
                className="mt-5 h-12 w-full justify-center gap-3 rounded-2xl bg-white text-base font-semibold text-slate-900 hover:bg-slate-100"
                disabled={googleUrl.isLoading || !googleUrl.data}
                onClick={() => {
                  if (googleUrl.data) {
                    window.location.href = googleUrl.data;
                  }
                }}
              >
                <Chrome className="h-5 w-5" />
                {t("auth.continueWithGoogle")}
              </Button>
              {googleUrl.error ? (
                <p className="mt-3 text-sm text-destructive">{(googleUrl.error as Error).message}</p>
              ) : null}
            </div>

            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              {t("auth.orUseEmail")}
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="flex gap-2 rounded-2xl bg-secondary/60 p-1">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium ${mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                {t("auth.loginTab")}
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium ${mode === "signup" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                {t("auth.registerTab")}
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t("auth.emailLabel")}</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-12 rounded-2xl pl-11" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
                </div>
              </div>

              {mode === "signup" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t("auth.usernameLabel")}</label>
                  <Input
                    className="h-12 rounded-2xl"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    minLength={3}
                    maxLength={24}
                    required
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t("auth.passwordLabel")}</label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-12 rounded-2xl pl-11"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    minLength={8}
                    required
                  />
                </div>
                {mode === "signup" ? <p className="text-xs text-muted-foreground">{t("auth.passwordHint")}</p> : null}
              </div>

              {errorMessage ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMessage}</div>
              ) : null}

              <Button type="submit" variant="gold" className="h-12 w-full rounded-2xl text-base" disabled={login.isPending || register.isPending}>
                {mode === "login" ? t("auth.loginWithEmail") : t("auth.createAccount")}
              </Button>
            </form>

            <p className="text-sm text-muted-foreground">
              {t("auth.footerPrefix")}{" "}
              <Link to="/" className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline">{t("auth.backToLanding")}</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Auth;
