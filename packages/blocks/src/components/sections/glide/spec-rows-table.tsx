// Port of the theme's `.product-doc__rows` table (blocks/_product-description.liquid, snippets/spec-rows.liquid): spec rows inside a product tab.
import type { SpecRow } from '../../../product-data'

type SpecRowsTableProps = { rows: SpecRow[] }

export default function SpecRowsTable({ rows }: SpecRowsTableProps) {
  return (
    <div className="product-doc">
      <table className="product-doc__rows product-doc__rows--specs">
        <tbody>
          {rows.map((row, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are lines of one text field; two may read the same.
            <tr key={i}>
              {row.label ? (
                <>
                  <th scope="row">{row.label}</th>
                  <td>
                    {row.value}
                    {row.sub ? <span className="product-doc__tile-note">{row.sub}</span> : null}
                  </td>
                </>
              ) : (
                <td colSpan={2}>{row.value}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
