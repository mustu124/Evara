"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { saveProduct } from "@/app/admin/actions/catalog";
import { adminInput, adminLabel, btnPrimary, btnSecondary, Checkbox, Notice, Panel, Spinner } from "@/components/admin/ui";
import { slugify } from "@/lib/format";
import type { Category, Collection } from "@/lib/types";
import { productSchema, type ProductData, type ProductInput } from "@/lib/validation";

type Props = { initial: ProductInput; categories: Category[]; collections: Collection[] };

const iconBtn = "flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-ivory text-cocoa hover:border-blush hover:bg-blush/30 disabled:opacity-30";
const priceOrNull = (v: unknown) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

function Err({ message }: { message?: string }) {
  return message ? <p role="alert" className="mt-1 text-xs font-medium text-cocoa">{message}</p> : null;
}

function RowControls({ index, count, onMove, onRemove, label }: { index: number; count: number; onMove: (from: number, to: number) => void; onRemove: () => void; label: string }) {
  return (
    <div className="flex gap-1">
      <button type="button" className={iconBtn} disabled={index === 0} aria-label={`Move ${label} up`} onClick={() => onMove(index, index - 1)}>
        <ArrowUp aria-hidden className="size-4" />
      </button>
      <button type="button" className={iconBtn} disabled={index === count - 1} aria-label={`Move ${label} down`} onClick={() => onMove(index, index + 1)}>
        <ArrowDown aria-hidden className="size-4" />
      </button>
      <button type="button" className={`${iconBtn} hover:!border-copper hover:!bg-blush/40 hover:text-copper-dark`} aria-label={`Remove ${label}`} onClick={onRemove}>
        <Trash2 aria-hidden className="size-4" />
      </button>
    </div>
  );
}

