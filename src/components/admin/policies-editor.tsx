"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, RotateCcw } from "lucide-react";
import { savePolicy } from "@/app/admin/actions/content";
import { adminInput, adminLabel, btnPrimary, btnSecondary, ConfirmButton, Notice, Panel, Spinner, useAction } from "@/components/admin/ui";
import { DEFAULT_POLICIES, formatPolicyDate, POLICY_META, type Policies, type PolicyKey } from "@/lib/policies";

function PolicyEditor({ policy, initial }: { policy: PolicyKey; initial: Policies[PolicyKey] }) {
  const [body, setBody] = useState(initial.body);
  const { run, pending, result } = useAction();
  const meta = POLICY_META[policy];
  const dirty = body !== initial.body;

  return (
    <Panel
      title={meta.title}
      description={`Last updated: ${formatPolicyDate(initial.updated_at)}${initial.updated_at ? "" : " (original wording)"}`}
      actions={
        <Link href={meta.path} target="_blank" className={`${btnSecondary} !min-h-9 !px-3 text-xs`}>
          <ExternalLink aria-hidden className="size-4" /> View page
        </Link>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => savePolicy({ policy, body }), { success: `${meta.title} saved. The page has been updated.` });
        }}
      >
        <label htmlFor={`policy-${policy}`} className={adminLabel}>Text</label>
        <textarea id={`policy-${policy}`} rows={16} value={body} maxLength={20000} onChange={(e) => setBody(e.target.value)} className={`${adminInput} font-mono text-[0.8rem] leading-relaxed`} />
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={pending || !dirty || !body.trim()} className={btnPrimary}>
            {pending && <Spinner />} Save {meta.title}
          </button>
          {body !== DEFAULT_POLICIES[policy] && (
            <ConfirmButton
              title={`Restore the original ${meta.title}?`}
              body="This replaces the text in the box with the original wording. Nothing changes on the website until you press Save."
              confirmLabel="Restore wording"
              danger={false}
              className={`${btnSecondary} !min-h-10`}
              onConfirm={() => setBody(DEFAULT_POLICIES[policy])}
            >
              <RotateCcw aria-hidden className="size-4" /> Original wording
            </ConfirmButton>
          )}
          {dirty && !pending && <span className="text-sm text-copper-dark">Unsaved changes</span>}
        </div>
        <Notice result={result} />
      </form>
    </Panel>
  );
}

export function PoliciesEditor({ policies }: { policies: Policies }) {
  return (
    <div className="space-y-6">
      <Panel title="How to format the text">
        <ul className="grid gap-1.5 text-sm text-muted sm:grid-cols-2">
          <li><code className="text-cocoa">## Heading</code> starts a section heading</li>
          <li><code className="text-cocoa">- item</code> on each line makes a bulleted list</li>
          <li><code className="text-cocoa">**bold**</code> makes text bold</li>
          <li><code className="text-cocoa">[Shipping Policy](/shipping-policy)</code> makes a link</li>
          <li className="sm:col-span-2">Leave an empty line between paragraphs. A &ldquo;Questions&rdquo; section linking to the Contact page is always added at the end.</li>
        </ul>
      </Panel>
      {(Object.keys(POLICY_META) as PolicyKey[]).map((key) => (
        <PolicyEditor key={`${key}:${policies[key].updated_at}`} policy={key} initial={policies[key]} />
      ))}
    </div>
  );
}
