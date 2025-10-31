"use client";

import { memo } from "react";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";
import { HeaderUserNav } from "./header-user-nav";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  return (
    <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      {!isReadonly && (
        <VisibilitySelector
          chatId={chatId}
          className="ml-auto"
          selectedVisibilityType={selectedVisibilityType}
        />
      )}

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
