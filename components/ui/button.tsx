import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] ' +
    'disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:bg-[var(--color-accent)] active:bg-[var(--color-gold-dim)]',
        secondary:
          'bg-transparent border border-[rgba(216,173,88,0.22)] text-[var(--color-primary)] hover:bg-[rgba(216,173,88,0.08)]',
        accent:
          'bg-[var(--color-accent)] text-[var(--color-primary-fg)] hover:bg-[var(--color-cream)]',
        ghost:
          'text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-hover)]',
        destructive:
          'bg-[var(--color-danger)] text-white hover:brightness-110',
      },
      size: {
        sm: 'h-9 px-3 text-xs',
        md: 'h-11 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';

export { buttonVariants };
