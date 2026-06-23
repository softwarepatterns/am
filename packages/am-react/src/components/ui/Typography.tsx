import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/ui/cn.js";

const typographyVariants = cva("", {
  variants: {
    variant: {
      display: "font-bold",
      title: "font-semibold",
      subtitle: "tracking-wide opacity-70",
      body: "font-medium",
      hint: "tracking-wide opacity-60",
      mono: "font-mono",
    },
    size: {
      sm: "",
      md: "",
      lg: "",
    },
    muted: {
      true: "opacity-70",
      false: "",
    },
  },
  compoundVariants: [
    { variant: "display", size: "sm", class: "text-4xl" },
    { variant: "display", size: "md", class: "text-5xl" },
    { variant: "display", size: "lg", class: "text-6xl" },
    { variant: "title", size: "sm", class: "text-lg" },
    { variant: "title", size: "md", class: "text-2xl" },
    { variant: "title", size: "lg", class: "text-3xl" },
    { variant: "subtitle", size: "sm", class: "text-xs" },
    { variant: "subtitle", size: "md", class: "text-sm" },
    { variant: "subtitle", size: "lg", class: "text-base" },
    { variant: "body", size: "sm", class: "text-xs" },
    { variant: "body", size: "md", class: "text-sm" },
    { variant: "body", size: "lg", class: "text-base" },
    { variant: "hint", size: "sm", class: "text-[10px]" },
    { variant: "hint", size: "md", class: "text-xs" },
    { variant: "hint", size: "lg", class: "text-sm" },
    { variant: "mono", size: "sm", class: "text-xs" },
    { variant: "mono", size: "md", class: "text-sm" },
    { variant: "mono", size: "lg", class: "text-base" },
  ],
  defaultVariants: {
    variant: "body",
    size: "md",
    muted: false,
  },
});

export type TypographyProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof typographyVariants> & {
    children: ReactNode;
  };

export function Typography(props: TypographyProps) {
  const { variant, size, muted, className, children, ...rest } = props;

  return (
    <span
      {...rest}
      className={cn(typographyVariants({ variant, size, muted }), className)}
    >
      {children}
    </span>
  );
}
