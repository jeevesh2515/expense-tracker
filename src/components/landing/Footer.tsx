"use client";

import Link from "next/link";
import { Github, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-900 dark:bg-black text-gray-400">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">
                S
              </div>
              <div>
                <div className="font-bold text-white text-lg">Splittrack</div>
                <div className="text-xs text-gray-500">Expense tracker</div>
              </div>
            </Link>
            <p className="text-sm leading-relaxed max-w-sm">
              The simplest way to track shared expenses with friends, roommates, and travel groups.
              Know who owes whom and settle up in seconds.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Product</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/signup" className="hover:text-white transition-colors">Sign up</Link></li>
              <li><Link href="/login" className="hover:text-white transition-colors">Sign in</Link></li>
              <li><span className="text-gray-500">Features</span></li>
              <li><span className="text-gray-500">Pricing (Free)</span></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Support</h4>
            <ul className="space-y-2.5 text-sm">
              <li><span className="text-gray-500">Help Center</span></li>
              <li><span className="text-gray-500">Contact</span></li>
              <li><span className="text-gray-500">Privacy Policy</span></li>
              <li><span className="text-gray-500">Terms of Service</span></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Splittrack. All rights reserved.
          </p>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            Built with <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> using Next.js
          </p>
        </div>
      </div>
    </footer>
  );
}
