"use client";

import { MotionDiv, staggerItem } from "@/components/MotionDiv";
import {
  Receipt,
  Users,
  Calculator,
  FileSpreadsheet,
  Shield,
  Smartphone,
  BarChart3,
  Globe,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Receipt,
    title: "Expense Tracking",
    description: "Log shared expenses with categories, notes, and dates. Never lose track of who paid for what.",
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    icon: Users,
    title: "People Management",
    description: "Add friends, roommates, or travel companions. Track each person's balance across all transactions.",
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    icon: Calculator,
    title: "Smart Splitting",
    description: "Split equally, by exact amounts, or percentages. The app handles all the math automatically.",
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-900/20",
  },
  {
    icon: BarChart3,
    title: "Balance Overview",
    description: "See at a glance who owes whom and how much. Simplified settlements minimize the number of transfers needed.",
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
  },
  {
    icon: FileSpreadsheet,
    title: "Excel Export",
    description: "Download your data as styled Excel workbooks or CSV files. Perfect for sharing or record-keeping.",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "Your data is encrypted and stored securely. Each account is isolated — only you see your projects.",
    color: "text-rose-500",
    bg: "bg-rose-50 dark:bg-rose-900/20",
  },
  {
    icon: Zap,
    title: "Payment Tracking",
    description: "Record partial or full payments. Track settlement progress for each person on each transaction.",
    color: "text-orange-500",
    bg: "bg-orange-50 dark:bg-orange-900/20",
  },
  {
    icon: Globe,
    title: "Multi-Currency",
    description: "Support for INR with proper formatting. Track expenses in your preferred currency.",
    color: "text-cyan-500",
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
  },
  {
    icon: Smartphone,
    title: "Works Everywhere",
    description: "Fully responsive design that works on desktop, tablet, and mobile. Access your data anywhere.",
    color: "text-indigo-500",
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
  },
];

export function Features() {
  return (
    <section className="py-24 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-6">
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-medium mb-4">
            Everything you need
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Split expenses without the headaches
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
            A complete toolkit for tracking shared expenses, from casual dinners to international trips.
          </p>
        </MotionDiv>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <MotionDiv
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
            >
              <div className="group h-full p-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-lg transition-all duration-300">
                <div className={`inline-flex p-3 rounded-xl ${feature.bg} mb-4`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  );
}
