'use client'
export default function ConfirmButton({ message, children, secondary }: { message: string; children: React.ReactNode; secondary?: boolean }) {
  return <button className={secondary ? 'btn outline' : 'btn'} onClick={(e) => { if (!confirm(message)) e.preventDefault() }}>{children}</button>
}
