import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Eye, EyeOff, FileText, Lock, Mail, Share2, Sparkles, Users, Zap } from "lucide-react";
import { useApp } from "../lib/app-context";
import { Logo } from "./ui";
import { cn } from "../utils/cn";

const FEATURES = [
  { icon: Zap, title: "Server-backed documents", desc: "Save and reopen your documents from your account." },
  { icon: Users, title: "Collaborator permissions", desc: "Invite registered users as editors or viewers." },
  { icon: Share2, title: "Private by default", desc: "Share access with specific people from the document." },
];

export default function AuthScreen() {
  const { login, pushToast } = useApp();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login({
        name: mode === "signup" ? form.name : undefined,
        email: form.email,
        password: form.password,
        mode,
      });
    } catch (error) {
      pushToast({
        title: "Authentication failed",
        description: error instanceof Error ? error.message : "Please try again.",
        kind: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const sso = (provider: string) => {
    pushToast({
      title: `${provider} sign-in is not configured`,
      description: "Use email and password; single sign-on is not configured.",
      kind: "info",
    });
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14 bg-brand-gradient">
        <div className="dot-grid absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.35) 1.2px, transparent 1.2px)" }} />
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-[#9A3412]/30 blur-3xl" />

        <div className="relative"><Logo light /></div>

        <div className="relative max-w-lg">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold text-white ring-1 ring-white/25 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> New · White + Orange identity
            </div>
            <h1 className="mt-5 font-display text-[clamp(2.4rem,4vw,3.6rem)] font-bold leading-[1.05] tracking-tight text-white">
              Documents,
              <br /> beautifully organized.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-orange-50/90">
              Create, organize and share documents in a focused workspace.
            </p>
          </motion.div>

          <div className="mt-8 space-y-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }}
                className="flex items-start gap-3 rounded-2xl bg-white/10 p-3.5 pr-5 ring-1 ring-white/20 backdrop-blur-md"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
                  <f.icon className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-white">{f.title}</p>
                  <p className="mt-0.5 text-[13px] text-orange-50/80">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
          <p className="text-[13px] font-medium text-white/90">Create an account to get started</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex min-h-screen flex-col bg-background">
        <div className="flex items-center justify-between px-6 pt-6 sm:px-10 lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-[420px]"
          >
            <div className="rounded-3xl border border-border bg-surface p-7 shadow-[0_24px_64px_-20px_rgba(23,36,58,0.18)] sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary-hover ring-1 ring-orange-border/40">
                <FileText className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-[24px] font-extrabold tracking-tight text-text-primary">
                {mode === "signin" ? "Welcome back" : "Create your workspace"}
              </h2>
              <p className="mt-1 text-[14px] text-text-secondary">
                {mode === "signin" ? "Sign in to continue to DocSpace." : "Create an account to start using DocSpace."}
              </p>

              {/* Tabs */}
              <div className="mt-5 grid grid-cols-2 rounded-xl bg-background p-1 ring-1 ring-border">
                {(["signin", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-all duration-200",
                      mode === m
                        ? "bg-white text-primary-active shadow-sm ring-1 ring-orange-border/50"
                        : "text-text-secondary hover:text-text-primary"
                    )}
                  >
                    {m === "signin" ? "Sign in" : "Sign up"}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="mt-5 space-y-4">
                {mode === "signup" && (
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-text-primary">Full name</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="input-premium focus-ring w-full rounded-xl px-3.5 py-2.5 text-[14px]"
                      placeholder="Ada Lovelace"
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-text-primary">Work email</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="input-premium focus-ring w-full rounded-xl py-2.5 pl-10 pr-3.5 text-[14px]"
                      placeholder="you@company.com"
                      required
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-[13px] font-semibold text-text-primary">Password</label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => pushToast({ title: "Password recovery is unavailable", description: "Contact the workspace administrator to reset your password.", kind: "info" })}
                        className="text-[12.5px] font-semibold text-primary-hover hover:text-primary-active hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <input
                      type={showPw ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="input-premium focus-ring w-full rounded-xl py-2.5 pl-10 pr-11 text-[14px]"
                      placeholder="••••••••"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-text-muted hover:bg-primary-light hover:text-primary-active"
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary focus-ring flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14.5px] font-bold"
                >
                  {loading ? (
                    <span className="spinner-orange rounded-full !border-white/30 !border-t-white" style={{ width: 18, height: 18 }} />
                  ) : (
                    <>
                      {mode === "signin" ? "Sign in to DocSpace" : "Create account"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[12px] font-medium text-text-muted">or continue with</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => sso("Google")} className="btn-secondary focus-ring flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold">
                  <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="#EA580C" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.6h3.2c1.9-1.7 3-4.3 3-7.5z"/><path fill="#F97316" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.6c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.7A10 10 0 0 0 12 22z"/><path fill="#FDBA74" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.4H3.1a10 10 0 0 0 0 9.2l3.3-2.7z"/><path fill="#C2410C" d="M12 5.9c1.5 0 2.8.5 3.8 1.5L18.7 4A10 10 0 0 0 3.1 7.4l3.3 2.7C7.2 7.7 9.4 5.9 12 5.9z"/></svg>
                  Google
                </button>
                <button onClick={() => sso("Microsoft")} className="btn-secondary focus-ring flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold">
                  <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="#F97316" d="M3 3h8.5v8.5H3zM12.5 3H21v8.5h-8.5zM3 12.5h8.5V21H3zM12.5 12.5H21V21h-8.5z"/></svg>
                  Microsoft
                </button>
              </div>

              <div className="mt-5 space-y-2 rounded-xl bg-primary-light p-3.5 ring-1 ring-orange-border/30">
                {["Documents are stored in your account", "Share with registered users", "Email and password authentication"].map((t) => (
                  <p key={t} className="flex items-center gap-2 text-[12.5px] font-medium text-text-primary">
                    <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary text-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {t}
                  </p>
                ))}
              </div>
            </div>
            <p className="mt-5 text-center text-[12.5px] text-text-muted">
              Use a strong password and sign out on shared devices.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
