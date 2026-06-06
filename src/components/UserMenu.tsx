import { Link } from "react-router-dom";
import { ArrowLeft, LayoutDashboard, LogOut, Shield, User } from "lucide-react";

import { useLogout } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserMenuProps = {
  username: string;
  isAdmin?: boolean;
  showBackoffice?: boolean;
  showReturnToSite?: boolean;
};

const menuItemClass = "gap-2 rounded-md focus:bg-primary/10 focus:text-foreground";

const UserMenu = ({
  username,
  isAdmin,
  showBackoffice = isAdmin,
  showReturnToSite = false,
}: UserMenuProps) => {
  const logout = useLogout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-11 max-w-[170px] rounded-lg border border-border/60 bg-background/50 px-3 text-foreground hover:bg-secondary"
        >
          <User className="h-4 w-4" />
          <span className="hidden truncate sm:inline">{username}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-lg">
        <DropdownMenuLabel className="truncate">{username}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className={menuItemClass}>
          <Link to="/dashboard">
            <LayoutDashboard className="h-4 w-4" />
            Ma progression
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={menuItemClass}>
          <Link to="/profile">
            <User className="h-4 w-4" />
            Mon profil
          </Link>
        </DropdownMenuItem>
        {showBackoffice ? (
          <DropdownMenuItem asChild className={menuItemClass}>
            <Link to="/admin">
              <Shield className="h-4 w-4" />
              Backoffice
            </Link>
          </DropdownMenuItem>
        ) : null}
        {showReturnToSite ? (
          <DropdownMenuItem asChild className={menuItemClass}>
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Retour au site
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 rounded-md text-destructive focus:bg-destructive/10 focus:text-destructive"
          onClick={() => logout.mutate()}
        >
          <LogOut className="h-4 w-4" />
          Se deconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
