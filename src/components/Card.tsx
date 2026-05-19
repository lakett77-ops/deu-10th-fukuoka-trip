import type { PropsWithChildren } from "react";

interface CardProps extends PropsWithChildren {
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <section className={`rounded-lg border border-white/70 bg-white/95 p-4 shadow-soft ${className}`}>
      {children}
    </section>
  );
}
