"use client";

import Link from "next/link";
import { MotionDiv } from "@/components/MotionDiv";
import { ArrowRight, Sparkles } from "lucide-react";

export function CTA() {
  return (
    <section className="py-24 bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-800 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <MotionDiv
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm text-brand-100 mb-8">
            <Sparkles className="w-4 h-4 text-amber-300" />
            Join thousands of happy users
          </div>

          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
            Start splitting expenses
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-300">
              today
            </span>
          </h2>

          <p className="text-lg text-brand-100 mb-10 max-w-xl mx-auto">
            No credit card needed. No hidden fees. Just a simple way to track shared expenses with the people you care about.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 px-8 py-4 bg-white text-brand-700 font-semibold rounded-xl hover:bg-brand-50 transition-all shadow-lg shadow-brand-900/30 hover:shadow-xl hover:-translate-y-0.5 text-lg"
            >
              Create your free account
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <p className="text-sm text-brand-200 mt-6">
            Free forever · No credit card required · Export anytime
          </p>
        </MotionDiv>
      </div>
    </section>
  );
}
