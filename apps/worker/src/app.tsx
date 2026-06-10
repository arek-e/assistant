import { Suspense } from "react";

import { Chat } from "@/features/chat/chat";
import { AnchoredToastProvider, ToastProvider } from "@teampitch/ui/components/toast";

export default function App() {
  return (
    <ToastProvider>
      <AnchoredToastProvider>
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center text-muted-foreground">
              Loading...
            </div>
          }
        >
          <Chat />
        </Suspense>
      </AnchoredToastProvider>
    </ToastProvider>
  );
}
