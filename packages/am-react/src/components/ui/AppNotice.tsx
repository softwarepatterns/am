import { Typography } from './Typography.js';
import { cn } from '../../lib/ui/cn.js';
import type { AriaRole, HTMLAttributes, ReactNode } from 'react';

export type AppNoticeTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

const toneClasses: Record<AppNoticeTone, string> = {
  neutral: 'alert',
  info: 'alert alert-info',
  success: 'alert alert-success',
  warning: 'alert alert-warning',
  error: 'alert alert-error',
};

function resolveRole(tone: AppNoticeTone): AriaRole {
  if (tone === 'error' || tone === 'warning') {
    return 'alert';
  }

  return 'status';
}

export type AppNoticeProps = HTMLAttributes<HTMLDivElement> & {
  tone?: AppNoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  role?: AriaRole;
};

export function AppNotice(props: AppNoticeProps) {
  const {
    className,
    tone = 'neutral',
    title,
    children,
    actions,
    icon,
    role,
    ...rest
  } = props;

  return (
    <div
      className={cn(
        'min-h-12 items-start gap-3 shadow-none',
        toneClasses[tone],
        className,
      )}
      role={role ?? resolveRole(tone)}
      {...rest}
    >
      {icon ? <div className="mt-0.5 shrink-0">{icon}</div> : null}
      <div className="min-w-0 flex-1">
        {title ? (
          <Typography variant="title" size="sm" className="block">
            {title}
          </Typography>
        ) : null}
        {children ? (
          <div className={cn(title ? 'mt-1' : null)}>
            {typeof children === 'string' || typeof children === 'number' ? (
              <Typography variant="body" className="block">
                {children}
              </Typography>
            ) : (
              children
            )}
          </div>
        ) : null}
        {actions ? <div className="mt-3">{actions}</div> : null}
      </div>
    </div>
  );
}
