import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AgentAvatar,
  AgentAvatarShowcase,
  type AgentVisualState
} from "./agent-avatar";

const states = [
  "idle",
  "thinking",
  "speaking",
  "tool",
  "success",
  "error"
] satisfies AgentVisualState[];

const meta = {
  title: "Agent/Avatar",
  component: AgentAvatar,
  args: {
    state: "idle",
    size: "lg",
    darkMode: false
  },
  argTypes: {
    state: {
      control: "select",
      options: states
    },
    size: {
      control: "inline-radio",
      options: ["sm", "md", "lg"]
    },
    darkMode: {
      control: "boolean"
    }
  },
  render: ({ darkMode, ...args }) => (
    <div
      data-mode={darkMode ? "dark" : undefined}
      className="min-w-80 rounded-lg border border-border bg-background p-8 text-foreground"
    >
      <AgentAvatar {...args} />
    </div>
  )
} satisfies Meta<
  ComponentProps<typeof AgentAvatar> & {
    darkMode: boolean;
  }
>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Controlled: Story = {};

export const StateSheet: Story = {
  render: ({ darkMode }) => (
    <div
      data-mode={darkMode ? "dark" : undefined}
      className="grid grid-cols-3 gap-5 rounded-lg border border-border bg-background p-6 text-foreground"
    >
      {states.map((state) => (
        <div key={state} className="grid justify-items-center gap-2">
          <AgentAvatar state={state} size="lg" />
          <span className="font-mono text-xs uppercase text-muted-foreground">
            {state}
          </span>
        </div>
      ))}
    </div>
  )
};

export const Showcase: Story = {
  render: ({ state, darkMode }) => (
    <div
      data-mode={darkMode ? "dark" : undefined}
      className="w-[42rem] bg-background p-6 text-foreground"
    >
      <AgentAvatarShowcase liveState={state} />
    </div>
  )
};
