import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/ui/cn.js";

const headingVariants = cva("font-semibold", {
  variants: {
    size: {
      sm: "text-lg",
      md: "text-2xl",
      lg: "text-3xl",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

export type HeadingElement = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export type HeadingProps = HTMLAttributes<HTMLHeadingElement> &
  VariantProps<typeof headingVariants> & {
    as: HeadingElement;
    children: ReactNode;
  };

export function Heading(props: HeadingProps) {
  const { as: Tag, size, className, children, ...rest } = props;

  return (
    <Tag {...rest} className={cn(headingVariants({ size }), className)}>
      {children}
    </Tag>
  );
}
