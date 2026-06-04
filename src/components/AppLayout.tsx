import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ChevronDown,
  Citrus,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenuAction,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CommandPalette, useCommandPalette } from "@/components/CommandPalette";
import { TopBar } from "@/components/TopBar";
import { MIN_CAMPAIGN_LABEL } from "@/lib/campaigns";
import { isNavigationRouteActive, navigationSections, type NavigationItem } from "@/lib/navigation";
import { navigationIcons } from "@/lib/navigationIcons";
import { preloadPage } from "@/lib/pagePreloads";

function isSectionActive(pathname: string, item: NavigationItem) {
  return (
    isNavigationRouteActive(pathname, item.to) ||
    item.children?.some((child) => isNavigationRouteActive(pathname, child.to)) ||
    false
  );
}

export default function AppLayout() {
  const cmd = useCommandPalette();
  const location = useLocation();

  const renderNavLink = (item: NavigationItem, className = "nav-button") => {
    const Icon = navigationIcons[item.icon];

    return (
      <NavLink
        to={item.to}
        end={item.to === "/"}
        className={className}
        onFocus={() => preloadPage(item.to)}
        onMouseEnter={() => preloadPage(item.to)}
      >
        <Icon />
        <span>{item.label}</span>
      </NavLink>
    );
  };

  return (
    <SidebarProvider className="app-frame !bg-transparent">
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
                {navigationSections.map((item) => {
                  const sectionActive = isSectionActive(location.pathname, item);

                  if (item.children?.length) {
                    return (
                      <Collapsible key={`${item.to}-${sectionActive ? "active" : "idle"}`} asChild defaultOpen={sectionActive} className="group/collapsible">
                        <SidebarMenuItem>
                          <SidebarMenuButton asChild tooltip={item.label} className="nav-button" isActive={sectionActive}>
                            {renderNavLink(item)}
                          </SidebarMenuButton>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuAction
                              aria-label={`Alternar ${item.label}`}
                              className="nav-collapse-trigger group-data-[state=collapsed]/sidebar-wrapper:hidden"
                            >
                              <ChevronDown className="transition-transform group-data-[state=open]/collapsible:rotate-180" />
                            </SidebarMenuAction>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub className="nav-sub-list">
                              {item.children.map((child) => (
                                <SidebarMenuSubItem key={child.to}>
                                  <SidebarMenuSubButton asChild isActive={isNavigationRouteActive(location.pathname, child.to)} className="nav-sub-button">
                                    {renderNavLink(child, "nav-sub-link")}
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild tooltip={item.label} className="nav-button" isActive={sectionActive}>
                        {renderNavLink(item)}
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
