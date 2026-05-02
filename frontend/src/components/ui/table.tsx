import type { ComponentPropsWithoutRef, ReactNode, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'

/**
 * TailAdmin table primitives — aligned with
 * https://github.com/TailAdmin/free-react-tailwind-admin-dashboard (Basic Table One)
 */

/** All horizontal rules use <tr> border-top so they match under border-collapse (avoid thead border-b + divide-y mismatch). */
const tableBodyDividers =
  'divide-y divide-gray-100 dark:divide-white/[0.05] [&>tr:first-child]:border-t [&>tr:first-child]:border-gray-100 dark:[&>tr:first-child]:border-white/[0.05]'

type TableProps = { children: ReactNode; className?: string } & TableHTMLAttributes<HTMLTableElement>

export function Table({ children, className = '', ...rest }: TableProps) {
  return (
    <table className={`w-full min-w-0 border-collapse ${className}`.trim()} {...rest}>
      {children}
    </table>
  )
}

type TableHeaderProps = { children: ReactNode; className?: string }

export function TableHeader({ children, className = '' }: TableHeaderProps) {
  return <thead className={className}>{children}</thead>
}

type TableBodyProps = { children: ReactNode; className?: string }

export function TableBody({ children, className = '' }: TableBodyProps) {
  return <tbody className={`${tableBodyDividers} ${className}`.trim()}>{children}</tbody>
}

type TableRowProps = ComponentPropsWithoutRef<'tr'>

export function TableRow({ children, className = '', ...rest }: TableRowProps) {
  return (
    <tr className={className} {...rest}>
      {children}
    </tr>
  )
}

type TableCellProps =
  | ({ isHeader: true; children: ReactNode; className?: string } & Omit<
      ThHTMLAttributes<HTMLTableCellElement>,
      'children'
    >)
  | ({ isHeader?: false; children: ReactNode; className?: string } & Omit<
      TdHTMLAttributes<HTMLTableCellElement>,
      'children'
    >)

export function TableCell(props: TableCellProps) {
  const { children, className = '' } = props
  if ('isHeader' in props && props.isHeader) {
    const { isHeader: _i, ...thProps } = props as Extract<TableCellProps, { isHeader: true }>
    return <th className={className} {...thProps}>{children}</th>
  }
  const { isHeader: _i, ...tdProps } = props as Extract<TableCellProps, { isHeader?: false }>
  return <td className={className} {...tdProps}>{children}</td>
}
