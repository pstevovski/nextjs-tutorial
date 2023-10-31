"use server";
import { sql } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// define the schema to be used for validation
const InvoiceSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(["pending", "paid"]),
  date: z.string(),
});
type InvoiceSchemaType = z.infer<typeof InvoiceSchema>;

// create an "extension" of the already defined invoice schema that will
// omit some of the fields that we don't have access to at the moment of submitting the form
const CreateInvoiceSchema = InvoiceSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
  const { customerId, amount, status } = CreateInvoiceSchema.parse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  // convert the user specified amount into cents
  // to avoid floating point errors and ensure greater accuracy
  const amountInCents: number = amount * 100;
  const date = new Date().toISOString().split("T")[0];

  // insert the data into the database
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date});
    `;

    // invalidate the cached invoices data that will trigger refetch
    revalidatePath("/dashboard/invoices");

    // redirect the user back to the invoices page
    redirect("/dashboard/invoices");
  } catch (error) {
    return {
      error: "Failed creating a new invoice",
    };
  }
}

const EditInvoiceSchema = InvoiceSchema.omit({ id: true, date: true });
export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = EditInvoiceSchema.parse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  const amountInCents = amount * 100;
  const updatedDate = new Date().toISOString().split("T")[0];

  try {
    await sql`
      UPDATE invoices 
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}, date = ${updatedDate}
      WHERE id = ${id} 
    `;

    revalidatePath("/dashboard/invoices");
    redirect("/dashboard/invoices");
  } catch (error) {
    return {
      error: `Failed updating invoice with id: ${id}`,
    };
  }
}

export async function deleteInvoice(invoiceId: string) {
  try {
    await sql`
      DELETE FROM invoices WHERE id = ${invoiceId}
    `;
    revalidatePath("/dashboard/invoices");
    return { message: "Invoice deleted!" };
  } catch (error) {
    return {
      error: `Failed deleting invoice with id: ${invoiceId}`,
    };
  }
}
