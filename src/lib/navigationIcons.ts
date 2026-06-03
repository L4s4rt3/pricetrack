import {
  Database,
  FileSearch,
  LayoutDashboard,
  Route,
  Scale,
  Users,
} from "lucide-react";
import type { NavigationIconId } from "./navigation";

export const navigationIcons: Record<NavigationIconId, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  logistics: Route,
  search: FileSearch,
  clients: Users,
  compare: Scale,
  data: Database,
};
