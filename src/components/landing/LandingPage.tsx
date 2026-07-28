"use client";

import { Hero } from "./Hero";
import { Features } from "./Features";
import { HowItWorks } from "./HowItWorks";
import { CTA } from "./CTA";
import { Footer } from "./Footer";
import { LandingNavbar } from "./LandingNavbar";

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <LandingNavbar />
      <Hero />
      <Features />
      <HowItWorks />
      <CTA />
      <Footer />
    </div>
  );
}
