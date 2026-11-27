"use client";

import { useRef, useState } from "react";
import { LegalMarkdown } from "@/components/legal/LegalMarkdown";
import { useUnsavedSettings } from "@/hooks/useUnsavedSettings";
import { saveLegalPolicy } from "@/lib/actions/legal-policies";
import type { LegalPolicyState } from "@/lib/legal-policy-state";

type Operation = "draft" | "publish" | "restore";

export function LegalPolicyEditor({ slug, baseline, initial }: {
  slug: string;
  baseline: string;
  initial: LegalPolicyState;
}) {
  const [state, setState] = useState(initial);
  const [content, setContent] = useState(initial.draft ?? initial.published ?? baseline);
  const [preview, setPreview] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const saving = useRef(false);
  const savedContent = state.draft ?? state.published ?? baseline;
  const dirty = content !== savedContent;
  useUnsavedSettings(dirty, pending);

  async function save(action: Operation) {
    if (saving.current) return;
    if (action === "publish" && !window.confirm("Publish this policy to the website?")) return;
    if (action === "restore" && !window.confirm("Publish the previous version and replace the current draft or edits?")) return;
    saving.current = true;
    setPending(true);
    setMessage(undefined);
    try {
      const result = await saveLegalPolicy({ slug, action, revision: state.revision, content: action === "restore" ? null : content });
      if (!result.ok) {
        setMessage({ text: result.error, error: true });
        return;
      }
      setState(result.state);
      setContent(result.state.draft ?? result.state.published ?? baseline);
      setMessage({ text: action === "draft" ? "Draft saved." : action === "restore" ? "Previous version restored and published." : "Policy published." });
    } catch {
      setMessage({ text: "The change could not be confirmed. Reload to check the current version.", error: true });
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  const button = "rounded-md border border-border px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50";
  return (
    <div className="space-y-4" aria-busy={pending}>
      <p className="text-sm text-muted">
        {state.publishedAt
          ? `Published ${new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(state.publishedAt))} EAT by ${state.publishedBy}`
          : "The approved source document is live."}
        {state.draft !== null && " Private draft saved."}
      </p>
      <label className="block text-sm font-semibold">
        Policy Markdown
        <textarea className="mt-2 block w-full rounded-md border border-border bg-background p-3 font-mono text-sm leading-relaxed"
          rows={18} maxLength={30000} value={content} disabled={pending} onChange={event => setContent(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} aria-expanded={preview} aria-controls="policy-preview" onClick={() => setPreview(value => !value)}>
          {preview ? "Hide preview" : "Preview"}
        </button>
        <button type="button" className={button} disabled={pending || !dirty || !content.trim()} onClick={() => void save("draft")}>Save draft</button>
        <button type="button" className={`${button} bg-primary text-background`} disabled={pending || !content.trim() || (!dirty && state.draft === null && state.published !== null)}
          onClick={() => void save("publish")}>Publish</button>
        <button type="button" className={button} disabled={pending || !state.canRestore} onClick={() => void save("restore")}>Restore previous version</button>
        <button type="button" className={button} disabled={pending || !dirty} onClick={() => {
          setContent(savedContent);
          setMessage(undefined);
        }}>Reset edits</button>
      </div>
      {pending && <p role="status" className="text-sm">Saving policy…</p>}
      {message && <p role={message.error ? "alert" : "status"} className={message.error ? "text-sm text-red-800" : "text-sm"}>{message.text}</p>}
      {preview && <div id="policy-preview" className="space-y-4 rounded-md border border-border p-4 [overflow-wrap:anywhere] [&_h2]:font-serif [&_h2]:text-xl [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6">
        <LegalMarkdown content={content} />
      </div>}
    </div>
  );
}
