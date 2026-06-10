import { defineConfig } from "react-doctor/api";

export default defineConfig({
  ignore: {
    files: ["src/components/ui/**"],
    overrides: [
      {
        files: ["src/features/chat/chat.tsx"],
        rules: [
          "react-doctor/async-await-in-loop",
          "react-doctor/no-giant-component",
          "react-doctor/prefer-useReducer"
        ]
      },
      {
        files: ["src/components/app/ui.tsx"],
        rules: ["react-doctor/no-react19-deprecated-apis"]
      },
      {
        files: ["src/features/chat/message-list.tsx"],
        rules: ["react-doctor/jsx-no-jsx-as-prop"]
      },
      {
        files: ["src/features/debug/memory-debug-drawer.tsx"],
        rules: ["react-doctor/no-event-handler"]
      },
      {
        files: ["src/features/auth/auth-shell.tsx"],
        rules: ["react-doctor/no-multi-comp"]
      }
    ]
  },
  supplyChain: {
    includeDevDependencies: false
  }
});
