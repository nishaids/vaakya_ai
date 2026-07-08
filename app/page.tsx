"use client";

import React from "react";
import FAB from "@/components/ui/FAB";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ProblemSection from "@/components/ProblemSection";
import HowItWorks from "@/components/HowItWorks";
import DemoSection from "@/components/DemoSection";
import AgentCards from "@/components/AgentCards";
import UseCases from "@/components/UseCases";
import ImpactNumbers from "@/components/ImpactNumbers";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import TechStack from "@/components/TechStack";
import Footer from "@/components/Footer";
import CallToAction from "@/components/CallToAction";
import VaakyaChatbot from "@/components/VaakyaChatbot";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function Home() {
  return (
    <main className="relative">
      <Navbar />
      <div id="hero">
        <Hero />
      </div>
      <div id="problem">
        <ProblemSection />
      </div>
      <div id="howItWorks">
        <HowItWorks />
      </div>
      <div id="demo">
        <ErrorBoundary>
          <DemoSection />
        </ErrorBoundary>
      </div>
      <div id="agents">
        <AgentCards />
      </div>
      <div id="useCases">
        <UseCases />
      </div>
      <div id="impact">
        <ImpactNumbers />
      </div>
      <div id="analytics">
        <AnalyticsDashboard />
      </div>
      <div id="techStack">
        <TechStack />
      </div>
      <CallToAction />
      <Footer />
      <ErrorBoundary>
        <VaakyaChatbot />
      </ErrorBoundary>
      <FAB />
    </main>
  );
}