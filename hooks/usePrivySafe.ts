"use client";

import { useContext, createContext, useState, useEffect } from "react";

/**
 * Context that tracks whether the SpiceFlow (and thus Privy) provider
 * has mounted. Components can check this before calling Privy hooks.
 */
export const SpiceFlowReadyContext = createContext(false);

/**
 * Hook that returns true once SpiceFlowProvider has mounted its
 * internal PrivyProvider. Use this to guard Privy hook calls.
 */
export function useSpiceFlowReady() {
  return useContext(SpiceFlowReadyContext);
}
