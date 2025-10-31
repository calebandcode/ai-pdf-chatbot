"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { guestRegex } from "@/lib/constants";
import { LoaderIcon } from "./icons";
import { toast } from "./toast";

export function HeaderUserNav() {
  const router = useRouter();
  const { data, status } = useSession();

  const user = data?.user;
  const isGuest = user?.email ? guestRegex.test(user.email) : false;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {status === "loading" ? (
          <Button
            className="hidden h-8 gap-2 md:flex"
            disabled
            variant="outline"
          >
            <div className="size-6 animate-pulse rounded-full bg-zinc-500/30" />
            <div className="animate-spin text-zinc-500">
              <LoaderIcon />
            </div>
          </Button>
        ) : user ? (
          <Button
            className="hidden h-8 gap-2 md:flex"
            data-testid="header-user-nav-button"
            variant="outline"
          >
            <Image
              alt={user.email ?? "User Avatar"}
              className="rounded-full"
              height={20}
              src={`https://avatar.vercel.sh/${user.email}`}
              width={20}
            />
            <span className="hidden truncate text-sm lg:inline" data-testid="user-email">
              {isGuest ? "Guest" : user.email}
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56"
        data-testid="header-user-nav-menu"
      >
        <DropdownMenuItem asChild data-testid="header-user-nav-item-auth">
          <button
            className="w-full cursor-pointer"
            onClick={() => {
              if (status === "loading") {
                toast({
                  type: "error",
                  description:
                    "Checking authentication status, please try again!",
                });

                return;
              }

              if (isGuest) {
                router.push("/login");
              } else {
                signOut({
                  redirectTo: "/",
                });
              }
            }}
            type="button"
          >
            {isGuest ? "Login to your account" : "Sign out"}
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

