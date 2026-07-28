"use client";

import { MotionDiv } from "@/components/MotionDiv";
import { UserPlus, Receipt, ArrowRight, CheckCircle2 } from "lucide-react";

const steps = [
  {
    step: "01",
    icon: UserPlus,
    title: "Create a project",
    description: "Set up a project for your trip, household, or event. Add the people involved.",
    color: "from-brand-500 to-brand-600",
  },
  {
    step: "02",
    icon: Receipt,
    title: "Log expenses",
    description: "Record who paid for what. Split equally, by exact amounts, or percentages.",
    color: "from-amber-500 to-orange-500",
  },
  {
    step: "03",
    icon: ArrowRight,
    title: "See who owes whom",
    description: "Get instant balance updates and simplified settlement suggestions.",
    color: "from-emerald-500 to-teal-500",
  },
  {
    step: "04",
    icon: CheckCircle2,
    title: "Settle up",
    description: "Record payments as they happen. Export to Excel when you're done.",
    color: "from-rose-500 to-pink-500",
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 bg-white dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-6">
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm font-medium mb-4">
            Simple as 1-2-3-4
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            How Splittrack works
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
            Get started in under a minute. No complex setup required.
          </p>
        </MotionDiv>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <MotionDiv
              key={step.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              className="relative"
            >
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-gray-200 dark:from-gray-700 to-transparent" />
              )}

              <div className="text-center">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} text-white text-xl font-bold mb-5 shadow-lg`}>
                  {step.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  );
}
