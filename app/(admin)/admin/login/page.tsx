import type { Metadata } from "next";

import { LoginForm } from "@/components/admin/LoginForm";

/**
 * `absolute`, because the root layout's title template would otherwise produce
 * "Pedigree Leather Admin | Pedigree Leather" — the brand named twice, and once as a
 * suffix. This page is a tool rather than a page of the shop, so it states its own name
 * outright.
 *
 * `robots: noindex` as well: an admin login form is the last thing to want in a search
 * index.
 *
 * ---------------------------------------------------------------------------
 * Why this page is a Server Component that renders a client form
 * ---------------------------------------------------------------------------
 * Because `metadata` can only be exported from a server module. A `"use client"` page
 * that exports `metadata` is a build error, and a surprisingly expensive one: in dev,
 * a module-graph error in a single route returns a 500 for *every* route in the app,
 * so a typo in an admin page takes the shop down with it. The fix is the one React has
 * always prescribed for exactly this — the server page owns the metadata, and the
 * interactive part lives in its own client component.
 *
 * The benefit is not just compliance: the page itself now ships no client JavaScript,
 * and only the form hydrates.
 */
export const metadata: Metadata = {
  title: { absolute: "Pedigree Leather Admin" },
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return <LoginForm />;
}