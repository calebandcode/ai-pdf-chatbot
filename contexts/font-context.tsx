"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type FontFamily = "inter" | "merriweather" | "lora" | "manrope" | "roboto-mono";

interface FontContextType {
  fontFamily: FontFamily;
  fontSize: number;
  setFontFamily: (font: FontFamily) => void;
  setFontSize: (size: number) => void;
  isMagnifierActive: boolean;
  setIsMagnifierActive: (active: boolean) => void;
}

const FontContext = createContext<FontContextType | undefined>(undefined);

export function FontProvider({ children }: { children: ReactNode }) {
  const [fontFamily, setFontFamilyState] = useState<FontFamily>("inter");
  const [fontSize, setFontSizeState] = useState<number>(16);
  const [isMagnifierActive, setIsMagnifierActive] = useState<boolean>(false);

  // Load from localStorage on mount
  useEffect(() => {
    const storedFont = localStorage.getItem("reading-font") as FontFamily | null;
    const storedSize = localStorage.getItem("reading-font-size");
    
    if (storedFont && ["inter", "merriweather", "lora", "manrope", "roboto-mono"].includes(storedFont)) {
      setFontFamilyState(storedFont);
    }
    
    if (storedSize) {
      const size = parseInt(storedSize, 10);
      if (size >= 12 && size <= 32) {
        setFontSizeState(size);
      }
    }
  }, []);

  // Save to localStorage when settings change
  useEffect(() => {
    localStorage.setItem("reading-font", fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    localStorage.setItem("reading-font-size", fontSize.toString());
  }, [fontSize]);

  const setFontFamily = (font: FontFamily) => {
    setFontFamilyState(font);
  };

  const setFontSize = (size: number) => {
    if (size >= 12 && size <= 32) {
      setFontSizeState(size);
    }
  };

  return (
    <FontContext.Provider
      value={{
        fontFamily,
        fontSize,
        setFontFamily,
        setFontSize,
        isMagnifierActive,
        setIsMagnifierActive,
      }}
    >
      {children}
    </FontContext.Provider>
  );
}

export function useFont() {
  const context = useContext(FontContext);
  if (context === undefined) {
    throw new Error("useFont must be used within a FontProvider");
  }
  return context;
}




