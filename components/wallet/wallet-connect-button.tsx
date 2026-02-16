"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
// import { useEffect, useState } from "react";

// // Simple mobile detection hook using a Tailwind-esque sm breakpoint (640px)
// function useIsMobile(maxWidth: number = 640) {
//   const [isMobile, setIsMobile] = useState(false);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const mql = window.matchMedia(`(max-width: ${maxWidth}px)`);
//     const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
//       setIsMobile("matches" in e ? e.matches : (e as MediaQueryList).matches);
//     };
//     // Set initial
//     handleChange(mql);
//     // Listen for changes
//     if (mql.addEventListener) {
//       mql.addEventListener("change", handleChange as (e: MediaQueryListEvent) => void);
//     } else {
//       // Safari <14 fallback
//       // @ts-ignore
//       mql.addListener(handleChange);
//     }
//     return () => {
//       if (mql.removeEventListener) {
//         mql.removeEventListener("change", handleChange as (e: MediaQueryListEvent) => void);
//       } else {
//         // @ts-ignore
//         mql.removeListener(handleChange);
//       }
//     };
//   }, [maxWidth]);

//   return isMobile;
// }

export function WalletConnectButton() {
  // const mobile = useIsMobile();
  return (
    <ConnectButton
      chainStatus="none"
      label="Connect"
      showBalance={false}
    />
  );
}
