import { forwardRef, type ComponentProps, type ReactNode } from "react";

import { Badge as CossBadge } from "@teampitch/ui/components/badge";
import { Button as CossButton } from "@teampitch/ui/components/button";
import { Calendar as CossCalendar } from "@teampitch/ui/components/calendar";
import { Card } from "@teampitch/ui/components/card";
import { Checkbox as CossCheckbox } from "@teampitch/ui/components/checkbox";
import { Input as CossInput } from "@teampitch/ui/components/input";
import { Label as CossLabel } from "@teampitch/ui/components/label";
import {
  Radio as CossRadio,
  RadioGroup as CossRadioGroup
} from "@teampitch/ui/components/radio-group";
import { Switch as CossSwitch } from "@teampitch/ui/components/switch";
import { Textarea } from "@teampitch/ui/components/textarea";
import { glassSurfaceClassName, solidSurfaceClassName } from "@teampitch/ui/lib/surface-tokens";
import { cn } from "@teampitch/ui/lib/utils";

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md";
  shape?: "square";
  icon?: ReactNode;
};

export function Button({
  variant = "secondary",
  size = "md",
  shape,
  icon,
  children,
  className,
  ...props
}: ButtonProps) {
  const cossVariant =
    variant === "primary" ? "default" : variant === "outline" ? "outline" : variant;
  const cossSize =
    shape === "square" ? (size === "sm" ? "icon-sm" : "icon") : size === "md" ? "default" : size;

  return (
    <CossButton className={className} size={cossSize} variant={cossVariant} {...props}>
      {icon}
      {children}
    </CossButton>
  );
}

export function Badge({
  variant = "secondary",
  className,
  children
}: {
  variant?: "primary" | "secondary" | "destructive";
  className?: string;
  children: ReactNode;
}) {
  return (
    <CossBadge className={className} variant={variant === "primary" ? "default" : variant}>
      {children}
    </CossBadge>
  );
}

type InputProps = ComponentProps<typeof CossInput> & {
  onValueChange?: (value: string) => void;
};

export function Input({ onChange, onValueChange, ...props }: InputProps) {
  return (
    <CossInput
      onChange={(event) => {
        onChange?.(event);
        onValueChange?.(event.currentTarget.value);
      }}
      {...props}
    />
  );
}

export function Checkbox(props: ComponentProps<typeof CossCheckbox>) {
  return <CossCheckbox {...props} />;
}

export function RadioGroup(props: ComponentProps<typeof CossRadioGroup>) {
  return <CossRadioGroup {...props} />;
}

export function Radio(props: ComponentProps<typeof CossRadio>) {
  return <CossRadio {...props} />;
}

export function Label(props: ComponentProps<typeof CossLabel>) {
  return <CossLabel {...props} />;
}

export function Calendar(props: ComponentProps<typeof CossCalendar>) {
  return <CossCalendar {...props} />;
}

type SurfaceProps = ComponentProps<"div"> & {
  variant?: "glass" | "solid";
};

export function Surface({ className, variant = "glass", ...props }: SurfaceProps) {
  return (
    <Card
      className={cn(variant === "solid" ? solidSurfaceClassName : glassSurfaceClassName, className)}
      {...props}
    />
  );
}

export function Text({
  size = "sm",
  variant,
  bold,
  as,
  className,
  children
}: {
  size?: "xs" | "sm";
  variant?: "secondary" | "heading3";
  bold?: boolean;
  as?: "span";
  className?: string;
  children: ReactNode;
}) {
  const Component = as ?? "span";
  return (
    <Component
      className={cn(
        size === "xs" ? "text-xs" : "text-sm",
        variant === "secondary" && "text-muted-foreground",
        variant === "heading3" && "text-lg font-semibold text-foreground",
        bold && "font-semibold",
        className
      )}
    >
      {children}
    </Component>
  );
}

type InputAreaProps = ComponentProps<"textarea"> & {
  onValueChange?: (value: string) => void;
};

export const InputArea = forwardRef<HTMLTextAreaElement, InputAreaProps>(
  ({ className, onChange, onValueChange, ...props }, ref) => (
    <Textarea
      ref={ref}
      className={cn(
        "min-h-9 border-transparent bg-transparent shadow-none before:hidden has-focus-visible:ring-0",
        className
      )}
      onChange={(event) => {
        onChange?.(event);
        onValueChange?.(event.currentTarget.value);
      }}
      {...props}
    />
  )
);
InputArea.displayName = "InputArea";

export function Switch({
  checked,
  onCheckedChange,
  "aria-label": ariaLabel
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  size?: "sm";
  "aria-label": string;
}) {
  return <CossSwitch aria-label={ariaLabel} checked={checked} onCheckedChange={onCheckedChange} />;
}