function OptionValues({ control, register, errors, optionIndex }: { control: Control<ProductInput, unknown, ProductData>; register: UseFormRegister<ProductInput>; errors: FieldErrors<ProductInput>; optionIndex: number }) {
  const { fields, append, remove, move } = useFieldArray({ control, name: `options.${optionIndex}.values` });
  const valuesError = errors.options?.[optionIndex]?.values;
  return (
    <div className="mt-4">
      <p className={adminLabel}>Values</p>
      <ul className="space-y-2">
        {fields.map((field, j) => (
          <li key={field.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-blush-light/60 p-2">
            <div className="min-w-40 flex-1">
              <input aria-label={`Value ${j + 1}`} placeholder="e.g. Blush Pink" className={adminInput} {...register(`options.${optionIndex}.values.${j}.value`)} />
              <Err message={valuesError?.[j]?.value?.message} />
            </div>
            <Checkbox label="Available" {...register(`options.${optionIndex}.values.${j}.is_available`)} />
            <Checkbox label="Coming soon" {...register(`options.${optionIndex}.values.${j}.is_coming_soon`)} />
            <RowControls index={j} count={fields.length} onMove={move} onRemove={() => remove(j)} label={`value ${j + 1}`} />
          </li>
        ))}
      </ul>
      <Err message={valuesError?.message ?? valuesError?.root?.message} />
      <button type="button" className={`${btnSecondary} mt-2 !min-h-9 text-xs`} onClick={() => append({ value: "", is_available: true, is_coming_soon: false })}>
        <Plus aria-hidden className="size-4" /> Add value
      </button>
    </div>
  );
}

export function ProductForm({ initial, categories, collections }: Props) {
  const router = useRouter();
  const isNew = !initial.id;
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<ProductInput, unknown, ProductData>({ resolver: zodResolver(productSchema), defaultValues: initial });

  const variants = useFieldArray({ control, name: "variants" });
  const options = useFieldArray({ control, name: "options" });
  const specs = useFieldArray({ control, name: "specifications" });
  const trackInventory = useWatch({ control, name: "track_inventory" });

  const onSubmit = handleSubmit(async (data) => {
    setNotice(null);
    try {
      const result = await saveProduct(data);
      if (!result.ok) {
        setNotice({ ok: false, message: result.error });
        return;
      }
      // Reload from the database so rows created by this save carry their real ids.
      if (isNew) router.push(`/admin/products/${result.id}?created=1`);
      else router.replace(`/admin/products/${result.id}?saved=${result.stamp}`, { scroll: false });
    } catch {
      setNotice({ ok: false, message: "Could not reach the server. Please try again." });
    }
  });

  const roots = categories.filter((c) => !c.parent_id);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Panel title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="p-name" className={adminLabel}>Product name</label>
            <input
              id="p-name"
              className={adminInput}
              {...register("name", {
                onChange: (e) => {
                  if (isNew && !dirtyFields.slug) setValue("slug", slugify(e.target.value));
                },
              })}
            />
            <Err message={errors.name?.message} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="p-slug" className={adminLabel}>URL slug</label>
            <div className="flex gap-2">
              <input id="p-slug" className={adminInput} aria-describedby="p-slug-hint" {...register("slug")} />
              <button type="button" className={btnSecondary} onClick={() => setValue("slug", slugify(getValues("name")), { shouldDirty: true, shouldValidate: true })}>
                Generate
              </button>
            </div>
            <p id="p-slug-hint" className="mt-1 text-xs text-muted">Appears in the product link: /shop/your-slug. Changing it breaks existing links.</p>
            <Err message={errors.slug?.message} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="p-description" className={adminLabel}>Description</label>
            <textarea id="p-description" rows={4} className={adminInput} {...register("description")} />
            <Err message={errors.description?.message} />
          </div>
          <div>
            <label htmlFor="p-category" className={adminLabel}>Category</label>
            <select id="p-category" className={adminInput} {...register("category_id")}>
              <option value="">No category</option>
              {roots.map((root) => {
                const children = categories.filter((c) => c.parent_id === root.id);
                return children.length ? (
                  <optgroup key={root.id} label={root.name}>
                    <option value={root.id}>{root.name} (general)</option>
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ) : (
                  <option key={root.id} value={root.id}>{root.name}</option>
                );
              })}
            </select>
          </div>
          <div>
            <label htmlFor="p-status" className={adminLabel}>Status</label>
            <select id="p-status" className={adminInput} {...register("status")}>
              <option value="draft">Draft (hidden from the store)</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label htmlFor="p-sort" className={adminLabel}>Sort order</label>
            <input id="p-sort" type="number" min={0} className={adminInput} {...register("sort_order", { valueAsNumber: true })} />
            <Err message={errors.sort_order?.message} />
          </div>
          <div className="grid content-start">
            <Checkbox label="Coming soon" hint="Shown on the store but cannot be ordered." {...register("is_coming_soon")} />
            <Checkbox label="Bestseller" hint="Featured in the homepage Bestsellers section." {...register("is_bestseller")} />
            <Checkbox label="Sale badge" hint="Shows a small SALE badge on this product's card and page." {...register("on_sale")} />
          </div>
        </div>
      </Panel>

      <Panel title="Pack sizes and prices" description="Each pack size has its own price. The original price is shown struck through when it is higher.">
        {variants.fields.length === 0 && <p className="mb-3 text-sm text-muted">No pack sizes yet. Add one to give this product a price.</p>}
        <ul className="space-y-3">
          {variants.fields.map((field, i) => (
            <li key={field.id} className="rounded-lg border border-line p-3">
              <div className="grid gap-3 sm:grid-cols-[1.4fr_0.7fr_0.9fr_0.9fr]">
                <div>
                  <label htmlFor={`v-label-${i}`} className={adminLabel}>Label</label>
                  <input id={`v-label-${i}`} placeholder="e.g. Set of 2" className={adminInput} {...register(`variants.${i}.label`)} />
                  <Err message={errors.variants?.[i]?.label?.message} />
                </div>
                <div>
                  <label htmlFor={`v-pack-${i}`} className={adminLabel}>Pieces</label>
                  <input id={`v-pack-${i}`} type="number" min={1} className={adminInput} {...register(`variants.${i}.pack_quantity`, { valueAsNumber: true })} />
                  <Err message={errors.variants?.[i]?.pack_quantity?.message} />
                </div>
                <div>
                  <label htmlFor={`v-price-${i}`} className={adminLabel}>Price (₹)</label>
                  <input id={`v-price-${i}`} type="number" min={0} step="0.01" className={adminInput} {...register(`variants.${i}.price`, { valueAsNumber: true })} />
                  <Err message={errors.variants?.[i]?.price?.message} />
                </div>
                <div>
                  <label htmlFor={`v-compare-${i}`} className={adminLabel}>Original price (₹)</label>
                  <input id={`v-compare-${i}`} type="number" min={0} step="0.01" placeholder="Optional" className={adminInput} {...register(`variants.${i}.compare_at_price`, { setValueAs: priceOrNull })} />
                  <Err message={errors.variants?.[i]?.compare_at_price?.message} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6">
                <div className="flex flex-wrap gap-x-6">
                  <Checkbox label="Available" {...register(`variants.${i}.is_available`)} />
                  <Checkbox label="Coming soon" {...register(`variants.${i}.is_coming_soon`)} />
                </div>
                <RowControls index={i} count={variants.fields.length} onMove={variants.move} onRemove={() => variants.remove(i)} label={`pack size ${i + 1}`} />
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className={`${btnSecondary} mt-3`} onClick={() => variants.append({ label: "", pack_quantity: 1, price: 0, compare_at_price: null, is_available: true, is_coming_soon: false })}>
          <Plus aria-hidden className="size-4" /> Add pack size
        </button>
      </Panel>

      <Panel title="Options" description="Choices such as design, hue or scent. Customers must pick one value for each option. Values marked coming soon are visible but cannot be ordered.">
        {options.fields.length === 0 && <p className="mb-3 text-sm text-muted">No options. Customers will only choose a pack size.</p>}
        <ul className="space-y-4">
          {options.fields.map((field, i) => (
            <li key={field.id} className="rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-40 flex-1">
                  <label htmlFor={`o-name-${i}`} className={adminLabel}>Option name</label>
                  <input id={`o-name-${i}`} placeholder="e.g. Hue" className={adminInput} {...register(`options.${i}.name`)} />
                  <Err message={errors.options?.[i]?.name?.message} />
                </div>
                <div className="w-40">
                  <label htmlFor={`o-kind-${i}`} className={adminLabel}>Type</label>
                  <select id={`o-kind-${i}`} className={adminInput} {...register(`options.${i}.kind`)}>
                    <option value="design">Design</option>
                    <option value="colour">Colour</option>
                    <option value="fragrance">Fragrance</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <RowControls index={i} count={options.fields.length} onMove={options.move} onRemove={() => options.remove(i)} label={`option ${i + 1}`} />
              </div>
              <OptionValues control={control} register={register} errors={errors} optionIndex={i} />
            </li>
          ))}
        </ul>
        <button type="button" className={`${btnSecondary} mt-3`} onClick={() => options.append({ name: "", kind: "other", values: [{ value: "", is_available: true, is_coming_soon: false }] })}>
          <Plus aria-hidden className="size-4" /> Add option
        </button>
      </Panel>

      <Panel title="Specifications" description="Shown as a table on the product page, e.g. Dimensions, Wax Weight, Burn Time.">
        <div className="mb-4 rounded-lg bg-blush-light/60 p-3">
          <label htmlFor="p-weight" className={adminLabel}>Total weight (g) *</label>
          <input id="p-weight" type="number" min={1} step={1} inputMode="numeric" placeholder="e.g. 250" aria-describedby="p-weight-hint" className={`${adminInput} max-w-40`} {...register("weight_grams", { setValueAs: priceOrNull })} />
          <Err message={errors.weight_grams?.message} />
          <p id="p-weight-hint" className="mt-1 text-xs text-muted">
            One candle with its container. Used only to work out shipping (a Set of 2 counts twice this weight); customers never see it.
          </p>
        </div>
        <ul className="space-y-2">
          {specs.fields.map((field, i) => (
            <li key={field.id} className="flex flex-wrap items-start gap-2">
              <div className="w-full sm:w-48">
                <input aria-label={`Specification ${i + 1} label`} placeholder="Label" className={adminInput} {...register(`specifications.${i}.label`)} />
                <Err message={errors.specifications?.[i]?.label?.message} />
              </div>
              <div className="min-w-40 flex-1">
                <input aria-label={`Specification ${i + 1} value`} placeholder="Value" className={adminInput} {...register(`specifications.${i}.value`)} />
                <Err message={errors.specifications?.[i]?.value?.message} />
              </div>
              <RowControls index={i} count={specs.fields.length} onMove={specs.move} onRemove={() => specs.remove(i)} label={`specification ${i + 1}`} />
            </li>
          ))}
        </ul>
        <button type="button" className={`${btnSecondary} mt-3`} onClick={() => specs.append({ label: "", value: "" })}>
          <Plus aria-hidden className="size-4" /> Add specification
        </button>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Collections">
          {collections.length === 0 ? (
            <p className="text-sm text-muted">No collections exist yet.</p>
          ) : (
            <div className="grid sm:grid-cols-2">
              {collections.map((c) => (
                <Checkbox key={c.id} label={c.name} value={c.id} {...register("collection_ids")} />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="GST" description="Prices are GST-inclusive. Leave empty to use the store's default rate from Settings.">
          <label htmlFor="p-gst" className={adminLabel}>GST rate for this product (%)</label>
          <input id="p-gst" type="number" min={0} max={40} step="0.01" placeholder="Store default" className={`${adminInput} max-w-40`} {...register("gst_rate", { setValueAs: priceOrNull })} />
          <Err message={errors.gst_rate?.message} />
        </Panel>

        <Panel title="Inventory" description="Stock is counted in individual pieces. A set of 2 uses 2 pieces.">
          <Checkbox label="Track stock for this product" hint="When off, the product is always treated as available (made to order)." {...register("track_inventory")} />
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="p-stock" className={adminLabel}>Pieces in stock</label>
              <input id="p-stock" type="number" min={0} readOnly={!trackInventory} className={adminInput} {...register("stock_quantity", { valueAsNumber: true })} />
              <Err message={errors.stock_quantity?.message} />
            </div>
            <div>
              <label htmlFor="p-low" className={adminLabel}>Low-stock alert at</label>
              <input id="p-low" type="number" min={0} readOnly={!trackInventory} className={adminInput} {...register("low_stock_threshold", { valueAsNumber: true })} />
              <Err message={errors.low_stock_threshold?.message} />
            </div>
          </div>
        </Panel>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-ivory/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <button type="submit" disabled={isSubmitting} className={btnPrimary}>
          {isSubmitting && <Spinner />} {isNew ? "Create product" : "Save changes"}
        </button>
        {!isNew && isDirty && !isSubmitting && <span className="text-sm text-copper-dark">Unsaved changes</span>}
        <div className="min-w-0 flex-1">
          <Notice result={notice ?? (Object.keys(errors).length ? { ok: false, message: "Please fix the highlighted fields." } : null)} />
        </div>
      </div>
    </form>
  );
}
