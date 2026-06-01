import {
  BarChart3,
  Database,
  FileText,
  GitCompareArrows,
  LayoutDashboard,
  LineChart,
  Package,
  ShoppingBag,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavigationIconId } from "@/lib/navigation";

export const navigationIcons: Record<NavigationIconId, LucideIcon> = {
  dashboard: LayoutDashboard,
  commercial: ShoppingBag,
  logistics: Truck,
  analytics: BarChart3,
  data: Database,
  sales: FileText,
  products: Package,
  clients: Users,
  trends: TrendingUp,
  compare: GitCompareArrows,
  predictions: LineChart,
};
