import Link from "next/link";
import { PageHeader } from "@/components/store/bits";
import { getPublicClient } from "@/lib/supabase/public";
import { formatPolicyDate, normalizePolicies, parsePolicy, POLICY_META, type Inline, type PolicyKey } from "@/lib/policies";

function Text({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, i) =>
        part.type === "bold" ? (
          <strong key={i}>{part.text}</strong>
        ) : part.type === "link" ? (
          part.href.startsWith("/") ? (
            <Link key={i} href={part.href}>{part.text}</Link>
          ) : (
            <a key={i} href={part.href} target={part.href.startsWith("https://") ? "_blank" : undefined} rel="noopener noreferrer">{part.text}</a>
          )
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** Loads the policy text an administrator has saved, or the default wording. */
export async function getPolicy(key: PolicyKey) {
  const db = getPublicClient();
  let value: unknown = null;
  if (db) {
    const { data } = await db.from("site_settings").select("value").eq("key", "policies").maybeSingle();
    value = data?.value ?? null;
  }
  return normalizePolicies(value)[key];
}

export async function PolicyPage({ policy }: { policy: PolicyKey }) {
  const { body, updated_at } = await getPolicy(policy);
  return (
    <>
      <PageHeader eyebrow="Evara Studios" title={POLICY_META[policy].title} />
      <article className="prose-evara container-x max-w-3xl py-12 sm:py-16">
        <p className="text-sm text-muted">Last updated: {formatPolicyDate(updated_at)}</p>
        {parsePolicy(body).map((block, i) =>
          block.type === "h2" ? (
            <h2 key={i}>{block.text}</h2>
          ) : block.type === "ul" ? (
            <ul key={i}>
              {block.items.map((item, j) => (
                <li key={j}><Text parts={item} /></li>
              ))}
            </ul>
          ) : (
            <p key={i}><Text parts={block.inline} /></p>
          ),
        )}
        <h2>Questions</h2>
        <p>
          If anything here is unclear, please reach us through our <Link href="/contact">contact page</Link> before placing
          your order.
        </p>
      </article>
    </>
  );
}
