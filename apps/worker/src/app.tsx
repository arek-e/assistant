import { Suspense } from "react";
import {
  AnchoredToastProvider,
  ToastProvider
} from "@teampitch/ui/components/toast";
import { AuthProvider, useAuth } from "@/features/auth/auth-context";
import { AuthLoading, LoginScreen } from "@/features/auth/auth-shell";
import { Chat } from "@/features/chat/chat";

export default function App() {
  return (
    <ToastProvider>
      <AnchoredToastProvider>
        <AuthProvider>
          <Suspense fallback={<AuthLoading />}>
            <AuthenticatedApp />
          </Suspense>
        </AuthProvider>
      </AnchoredToastProvider>
    </ToastProvider>
  );
}

function AuthenticatedApp() {
  const auth = useAuth();

  if (auth.loading) return <AuthLoading />;

  if (!auth.session) {
    return (
      <LoginScreen
        error={auth.error}
        onSignIn={auth.signIn}
        onSignUp={auth.signUp}
      />
    );
  }

  return <Chat auth={auth.session} onSignOut={auth.signOut} />;
}
