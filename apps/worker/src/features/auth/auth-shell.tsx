import { BrainIcon, SignInIcon } from "@/components/app/icons";
import { Badge, Button, Text } from "@/components/app/ui";
import type { AuthSession } from "./auth-context";

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
  onSignIn,
  onSignUp
}: {
  error: string | null;
  onSignIn: () => void;
  onSignUp: () => void;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-5">
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">
              <span className="mr-2">⛅</span>Teampitch
            </h1>
            <Badge variant="secondary">
              <BrainIcon size={12} className="mr-1" />
              Think
            </Badge>
          </div>
        </header>

        <section className="flex flex-1 items-center">
          <div className="w-full max-w-sm space-y-5">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Sign in</h2>
              <Text variant="secondary">
                Use your WorkOS account to open the assistant.
              </Text>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
                {error}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                icon={<SignInIcon size={16} />}
                onClick={onSignIn}
              >
                Sign in
              </Button>
              <Button variant="outline" onClick={onSignUp}>
                Create account
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function AccountControls({
  session,
  onSignOut
}: {
  session: AuthSession;
  onSignOut: () => void;
}) {
  const label =
    session.user?.name ??
    session.user?.email ??
    session.identity?.displayName ??
    session.identity?.subjectId ??
    "Signed in";

  return (
    <div className="flex items-center gap-2">
      <div className="hidden max-w-[180px] flex-col items-end sm:flex">
        <Text size="xs" bold className="max-w-full truncate">
          {label}
        </Text>
        <Text size="xs" variant="secondary" className="max-w-full truncate">
          {session.identity?.role || session.provider}
        </Text>
      </div>
      <Button variant="outline" size="sm" onClick={onSignOut}>
        Sign out
      </Button>
    </div>
  );
}
