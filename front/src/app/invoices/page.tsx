import InvoiceTable from "@/components/invoices/invoicesTable";

export default async function Page() {
  return (
    <main>
      <InvoiceTable
        includeCustomer={true}
        includeItems={false}
        defaultPageSize={10}
        defaultSort={[{ field: "invoice_date", direction: "desc" }]}
        defaultFilter={{}}
      />
    </main>
  );
}
