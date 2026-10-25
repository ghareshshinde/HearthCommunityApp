import Image from 'next/image'

/** Decorative or illustrative image from /public. SVGs are served as-is (no optimiser). */
export default function Pic({ src, alt = '', size, width, height, className, style }: {
  src: string; alt?: string; size?: number; width?: number; height?: number; className?: string; style?: React.CSSProperties
}) {
  return <Image src={src} alt={alt} width={width ?? size ?? 48} height={height ?? size ?? 48} className={className} style={style} unoptimized />
}
