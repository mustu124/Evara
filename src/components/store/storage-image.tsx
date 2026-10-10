import Image from "next/image";
import { ArchOrnament } from "@/components/icons";
import { imageUrl } from "@/lib/format";

type Props = {
  path: string | null | undefined;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
};

/** Fills its (relative, sized) parent with a stored image, or a quiet branded placeholder. */
export function StorageImage({ path, alt, sizes, className = "", priority }: Props) {
  const src = imageUrl(path);
  if (!src) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-blush/35 text-copper/60" role="img" aria-label={alt}>
        <ArchOrnament className="w-16" />
      </div>
    );
  }
  return (
    <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={`object-cover ${className}`} />
  );
}
