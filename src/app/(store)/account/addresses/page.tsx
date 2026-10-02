import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { AddressForm, EditableAddress } from "@/components/store/account-forms";
import { Badge, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { destinationName } from "@/lib/money/currency";
import { getAddresses } from "@/lib/queries/account";
import { deleteAddressAction, setDefaultAddressAction } from "@/app/actions/account";

export const metadata: Metadata = { title: "Addresses", robots: { index: false } };

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const addresses = await getAddresses(user.id);
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Your account" title="Addresses" description="Saved delivery addresses." />
      {addresses.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-col rounded-2xl bg-sand-50 p-5 ring-1 ring-umber-200/60">
              <div className="mb-3 flex items-center gap-2">
                <MapPin className="size-4 text-gold-600" aria-hidden />
                <span className="font-semibold text-umber-900">{a.label ?? "Address"}</span>
                {a.isDefault ? <Badge tone="indigo">Default</Badge> : null}
              </div>
              <EditableAddress address={a}>
                <p>
                  {a.fullName}
                  <br />
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}
                  <br />
                  {a.city} {a.region ?? ""} {a.postalCode ?? ""}
                  <br />
                  {destinationName(a.country)}
                  {a.phone ? (
                    <>
                      <br />
                      {a.phone}
                    </>
                  ) : null}
                </p>
              </EditableAddress>
              <div className="mt-auto flex gap-4 border-t border-umber-200/60 pt-3 text-sm">
                {!a.isDefault ? (
                  <form action={setDefaultAddressAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="text-umber-600 hover:text-umber-900">Make default</button>
                  </form>
                ) : null}
                <form action={deleteAddressAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-umber-600 hover:text-danger-700">Delete</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-umber-600">No saved addresses yet — add one below, or save it at checkout.</p>
      )}
      <section className="rounded-[var(--radius-card)] bg-sand-50/70 p-6 ring-1 ring-umber-200/60 md:p-8">
        <h2 className="font-display text-2xl text-umber-900">Add an address</h2>
        <div className="mt-5">
          <AddressForm />
        </div>
      </section>
    </div>
  );
}
