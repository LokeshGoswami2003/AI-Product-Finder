import { safeEastmanUrl } from '../protocol/links'

function ProductLink({ href, children }) {
  const safeUrl = safeEastmanUrl(href)
  if (!safeUrl) return null
  return (
    <a href={safeUrl} target="_blank" rel="noreferrer">
      {children}<span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

export function ProductCard({ product }) {
  const { documents = {}, links = {} } = product
  return (
    <article className="product-card">
      <div>
        <p className="product-label">Recommended product</p>
        <h3>{product.displayName}</h3>
        <p className="fgmn">FGMN {product.fgmn}</p>
      </div>
      <nav aria-label={`${product.displayName} resources`}>
        <ProductLink href={links.detail}>Details</ProductLink>
        {documents.hasTds && <ProductLink href={links.tds}>TDS</ProductLink>}
        {documents.hasSds && <ProductLink href={links.sds}>SDS</ProductLink>}
        {documents.hasSalesSpecification && (
          <ProductLink href={links.salesSpecification}>Sales spec</ProductLink>
        )}
        <ProductLink href={links.inquiry}>Ask Eastman</ProductLink>
      </nav>
    </article>
  )
}

