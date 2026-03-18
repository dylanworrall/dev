"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CodeIcon,
  LoaderIcon,
  ArrowRightIcon,
  MailIcon,
  LockIcon,
  UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { signIn, signUp } from "@/lib/auth-client";

type Tab = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await signIn.email({ email, password });
      if (res.error) {
        setError(res.error.message || "Sign in failed");
      } else {
        router.push("/");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await signUp.email({ email, password, name: name || email.split("@")[0] });
      if (res.error) {
        setError(res.error.message || "Sign up failed");
      } else {
        router.push("/");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <CodeIcon className="size-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Dev Client</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sign in to start building.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-surface-1 border border-border p-1 mb-6">
          <button
            type="button"
            onClick={() => { setTab("signin"); setError(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              tab === "signin"
                ? "bg-accent text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab("signup"); setError(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              tab === "signup"
                ? "bg-accent text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={tab === "signin" ? handleSignIn : handleSignUp}
          className="rounded-2xl border border-border bg-surface-1 p-6 shadow-elevation-1 space-y-4"
        >
          {tab === "signup" && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-border bg-surface-2 pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Email</label>
            <div className="relative">
              <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-border bg-surface-2 pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Password</label>
            <div className="relative">
              <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full rounded-xl border border-border bg-surface-2 pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-accent-red/10 border border-accent-red/30 px-3 py-2 text-sm text-accent-red">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full rounded-xl h-11"
          >
            {loading ? (
              <LoaderIcon className="size-4 animate-spin" />
            ) : (
              <>
                {tab === "signin" ? "Sign In" : "Create Account"}
                <ArrowRightIcon className="size-4 ml-1" />
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
