import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type SidebarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used within a SidebarProvider.");
  return context;
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { defaultOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void }
>(({ defaultOpen = true, open: openProp, onOpenChange, className, style, children, ...props }, ref) => {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);
  const [_open, _setOpen] = React.useState(defaultOpen);
  const open = openProp ?? _open;
  const setOpen = React.useCallback(
    (value: boolean) => {
      onOpenChange?.(value);
      _setOpen(value);
    },
    [onOpenChange]
  );
  const toggleSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile((value) => !value);
    else setOpen(!open);
  }, [isMobile, open, setOpen]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "b" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return (
    <SidebarContext.Provider value={{ open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar }}>
      <TooltipProvider delayDuration={0}>
        <div
          ref={ref}
          style={{ "--sidebar-width": "16rem", "--sidebar-width-icon": "4rem", ...style } as React.CSSProperties}
          className={cn("group/sidebar-wrapper flex h-screen min-h-0 w-full overflow-hidden bg-background", className)}
          data-state={open ? "expanded" : "collapsed"}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
});
SidebarProvider.displayName = "SidebarProvider";

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { side?: "left" | "right"; collapsible?: "offcanvas" | "icon" | "none" }
>(({ side = "left", collapsible = "offcanvas", className, children, ...props }, ref) => {
  const { isMobile, openMobile, setOpenMobile, open } = useSidebar();

  if (collapsible === "none") {
    return (
      <div ref={ref} className={cn("flex h-full w-[var(--sidebar-width)] flex-col bg-sidebar text-sidebar-foreground", className)} {...props}>
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent side={side} className="w-[var(--sidebar-width)] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden">
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      ref={ref}
      data-state={open ? "expanded" : "collapsed"}
      data-collapsible={open ? "" : collapsible}
      className={cn(
        "group peer hidden h-screen shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[12px_0_30px_hsl(150_18%_14%/0.08)] transition-[width] duration-150 md:flex md:flex-col",
        open ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-width-icon)]",
        className
      )}
      {...props}
    >
      {children}
    </aside>
  );
});
Sidebar.displayName = "Sidebar";

const SidebarTrigger = React.forwardRef<React.ElementRef<typeof Button>, React.ComponentProps<typeof Button>>(
  ({ className, onClick, ...props }, ref) => {
    const { toggleSidebar } = useSidebar();
    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        className={className}
        onClick={(event) => {
          onClick?.(event);
          toggleSidebar();
        }}
        {...props}
      >
        <PanelLeft />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
    );
  }
);
SidebarTrigger.displayName = "SidebarTrigger";

const SidebarRail = ({ className, ...props }: React.HTMLAttributes<HTMLButtonElement>) => {
  const { toggleSidebar } = useSidebar();
  return <button type="button" aria-label="Alternar barra lateral" className={cn("absolute inset-y-0 left-0 hidden w-1 -translate-x-1/2 outline-none focus-visible:ring-2 focus-visible:ring-ring md:block", className)} onClick={toggleSidebar} {...props} />;
};
SidebarRail.displayName = "SidebarRail";

const SidebarInset = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <main ref={ref} className={cn("relative flex h-screen min-h-0 flex-1 flex-col overflow-hidden", className)} {...props} />
));
SidebarInset.displayName = "SidebarInset";

const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-2 p-2", className)} {...props} />
));
SidebarHeader.displayName = "SidebarHeader";

const SidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2", className)} {...props} />
));
SidebarContent.displayName = "SidebarContent";

const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-2 p-2", className)} {...props} />
));
SidebarFooter.displayName = "SidebarFooter";

const SidebarGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("relative flex w-full min-w-0 flex-col p-2", className)} {...props} />
));
SidebarGroup.displayName = "SidebarGroup";

const SidebarGroupLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return <Comp ref={ref} className={cn("px-2 py-1 text-xs font-medium text-sidebar-foreground/60 group-data-[state=collapsed]/sidebar-wrapper:hidden", className)} {...props} />;
  }
);
SidebarGroupLabel.displayName = "SidebarGroupLabel";

const SidebarGroupAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn("absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", className)} {...props} />;
  }
);
SidebarGroupAction.displayName = "SidebarGroupAction";

const SidebarGroupContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("w-full text-sm", className)} {...props} />
));
SidebarGroupContent.displayName = "SidebarGroupContent";

