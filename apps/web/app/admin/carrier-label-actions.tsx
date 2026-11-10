import type { ReactNode } from 'react';

/** Řada akcí na kartě štítku: tisk (primární) + kopírování URL, stejná velikost. */
export function CarrierLabelActions({
  children,
  columns = 2,
}: {
  children: ReactNode;
  /** 2 = tisk + kopírovat vedle sebe (na úzkém displeji pod sebou). 1 = jen kopírovat. */
  columns?: 1 | 2;
}) {
  return (
    <div
      className={
        columns === 2
          ? 'grid w-full grid-cols-1 gap-2 sm:grid-cols-2'
          : 'grid w-full grid-cols-1 gap-2'
      }
    >
      {children}
    </div>
  );
}
