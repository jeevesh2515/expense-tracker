"use client";

import Link from "next/link";
import { MotionDiv, fadeInUp, staggerContainer, staggerItem } from "@/components/MotionDiv";
import { ArrowRight, Sparkles, Receipt, Users, Calculator } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-800 text-white">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-indigo-400/10 blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-32">
        <MotionDiv
          initial={staggerItem.initial}
          animate={staggerItem.animate}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          {/* Badge */}
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm mb-8"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Free forever · No credit card required</span>
          </MotionDiv>

          {/* Headline */}
          <MotionDiv
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
              Split expenses
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-300">
                effortlessly
              </span>
            </h1>
          </MotionDiv>

          {/* Subheadline */}
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
          >
            <p className="text-lg md:text-xl text-brand-100 mb-10 max-w-2xl mx-auto leading-relaxed">
              Track shared expenses with friends, roommates, or travel groups.
              Know who owes whom, export to Excel, and settle up in seconds.
            </p>
          </MotionDiv>

          {/* CTAs */}
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 px-8 py-3.5 bg-white text-brand-700 font-semibold rounded-xl hover:bg-brand-50 transition-all shadow-lg shadow-brand-900/30 hover:shadow-xl hover:shadow-brand-900/40 hover:-translate-y-0.5"
            >
              Get started free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all"
            >
              Sign in
            </Link>
          </MotionDiv>
        </MotionDiv>

        {/* Floating feature cards */}
        <MotionDiv
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mt-20 max-w-4xl mx-auto"
        >
          <div className="relative rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-8 shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: Receipt, title: "Track expenses", desc: "Log every shared cost in one place" },
                { icon: Users, title: "Split fairly", desc: "Equal, exact, or percentage splits" },
                { icon: Calculator, title: "Settle smart", desc: "AI-optimized minimum transfers" },
              ].map((feature, i) => (
                <MotionDiv
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 + i * 0.15, duration: 0.5 }}
                  className="flex items-start gap-4 p-4 rounded-xl bg-white/5"
                >
                  <div className="p-2.5 rounded-lg bg-white/10 shrink-0">
                    <feature.icon className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                    <p className="text-sm text-brand-200">{feature.desc}</p>
                  </div>
                </MotionDiv>
              ))}
            </div>
          </div>
        </MotionDiv>
      </div>
    </section>
  );
}
