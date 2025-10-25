import { cookies } from "next/headers";
import Script from "next/script";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { auth } from "../(auth)/auth";

export const experimental_ppr = true;

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <DataStreamProvider>
        <div className="min-h-screen bg-white">
          {children}
        </div>
      </DataStreamProvider>
    </>
  );
}
