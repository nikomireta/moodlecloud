import { CheckoutPageClient } from "../page"

type CheckoutInvoicePageProps = {
  params: Promise<{
    invoiceRef: string
  }>
}

export default async function CheckoutInvoicePage({ params }: CheckoutInvoicePageProps) {
  const { invoiceRef } = await params
  return <CheckoutPageClient invoiceRef={invoiceRef} />
}
