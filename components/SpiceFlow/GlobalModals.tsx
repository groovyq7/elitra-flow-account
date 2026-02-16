"use client";

import React from "react";
import dynamic from "next/dynamic";

// Lazy-load to avoid SSR issues with SDK components
const DepositFlow = dynamic(
  () => import("./DepositFlow").then((m) => ({ default: m.DepositFlow })),
  { ssr: false }
);

const WithdrawFlow = dynamic(
  () => import("./WithdrawFlow").then((m) => ({ default: m.WithdrawFlow })),
  { ssr: false }
);

export const GlobalModals: React.FC = () => {
  return (
    <>
      <DepositFlow />
      <WithdrawFlow />
    </>
  );
};
