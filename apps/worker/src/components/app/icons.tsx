import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  Attachment01Icon,
  BrainIcon as BrainIconData,
  Briefcase01Icon,
  Calendar03Icon,
  Cancel01Icon,
  CancelCircleIcon,
  ChatSearchIcon,
  ChatBotIcon,
  CheckmarkCircle01Icon,
  CheckListIcon as CheckListIconData,
  Clock01Icon,
  ContactIcon as ContactIconData,
  Delete02Icon,
  Home03Icon,
  Image01Icon,
  Link01Icon,
  Login01Icon,
  McpServerIcon,
  MoreHorizontalIcon as MoreHorizontalIconData,
  Moon02Icon,
  Navigation03Icon,
  Note01Icon,
  PanelLeftCloseIcon,
  PanelRightIcon,
  Search01Icon,
  Settings01Icon,
  StopIcon as StopIconData,
  Sun03Icon,
  Wrench01Icon
} from "@hugeicons-pro/core-bulk-rounded";
import { PlusSignIcon } from "@hugeicons-pro/core-solid-rounded";

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
export const MoonIcon = createIcon(Moon02Icon);
export const SunIcon = createIcon(Sun03Icon);
export const CheckCircleIcon = createIcon(CheckmarkCircle01Icon);
export const XCircleIcon = createIcon(CancelCircleIcon);
export const BrainIcon = createIcon(BrainIconData);
export const CaretDownIcon = createIcon(ArrowDown01Icon);
export const PlugsConnectedIcon = createIcon(McpServerIcon);
export const PlusIcon = createIcon(PlusSignIcon);
export const SignInIcon = createIcon(Login01Icon);
export const XIcon = createIcon(Cancel01Icon);
export const WrenchIcon = createIcon(Wrench01Icon);
export const PaperclipIcon = createIcon(Attachment01Icon);
export const ImageIcon = createIcon(Image01Icon);
export const BriefcaseIcon = createIcon(Briefcase01Icon);
export const CalendarIcon = createIcon(Calendar03Icon);
export const CheckListIcon = createIcon(CheckListIconData);
export const ClockIcon = createIcon(Clock01Icon);
export const ContactIcon = createIcon(ContactIconData);
export const HomeIcon = createIcon(Home03Icon);
export const LinkIcon = createIcon(Link01Icon);
export const MoreHorizontalIcon = createIcon(MoreHorizontalIconData);
export const NoteIcon = createIcon(Note01Icon);
export const PanelLeftClose = createIcon(PanelLeftCloseIcon);
export const PanelRight = createIcon(PanelRightIcon);
export const SearchIcon = createIcon(Search01Icon);
export const ChatSearch = createIcon(ChatSearchIcon);
