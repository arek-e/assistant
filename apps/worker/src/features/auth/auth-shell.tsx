import { useState, type FormEvent } from "react";

import { BrainIcon, CaretDownIcon, SignInIcon } from "@/components/app/icons";
import { Badge, Button, Text } from "@/components/app/ui";
import {
  glassPanelSurfaceClassName,
  glassSurfaceClassName,
  solidSurfaceClassName
} from "@teampitch/ui/lib/surface-tokens";
import { cn } from "@teampitch/ui/lib/utils";

import type { AuthDemoUser, AuthSession } from "./auth-context";

export function AuthLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
      <Text size="sm" variant="secondary">
        Loading...
      </Text>
    </div>
  );
}

export function LoginScreen({
  error,
  demoUsers,
  onSignIn,
  onSignUp,
  onDemoSignIn
}: {
  error: string | null;
  demoUsers: AuthDemoUser[];
  onSignIn: () => void;
  onSignUp: () => void;
  onDemoSignIn: (userId: string) => void;
}) {
  const [demoPickerOpen, setDemoPickerOpen] = useState(false);
  const [email, setEmail] = useState("");

  const startSignIn = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    onSignIn();
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f8fbff] text-[#111827]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(65,160,230,0.15),transparent_30%),radial-gradient(circle_at_88%_80%,rgba(29,78,216,0.12),transparent_28%)]" />
      <div className="relative grid min-h-screen lg:grid-cols-[minmax(0,0.92fr)_minmax(480px,1.08fr)]">
        <section className="flex min-h-screen flex-col px-6 py-6 sm:px-10 lg:px-16">
          <header className="flex items-center justify-between">
            <BrandLockup />
            <Badge className="hidden border border-blue-200/80 bg-blue-50 text-blue-700 sm:inline-flex">
              Agent workspace
            </Badge>
          </header>

          <div className="flex flex-1 items-center justify-center py-12">
            <div className="w-full max-w-[430px]">
              <div className="mb-10 flex justify-center">
                <AppGlyph size="lg" />
              </div>

              <div className="mb-8 space-y-3 text-center">
                <p className="text-sm font-semibold tracking-[0.18em] text-blue-600 uppercase">
                  Teampitch
                </p>
                <h1 className="text-[2.45rem] leading-[1.05] font-semibold text-slate-950 sm:text-5xl">
                  Welcome back
                </h1>
                <p className="mx-auto max-w-[25rem] text-base leading-7 text-slate-500">
                  Sign in to your agent workspace with company identity and scoped memory access.
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <ProviderButton label="Continue with WorkOS" marker="workos" onClick={onSignIn} />
                <ProviderButton label="Continue with company SSO" marker="sso" onClick={onSignIn} />
              </div>

              <div className="my-6 flex items-center gap-3 text-xs font-medium text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                OR
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <form className="space-y-3" onSubmit={startSignIn}>
                <label className="sr-only" htmlFor="login-email">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  aria-label="Email"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                  className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-[15px] text-slate-950 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
                <Button
                  type="submit"
                  variant="primary"
                  className="h-12 w-full bg-blue-600 text-base font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.24)] hover:bg-blue-500"
                >
                  Continue
                </Button>
              </form>

              <button
                type="button"
                onClick={onSignUp}
                className="mt-4 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:ring-4 focus:ring-blue-100 focus:outline-none"
              >
                Create account
              </button>

              {demoUsers.length > 0 && (
                <div className={cn("relative mt-5 p-2", solidSurfaceClassName)}>
                  <button
                    type="button"
                    onClick={() => setDemoPickerOpen((open) => !open)}
                    aria-expanded={demoPickerOpen}
                    className="flex h-10 w-full items-center justify-between rounded-md px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                  >
                    Demo users
                    <CaretDownIcon
                      size={14}
                      className={demoPickerOpen ? "rotate-180 transition" : "transition"}
                    />
                  </button>
                  {demoPickerOpen && (
                    <div className="mt-2 grid gap-2">
                      {demoUsers.map((user) => (
                        <button
                          type="button"
                          key={user.id}
                          aria-label={`Sign in as ${user.label}`}
                          onClick={() => onDemoSignIn(user.id)}
                          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-blue-200 hover:bg-blue-50 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-slate-900">
                                {user.label}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                {user.description}
                              </span>
                            </span>
                            <Badge className="bg-white text-slate-600" variant="secondary">
                              {user.role}
                            </Badge>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <p className="mt-8 text-center text-xs leading-6 text-slate-400">
                By continuing, you agree to the Terms of Service and Privacy Policy.
              </p>
            </div>
          </div>
        </section>

        <section className="hidden min-h-screen p-6 lg:flex">
          <ProductPreviewPanel />
        </section>
      </div>
    </main>
  );
}

function BrandLockup() {
  return (
    <div className="flex items-center gap-3">
      <AppGlyph size="sm" />
      <span className="text-xl font-semibold tracking-[-0.01em] text-slate-950">Teampitch</span>
    </div>
  );
}

function AppGlyph({ size }: { size: "sm" | "lg" }) {
  return (
    <span
      className={
        size === "lg"
          ? "grid size-14 place-items-center rounded-2xl border border-white/70 bg-white text-blue-600 shadow-[0_18px_40px_rgba(15,23,42,0.14)]"
          : "grid size-10 place-items-center rounded-lg border border-slate-200 bg-white text-blue-600 shadow-sm"
      }
    >
      <BrainIcon size={size === "lg" ? 28 : 20} />
    </span>
  );
}

function ProviderButton({
  label,
  marker,
  onClick
}: {
  label: string;
  marker: "workos" | "sso";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 text-[15px] font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:ring-4 focus:ring-blue-100 focus:outline-none"
    >
      {marker === "workos" ? <WorkOSMark /> : <SsoMark />}
      {label}
    </button>
  );
}

function WorkOSMark() {
  return (
    <span className="grid size-5 grid-cols-2 gap-0.5 rounded-sm" aria-hidden="true">
      <span className="rounded-[2px] bg-[#00a1ff]" />
      <span className="rounded-[2px] bg-[#635bff]" />
      <span className="rounded-[2px] bg-[#14b8a6]" />
      <span className="rounded-[2px] bg-[#f97316]" />
    </span>
  );
}

function SsoMark() {
  return (
    <span
      className="grid size-5 place-items-center rounded-full border border-slate-300 bg-slate-50"
      aria-hidden="true"
    >
      <SignInIcon size={13} className="text-slate-700" />
    </span>
  );
}

function ProductPreviewPanel() {
  return (
    <div
      className={cn(
        glassPanelSurfaceClassName,
        "relative flex w-full rounded-[2rem] border-white/70 bg-[linear-gradient(145deg,#d9efff_0%,#f7fbff_52%,#e7f1ff_100%)] shadow-[0_24px_80px_rgba(15,23,42,0.12)]"
      )}
    >
      <div
        className="absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(37,99,235,0.24) 1px, transparent 0)",
          backgroundSize: "18px 18px"
        }}
      />
      <div className="absolute -top-24 right-12 h-80 w-80 rounded-full border border-blue-300/30" />
      <div className="absolute -top-10 right-28 h-64 w-64 rounded-full border border-blue-300/30" />
      <SoftCloud className="top-28 left-10 h-28 w-52 opacity-70" />
      <SoftCloud className="right-12 bottom-16 h-36 w-72 opacity-60" />

      <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
        <div className="flex items-center justify-between">
          <Badge className="border border-white/70 bg-white/80 text-slate-700 shadow-sm">
            Live workspace
          </Badge>
          <div className="flex -space-x-2">
            {["bg-blue-500", "bg-emerald-500", "bg-amber-500"].map((color) => (
              <span
                key={color}
                className={`size-8 rounded-full border-2 border-white shadow-sm ${color}`}
              />
            ))}
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-xl gap-4">
          <div className={cn("relative p-4", glassSurfaceClassName)}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-blue-600 uppercase">
                  Agent identity
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-950">Sarah via Codex</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Scoped
              </span>
            </div>
            <div className="grid gap-2">
              <PreviewGrant label="Private memory" tone="blue" value="read, write" />
              <PreviewGrant label="Team workspace" tone="emerald" value="read" />
              <PreviewGrant label="Approvals" tone="amber" value="blocked" />
            </div>
          </div>

          <div className={cn("relative ml-auto w-[82%] p-4", glassSurfaceClassName)}>
            <div className="mb-3 flex items-center gap-2">
              <span className="size-2 rounded-full bg-blue-500" />
              <span className="text-sm font-semibold text-slate-800">Memory routing</span>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
              Route this task with the current subject and grants.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <PreviewMetric label="Subject" value="workos_user" />
          <PreviewMetric label="Scopes" value="3 active" />
          <PreviewMetric label="Audit" value="on" />
        </div>
      </div>
    </div>
  );
}

function SoftCloud({ className }: { className: string }) {
  return (
    <div className={`absolute rounded-full bg-white/70 blur-xl ${className}`}>
      <span className="absolute top-3 left-6 h-20 w-28 rounded-full bg-white/80" />
      <span className="absolute top-7 left-24 h-24 w-32 rounded-full bg-white/70" />
      <span className="absolute top-12 left-40 h-16 w-24 rounded-full bg-white/75" />
    </div>
  );
}

function PreviewGrant({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "blue" | "emerald" | "amber";
}) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-amber-50 text-amber-700";

  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn("relative px-4 py-3", glassSurfaceClassName)}>
      <p className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function AccountControls({
  session,
  onSignOut
}: {
  session: AuthSession;
  onSignOut: () => void;
}) {
  const label = accountLabel(session);
  const detail = accountDetail(session);

  return (
    <div className="flex items-center gap-2">
      <div className="hidden max-w-[180px] flex-col items-end sm:flex">
        <Text size="xs" bold className="max-w-full truncate">
          {label}
        </Text>
        <Text size="xs" variant="secondary" className="max-w-full truncate">
          {detail}
        </Text>
      </div>
      <Button variant="outline" size="sm" onClick={onSignOut}>
        Sign out
      </Button>
    </div>
  );
}

function accountLabel(session: AuthSession): string {
  return (
    [
      accountUserName(session),
      accountUserEmail(session),
      accountIdentityDisplayName(session),
      accountIdentitySubjectId(session)
    ].find(isNonEmptyString) ?? "Signed in"
  );
}

function accountDetail(session: AuthSession): string {
  return accountIdentityRole(session) ?? "Workspace member";
}

function accountUserName(session: AuthSession): string | undefined {
  return session.user?.name;
}

function accountUserEmail(session: AuthSession): string | undefined {
  return session.user?.email;
}

function accountIdentityDisplayName(session: AuthSession): string | undefined {
  return session.identity?.displayName;
}

function accountIdentitySubjectId(session: AuthSession): string | undefined {
  return session.identity?.subjectId;
}

function accountIdentityRole(session: AuthSession): string | undefined {
  return session.identity?.role;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
