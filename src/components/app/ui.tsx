import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { Badge as CossBadge } from "@/components/ui/badge";
import { Button as CossButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty as CossEmpty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Switch as CossSwitch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
    variant === "primary"
      ? "default"
      : variant === "outline"
        ? "outline"
        : variant;
  const cossSize =
    shape === "square"
      ? size === "sm"
        ? "icon-sm"
        : "icon"
      : size === "md"
        ? "default"
        : size;

  return (
    <CossButton
      className={className}
      size={cossSize}
      variant={cossVariant}
      {...props}
    >
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
    <CossBadge
      className={className}
      variant={variant === "primary" ? "default" : variant}
    >
      {children}
    </CossBadge>
  );
}

export function Surface({ className, ...props }: ComponentProps<"div">) {
  return <Card className={cn("shadow-none", className)} {...props} />;
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

export function Empty({
  icon,
  title,
  contents
}: {
  icon: ReactNode;
  title: string;
  contents: ReactNode;
}) {
  return (
    <CossEmpty className="min-h-[320px]">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>{contents}</EmptyContent>
    </CossEmpty>
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
  return (
    <CossSwitch
      aria-label={ariaLabel}
      checked={checked}
      onCheckedChange={onCheckedChange}
    />
  );
}