const SidebarMenu = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(({ className, ...props }, ref) => (
  <ul ref={ref} className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />
));
SidebarMenu.displayName = "SidebarMenu";

const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement>>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("group/menu-item relative", className)} {...props} />
));
SidebarMenuItem.displayName = "SidebarMenuItem";

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean; isActive?: boolean; tooltip?: string; size?: "default" | "sm" | "lg" }
>(({ asChild = false, isActive, tooltip, size = "default", className, onClick, ...props }, ref) => {
  const { isMobile, setOpenMobile, open } = useSidebar();
  const Comp = asChild ? Slot : "button";
  const button = (
    <Comp
      ref={ref}
      data-active={isActive}
      className={cn(
        "flex w-full items-center gap-2 overflow-hidden rounded-lg px-2 text-left text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground group-data-[state=collapsed]/sidebar-wrapper:justify-center group-data-[state=collapsed]/sidebar-wrapper:px-2 group-data-[state=collapsed]/sidebar-wrapper:[&>div:not(:first-child)]:hidden group-data-[state=collapsed]/sidebar-wrapper:[&>span]:hidden [&.active]:bg-sidebar-accent [&.active]:font-semibold [&.active]:text-sidebar-accent-foreground [&.active]:shadow-[inset_3px_0_0_hsl(var(--sidebar-primary))] [&>svg]:size-4 [&>svg]:shrink-0",
        size === "sm" && "h-7 text-xs",
        size === "default" && "h-9",
        size === "lg" && "h-12",
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && isMobile) setOpenMobile(false);
      }}
      {...props}
    />
  );
  if (!tooltip || open || isMobile) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  );
});
SidebarMenuButton.displayName = "SidebarMenuButton";

const SidebarMenuAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean; showOnHover?: boolean }>(
  ({ className, asChild = false, showOnHover = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn("absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", showOnHover && "peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 md:opacity-0", className)} {...props} />;
  }
);
SidebarMenuAction.displayName = "SidebarMenuAction";

const SidebarMenuBadge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("pointer-events-none absolute right-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground", className)} {...props} />
));
SidebarMenuBadge.displayName = "SidebarMenuBadge";

const SidebarMenuSkeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { showIcon?: boolean }>(
  ({ className, showIcon = false, ...props }, ref) => {
    const width = React.useMemo(() => `${Math.floor(Math.random() * 40) + 50}%`, []);
    return (
      <div ref={ref} className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)} {...props}>
        {showIcon && <Skeleton className="size-4 rounded-md" />}
        <Skeleton className="h-4 max-w-[var(--skeleton-width)] flex-1" style={{ "--skeleton-width": width } as React.CSSProperties} />
      </div>
    );
  }
);
SidebarMenuSkeleton.displayName = "SidebarMenuSkeleton";

const SidebarMenuSub = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(({ className, ...props }, ref) => (
  <ul ref={ref} className={cn("mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5", className)} {...props} />
));
SidebarMenuSub.displayName = "SidebarMenuSub";

const SidebarMenuSubItem = React.forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement>>(({ ...props }, ref) => <li ref={ref} {...props} />);
SidebarMenuSubItem.displayName = "SidebarMenuSubItem";

const SidebarMenuSubButton = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement> & { asChild?: boolean; size?: "sm" | "md"; isActive?: boolean }>(
  ({ asChild = false, size = "md", isActive, className, onClick, ...props }, ref) => {
    const { isMobile, setOpenMobile } = useSidebar();
    const Comp = asChild ? Slot : "a";
    return <Comp ref={ref} data-active={isActive} className={cn("flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground", size === "sm" && "text-xs", size === "md" && "text-sm", className)} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented && isMobile) setOpenMobile(false); }} {...props} />;
  }
);
SidebarMenuSubButton.displayName = "SidebarMenuSubButton";

const SidebarSeparator = React.forwardRef<React.ElementRef<typeof Separator>, React.ComponentProps<typeof Separator>>(({ className, ...props }, ref) => (
  <Separator ref={ref} className={cn("mx-2 w-auto bg-sidebar-border", className)} {...props} />
));
SidebarSeparator.displayName = "SidebarSeparator";

const SidebarInput = React.forwardRef<React.ElementRef<typeof Input>, React.ComponentProps<typeof Input>>(({ className, ...props }, ref) => (
  <Input ref={ref} className={cn("h-8 w-full bg-background shadow-none", className)} {...props} />
));
SidebarInput.displayName = "SidebarInput";

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
