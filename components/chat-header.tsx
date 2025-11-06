"use client";

import { useRouter } from "next/navigation";
import { memo } from "react";
import { HeaderUserNav } from "./header-user-nav";
import { PlusIcon } from "./icons";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const router = useRouter();

  return (
    <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      <div className="flex items-center gap-2">
        {!isReadonly && (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="hidden h-8 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 md:flex md:h-fit md:px-2"
                    onClick={() => {
                      router.push("/");
                      router.refresh();
                    }}
                    type="button"
                    variant="outline"
                  >
                    <PlusIcon />
                    <span className="md:sr-only">New Page</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent align="start" className="hidden md:block">
                  New Page
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <VisibilitySelector
              chatId={chatId}
              selectedVisibilityType={selectedVisibilityType}
            />
          </>
        )}
      </div>

      <div className="hidden md:ml-auto md:flex">
        <HeaderUserNav />
      </div>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
