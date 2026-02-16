"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RegistrationForm } from "./components/RegistrationForm";
import Image from "next/image";

export default function CampaignPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="pt-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* Main Event Layout - Simplified */}
        <Card className="p-8 mb-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Event Image & CTA */}
            <div className="space-y-6">
              <div className="relative h-96 w-full rounded-lg">
                <Image
                  src="/images/og-nft.png"
                  alt="Citrea OG NFT"
                  fill
                  className="object-contain blur-lg pointer-events-none"
                />
              </div>

              {/* CTA Section */}
              {/* <div className="p-6 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-lg">
                <h2 className="text-xl font-semibold mb-2 text-center">Complete Social Quest</h2>
                <p className="text-muted-foreground mb-4 text-center">
                  Join the Citrea testnet launch and claim your exclusive OG NFT
                </p>
                <Button 
                  onClick={() => setIsModalOpen(true)}
                  className="w-full bg-gradient-to-r from-primary to-accent text-white hover:from-primary/90 hover:to-accent/90 px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Start Quest Now
                </Button>
              </div> */}
            </div>

            {/* Right Side - Description */}
            <div className="flex flex-col justify-center h-full">
              {/* <div className="text-center lg:text-left">
                <Badge className="mb-4 bg-primary text-primary-foreground">
                  Citrea Testnet Launch
                </Badge>
                <h1 className="text-4xl font-bold text-foreground mb-4">
                  Citrea Chain Testnet
                </h1>
                <p className="text-lg text-muted-foreground mb-8">
                  Be among the first to experience Citrea's revolutionary Bitcoin Layer 2. Complete our social quest and claim your exclusive OG NFT.
                </p>
                
                <div>
                  <h2 className="text-xl font-semibold mb-4">About Citrea</h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      Citrea is the first Bitcoin Layer 2 that brings smart contracts and DeFi to Bitcoin, enabling developers to build on Bitcoin's security while maintaining its decentralization.
                    </p>
                    <p>
                      Our testnet launch marks a historic moment in Bitcoin's evolution, opening new possibilities for Bitcoin-native applications and financial primitives.
                    </p>
                    <p>
                      Join our social quest to be part of this groundbreaking launch and secure your place in Bitcoin's future with an exclusive OG NFT.
                    </p>
                  </div>
                </div>
              </div> */}
              <RegistrationForm />
            </div>
          </div>
        </Card>

        {/* Quest Rewards Section */}
        {/* <Card className="p-8 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold mb-2">Quest Rewards</h2>
              <p className="text-muted-foreground">
                Complete the social quest to receive your exclusive Citrea OG
                NFT and unlock future testnet privileges.
              </p>
            </div>
            <div className="ml-8">
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 overflow-hidden cursor-pointer group">
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl group-hover:scale-110 transition-transform duration-200">
                    🏆
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card> */}
      </div>
    </div>
  );
}
