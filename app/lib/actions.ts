"use server";
import { signIn } from "@/auth";
import { sql } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// define the schema to be used for validation
const InvoiceSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: "Please select a customer.",
  }),
  amount: z.coerce.number().gt(0, {
    message: "Please enter an amount greater than $0.",
  }),
  status: z.enum(["pending", "paid"], {
    invalid_type_error: "Please select an invoice status.",
  }),
  date: z.string(),
});

// create an "extension" of the already defined invoice schema that will
// omit some of the fields that we don't have access to at the moment of submitting the form
const CreateInvoiceSchema = InvoiceSchema.omit({ id: true, date: true });

export type FormState = {
  message?: string | null;
  errors?: Record<string, string[]> | null;
};

export async function createInvoice(_prevState: FormState, formData: FormData) {
  const validatedFields = CreateInvoiceSchema.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  // convert the user specified amount into cents
  // to avoid floating point errors and ensure greater accuracy
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing fields. Failed to create a new invoice!",
    };
  }

  const amountInCents: number = validatedFields.data.amount * 100;
  const date = new Date().toISOString().split("T")[0];

  // insert the data into the database
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${validatedFields.data.customerId}, ${amountInCents}, ${validatedFields.data.status}, ${date});
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
export async function updateInvoice(
  id: string,
  _prevState: FormState,
  formData: FormData
) {
  const validatedFields = EditInvoiceSchema.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing fields. Failed to update targeted invoice!",
    };
  }

  const amountInCents = validatedFields.data.amount * 100;
  const updatedDate = new Date().toISOString().split("T")[0];

  try {
    await sql`
      UPDATE invoices 
      SET customer_id = ${validatedFields.data.customerId}, amount = ${amountInCents}, status = ${status}, date = ${updatedDate}
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

export async function authenticateUser(
  prevState: string | undefined,
  formData: FormData
) {
  try {
    await signIn("credentials", Object.fromEntries(formData));
  } catch (error) {
    if ((error as Error).message.includes("CredentialSignin")) {
      return "CredentialSignin";
    }
    throw error;
  }
}
