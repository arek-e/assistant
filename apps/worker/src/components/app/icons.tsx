import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  Attachment01Icon,
  BrainIcon as BrainIconData,
  Bug01Icon,
  Cancel01Icon,
  CancelCircleIcon,
  ChatBotIcon,
  CheckmarkCircle01Icon,
  Delete02Icon,
  Image01Icon,
  Login01Icon,
  McpServerIcon,
  Moon02Icon,
  Navigation03Icon,
  Settings01Icon,
  StopIcon as StopIconData,
  Sun03Icon,
  Wrench01Icon
} from "@hugeicons-pro/core-bulk-rounded";
import {
  CircleIcon as SolidCircleIcon,
  PlusSignIcon
} from "@hugeicons-pro/core-solid-rounded";

type IconProps = Omit<
  React.ComponentProps<typeof HugeiconsIcon>,
  "icon" | "altIcon"
>;

function createIcon(icon: IconSvgElement) {
  return function Icon(props: IconProps) {
    return <HugeiconsIcon icon={icon} {...props} />;
  };
}

export const PaperPlaneRightIcon = createIcon(Navigation03Icon);
export const StopIcon = createIcon(StopIconData);
export const TrashIcon = createIcon(Delete02Icon);
export const GearIcon = createIcon(Settings01Icon);
export const ChatCircleDotsIcon = createIcon(ChatBotIcon);
export const CircleIcon = createIcon(SolidCircleIcon);
export const MoonIcon = createIcon(Moon02Icon);
export const SunIcon = createIcon(Sun03Icon);
export const CheckCircleIcon = createIcon(CheckmarkCircle01Icon);
export const XCircleIcon = createIcon(CancelCircleIcon);
export const BrainIcon = createIcon(BrainIconData);
export const CaretDownIcon = createIcon(ArrowDown01Icon);
export const BugIcon = createIcon(Bug01Icon);
export const PlugsConnectedIcon = createIcon(McpServerIcon);
export const PlusIcon = createIcon(PlusSignIcon);
export const SignInIcon = createIcon(Login01Icon);
export const XIcon = createIcon(Cancel01Icon);
export const WrenchIcon = createIcon(Wrench01Icon);
export const PaperclipIcon = createIcon(Attachment01Icon);
export const ImageIcon = createIcon(Image01Icon);
