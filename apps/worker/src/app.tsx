import { Suspense } from "react";
import {
  AnchoredToastProvider,
  ToastProvider
} from "@teampitch/ui/components/toast";
import { Chat } from "@/features/chat/chat";

export default function App() {
  return (
    <ToastProvider>
      <AnchoredToastProvider>
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-screen text-muted-foreground">
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
