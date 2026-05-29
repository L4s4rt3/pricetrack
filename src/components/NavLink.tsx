import { NavLink as RouterNavLink, type NavLinkProps as RouterNavLinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";

type NavLinkProps = RouterNavLinkProps & {
  activeClassName?: string;
  inactiveClassName?: string;
};

export function NavLink({ className, activeClassName, inactiveClassName, ...props }: NavLinkProps) {
  return (
    <RouterNavLink
      className={(renderProps) =>
        cn(
          typeof className === "function" ? className(renderProps) : className,
          renderProps.isActive ? activeClassName : inactiveClassName
        )
      }
      {...props}
    />
  );
}
