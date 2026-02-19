"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import { useAccount } from "wagmi";
import { WalletConnectButton } from "@/components/wallet/wallet-connect-button";
import Link from "next/link";


interface FormData {
  xUsername: string;
  telegram: string;
  walletAddress: string;
}

export function RegistrationForm() {
  const [formData, setFormData] = useState<FormData>({
    xUsername: "",
    telegram: "",
    walletAddress: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isConnected, address } = useAccount();

  // Defer wallet-dependent UI until after hydration to prevent SSR mismatch
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);
  const clientConnected = hasMounted && isConnected;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Auto-populate wallet address when connected
  React.useEffect(() => {
    if (isConnected && address) {
      setFormData((prev) => ({
        ...prev,
        walletAddress: address,
      }));
    }
  }, [isConnected, address]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if wallet is connected
    if (!isConnected) {
      toast.error("Wallet Not Connected");
      return;
    }

    if (!formData.xUsername || !formData.telegram) {
      toast.error("Please fill in all required fields");
      return;
    }

    const formattedFormData = {
      xUsername: !formData.xUsername.startsWith("@")
        ? `@${formData.xUsername.trim()}`
        : formData.xUsername,
      telegram: !formData.telegram.startsWith("@")
        ? `@${formData.telegram.trim()}`
        : formData.telegram,
      walletAddress: formData.walletAddress,
    };

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/campaign/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formattedFormData),
      });

      if (response.ok) {
        toast.success("Registration Successful!");
        setFormData({
          xUsername: "",
          telegram: "",
          walletAddress: "",
        });
      } else {
        throw new Error("Registration failed");
      }
    } catch (error) {
      toast.error("Registration Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Custom Modal Overlay */}

      <div className="flex items-center justify-between p-3 md:p-6 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-semibold text-muted-foreground mb-2">
            Quest
          </h2>
          <p className="text-sm text-gray-600">
            Complete the quests to claim your Elitra ₿app OG Pass
          </p>
        </div>
        {/* <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button> */}
      </div>

      <div className="p-2 md:p-6 space-y-6">
        {/* Task List */}
        <div className="space-y-6">
          <div className="flex flex-col gap-3 ">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gray-600 text-white rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">
                1
              </div>
              <div className="flex-1">
                <p className="font-semibold text-muted-foreground">
                  Follow @elitraxyz on X
                </p>
                {/* <p className="text-sm text-gray-600 mt-1">Stay updated on Citrea testnet developments</p> */}
              </div>
              <Link
                href={"https://x.com/elitraxyz"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-muted-foreground font-semibold px-4 py-1 rounded-md transition-all duration-200 bg-gray-200 hover:bg-gray-300"
              >
                Go
              </Link>
            </div>
            <Input
              name="xUsername"
              value={formData.xUsername}
              onChange={handleInputChange}
              required
              className="bg-white outline-none border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-primary focus:ring-primary mt-0"
              placeholder="Add X username"
            />
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-gray-600 text-white rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">
              2
            </div>
            <div className="flex-1 flex-row">
              <p className="font-semibold text-muted-foreground">
                Like & Retweet Elitra X Citrea post
              </p>
              {/* <p className="text-sm text-gray-600 mt-1">Like & retweet our Citrea testnet announcement to spread the word</p> */}
            </div>
            <Link
              href={"https://x.com/elitraxyz"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-muted-foreground rounded-md font-semibold px-4 py-1 transition-all duration-200 bg-gray-200 hover:bg-gray-300"
            >
              Go
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gray-600 text-white rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">
                3
              </div>
              <div className="flex-1">
                <p className="font-semibold text-muted-foreground">
                  Join Telegram Community
                </p>
                {/* <p className="text-sm text-gray-600 mt-1">Stay updated on Citrea testnet developments</p> */}
              </div>
              <Link
                href={"https://t.me/elitraxyz"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-muted-foreground font-semibold px-4 py-1 rounded-md transition-all duration-200 bg-gray-200 hover:bg-gray-300"
              >
                Go
              </Link>
            </div>
            <Input
              name="telegram"
              value={formData.telegram}
              onChange={handleInputChange}
              required
              className="bg-white outline-none border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-primary focus:ring-primary"
              placeholder="Add TG username"
            />
          </div>
        </div>

        <div className="text-muted-foreground text-sm">
          OG Pass will land via wallet next week, which can later be tied to
          future perks.
        </div>

        {/* Wallet Connection */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">Wallet Connection</p>
              <p className="text-sm text-gray-600">
                {clientConnected
                  ? `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}`
                  : "Connect your wallet to continue"}
              </p>
            </div>
            {!clientConnected && (
              <button className="text-base font-semibold cursor-pointer text-primary">
                <WalletConnectButton />
              </button>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex space-x-3">
          {/* <Button
            type="button"
            onClick={onClose}
            variant="outline"
            className="flex-1 cursor-pointer border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-600"
          >
            Cancel
          </Button> */}
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              !clientConnected ||
              !formData.xUsername ||
              !formData.telegram
            }
            className="flex-1 cursor-pointer bg-gradient-to-r from-primary to-accent text-white hover:from-primary/90 hover:to-accent/90 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    </>
  );
}
