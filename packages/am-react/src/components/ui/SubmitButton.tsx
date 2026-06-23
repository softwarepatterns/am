import {
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

import { cn } from "../../lib/ui/cn.js";

export type SubmitButtonState = "idle" | "busy" | "success";

export type SubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  state: SubmitButtonState;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  type?: "button" | "submit";
  "aria-label"?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
};

export function SubmitButton(props: SubmitButtonProps) {
  const {
    state,
    disabled = false,
    children,
    className,
    type = "submit",
    "aria-label": ariaLabel,
    ...rest
  } = props;
  const isBusy = state === "busy";
  const isSuccess = state === "success";

  return (
    <button
      type={type}
      className={cn("btn", className)}
      disabled={disabled || isBusy || isSuccess}
      aria-busy={isBusy ? "true" : "false"}
      aria-live="polite"
      aria-label={ariaLabel}
      {...rest}
    >
      <span className="relative inline-flex min-h-5 min-w-5 items-center justify-center text-nowrap">
        <AnimatePresence mode="wait" initial={false}>
          {isBusy ? (
            <motion.span
              key="loader"
              initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="absolute"
            >
              <Loader2 className="h-5 w-5 animate-spin" />
            </motion.span>
          ) : isSuccess ? (
            <motion.span
              key="check"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.2 }}
              className="text-success absolute"
            >
              <Check className="h-5 w-5 stroke-[3]" />
            </motion.span>
          ) : (
            <motion.span
              key="text"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {children}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </button>
  );
}
