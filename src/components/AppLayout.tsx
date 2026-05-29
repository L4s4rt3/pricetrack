import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, Citrus, Database, LayoutDashboard, ShoppingBag, Truck } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { CommandPalette, useCommandPalette } from "@/components/CommandPalette";
import { TopBar } from "@/components/TopBar";
import { MIN_CAMPAIGN_LABEL } from "@/lib/campaigns";
import { preloadPage } from "@/lib/pagePreloads";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/comercial", label: "Comercial", icon: ShoppingBag },
  { to: "/logistica", label: "Logistica", icon: Truck },
  { to: "/analisis", label: "Analisis", icon: BarChart3 },
  { to: "/datos", label: "Datos", icon: Database },
];

export default function AppLayout() {
  const cmd = useCommandPalette();

  return (
    <SidebarProvider className="app-frame">
      <Sidebar collapsible="icon" className="price-sidebar">
        <SidebarHeader className="p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="brand-card h-16">
                <NavLink to="/">
                  <div className="brand-mark flex aspect-square size-11 items-center justify-center rounded-xl text-sidebar-primary-foreground">
                    <Citrus className="size-5" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold text-sidebar-foreground">PriceTrack</span>
                    <span className="truncate text-xs text-sidebar-foreground/55">Dashboard</span>
                  </div>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="sidebar-nav-panel px-3 pb-4 pt-2">
          <SidebarGroup className="nav-section">
            <SidebarGroupLabel>Areas</SidebarGroupLabel>
              <SidebarMenu>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild tooltip={item.label} className="nav-button">
                        <NavLink
                          to={item.to}
                          end={item.to === "/"}
                          onFocus={() => preloadPage(item.to)}
                          onMouseEnter={() => preloadPage(item.to)}
                        >
                          <Icon />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="sidebar-status-wrap p-3">
          <div className="sidebar-status">
            <div>
              <span className="sidebar-status-label">Historico</span>
              <strong>{MIN_CAMPAIGN_LABEL}+</strong>
            </div>
            <span className="sidebar-status-dot" aria-hidden="true" />
          </div>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <TopBar onCommandOpen={() => cmd.setOpen(true)} />
        <div className="app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain scroll-smooth px-4 py-5 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </SidebarInset>
      <CommandPalette open={cmd.open} onOpenChange={cmd.setOpen} />
    </SidebarProvider>
  );
}
