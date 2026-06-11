import {
  RouterContextProvider,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useLocation,
  useNavigate
} from "@tanstack/react-router";
import { Suspense, startTransition, useCallback } from "react";

import { AuthProvider, useAuth } from "@/features/auth/auth-context";
import { AuthLoading, LoginScreen } from "@/features/auth/auth-shell";
import { Chat } from "@/features/chat/chat";
import type { PrimaryAppView } from "@/features/chat/ui/assistant-app-shell";
import { SettingsRoute } from "@/features/settings/settings";
import { AnchoredToastProvider, ToastProvider } from "@teampitch/ui/components/toast";

type AppRoute = PrimaryAppView | "settings";
type AppRoutePath = "/" | "/chats" | "/integrations" | "/settings";

const rootRoute = createRootRoute();

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/"
});

const chatsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "chats"
});

const integrationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "integrations"
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "settings"
});

const fallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "$",
  beforeLoad: () => {
    throw redirect({ to: "/" });
  }
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  chatsRoute,
  integrationsRoute,
  settingsRoute,
  fallbackRoute
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <ToastProvider>
      <AnchoredToastProvider>
        <AuthProvider>
          <RouterContextProvider router={router}>
            <Suspense fallback={<AuthLoading />}>
              <AuthenticatedApp />
            </Suspense>
          </RouterContextProvider>
        </AuthProvider>
      </AnchoredToastProvider>
    </ToastProvider>
  );
}

function AuthenticatedApp() {
  const pathname = useLocation({
    select: (location) => location.pathname
  });

  return <AuthenticatedAppRoute activeRoute={appRouteFromPathname(pathname)} />;
}

function AuthenticatedAppRoute({ activeRoute }: { activeRoute: AppRoute }) {
  const auth = useAuth();
  const navigate = useNavigate();

  const navigatePath = useCallback(
    (nextPath: AppRoutePath) => {
      runRouteViewTransition(() => {
        void navigate({ to: nextPath });
      });
    },
    [navigate]
  );

  if (auth.loading) return <AuthLoading />;

  if (!auth.session) {
    return (
      <LoginScreen
        error={auth.error}
        demoUsers={auth.demoUsers}
        onSignIn={auth.signIn}
        onSignUp={auth.signUp}
        onDemoSignIn={auth.demoSignIn}
      />
    );
  }

  if (activeRoute === "settings") {
    return (
      <div className="relative h-screen overflow-hidden bg-[#f2f2ef]">
        <SettingsRoute
          auth={auth.session}
          onNavigateChat={() => navigatePath(getRememberedAppRoutePath())}
          onSignOut={auth.signOut}
        />
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden bg-[#f2f2ef]">
      <Chat
        auth={auth.session}
        activeView={activeRoute}
        onNavigateView={(view) => navigatePath(pathnameForAppView(view))}
        onOpenSettings={() => {
          rememberAppRoute(pathnameForAppView(activeRoute));
          navigatePath("/settings");
        }}
        onSignOut={auth.signOut}
      />
    </div>
  );
}

function pathnameForAppView(view: PrimaryAppView): AppRoutePath {
  if (view === "home") return "/";
  if (view === "chats") return "/chats";
  return "/integrations";
}

function appRouteFromPathname(pathname: string): AppRoute {
  if (pathname === "/settings") return "settings";
  if (pathname === "/chats") return "chats";
  if (pathname === "/integrations") return "integrations";
  return "home";
}

function rememberAppRoute(pathname: AppRoutePath) {
  if (pathname === "/settings") return;
  window.sessionStorage.setItem("teampitch:last-app-route", pathname);
}

function getRememberedAppRoutePath(): AppRoutePath {
  const pathname = window.sessionStorage.getItem("teampitch:last-app-route");
  if (pathname === "/" || pathname === "/chats" || pathname === "/integrations") {
    return pathname;
  }

  return "/";
}

function runRouteViewTransition(updateRoute: () => void) {
  const startViewTransition = getStartViewTransition();

  if (!startViewTransition) {
    startTransition(updateRoute);
    return;
  }

  startViewTransition(() => {
    startTransition(updateRoute);
  });
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => void) => void;
};

function getStartViewTransition() {
  const transitionDocument = document as ViewTransitionDocument;

  if (
    "startViewTransition" in document &&
    typeof transitionDocument.startViewTransition === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return transitionDocument.startViewTransition.bind(document);
  }

  return null;
}
